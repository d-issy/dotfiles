import { readFile, writeFile } from "node:fs/promises";
import type {
	AgentToolResult,
	EditDiffResult,
	Theme,
} from "@earendil-works/pi-coding-agent";
import {
	generateDiffString,
	generateUnifiedPatch,
	renderDiff,
} from "@earendil-works/pi-coding-agent";
import { type Component, Text } from "@earendil-works/pi-tui";
import { type Static, Type } from "typebox";
import { ToolError } from "./errors";
import {
	assertRepoPathAllowed,
	createFsGuardContext,
	displayRepoPath,
	resolveRepoPath,
} from "./guard";
const APPLY_PATCH_OPERATION = "Applying patch to";
const LLM_DIFF_OMIT_LINE_THRESHOLD = 50;
type TextEdit = {
	readonly start: number;
	readonly end: number;
	readonly replacement: string;
	readonly label: string;
};

type LineIndex = {
	readonly starts: readonly number[];
	readonly contentEnds: readonly number[];
	readonly rangeEnds: readonly number[];
	readonly lineCount: number;
};

type ApplyPatchDetails = {
	operation: "apply_patch";
	path: string;
	edits: number;
	diff: string;
	patch: string;
};

const lineNoSchema = Type.Integer({ minimum: 1 });

const allowedReplacementLineRangeSchema = Type.Object({
	start: lineNoSchema,
	end: lineNoSchema,
});

const replaceSchema = Type.Object({
	oldText: Type.String(),
	newText: Type.String(),
	startLineNo: Type.Optional(lineNoSchema),
	endLineNo: Type.Optional(lineNoSchema),
	allowedReplacementLineRanges: Type.Optional(
		Type.Array(allowedReplacementLineRangeSchema, {
			description:
				"Optional 1-based line ranges where exact oldText replacement is allowed. oldText must match exactly, including whitespace and newlines. Use the smallest ranges that include the intended replacements; avoid broad ranges such as the whole file. These ranges limit where replacement may occur; they are not replaced by themselves.",
		}),
	),
});

export const applyPatchSchema = Type.Object({
	path: Type.String({ description: "Path of the file to edit." }),
	replaces: Type.Optional(
		Type.Array(replaceSchema, {
			description:
				"Replace oldText with newText. oldText must match exactly, including whitespace and newlines. If line numbers can make the edit unambiguous, use allowedReplacementLineRanges with concise oldText and the smallest suitable line ranges to save tokens; use wider oldText only when needed, such as multiple matches on the same line.",
		}),
	),
	sedScripts: Type.Optional(
		Type.Array(Type.String(), {
			description:
				"Apply one or more sed scripts to the file, in order. Use this for compact line/range edits such as deletion or scoped substitution. Do not use sedScripts blindly: first inspect the target range with read, grep, or similar tools, and ensure the sed range uniquely targets the intended lines. If a script uses line-number addresses, provide only one script in sedScripts because earlier edits can shift later line numbers; for multiple line-number edits, apply one script, re-read the file, then apply the next.",
		}),
	),
});

export type ApplyPatchToolInput = Static<typeof applyPatchSchema>;
type ReplaceOperation = NonNullable<ApplyPatchToolInput["replaces"]>[number];

function checkAbort(signal: AbortSignal | undefined): void {
	if (signal?.aborted)
		throw new ToolError("aborted", APPLY_PATCH_OPERATION, "");
}

function operationCount(params: ApplyPatchToolInput): number {
	return (params.replaces?.length ?? 0) + (params.sedScripts?.length ?? 0);
}

function createLineIndex(text: string): LineIndex {
	if (text.length === 0) {
		return { starts: [], contentEnds: [], rangeEnds: [], lineCount: 0 };
	}
	const starts: number[] = [];
	const contentEnds: number[] = [];
	const rangeEnds: number[] = [];
	let start = 0;
	while (start < text.length) {
		starts.push(start);
		const newline = text.indexOf("\n", start);
		if (newline === -1) {
			contentEnds.push(text.length);
			rangeEnds.push(text.length);
			break;
		}
		contentEnds.push(newline);
		rangeEnds.push(newline + 1);
		start = newline + 1;
	}
	return { starts, contentEnds, rangeEnds, lineCount: starts.length };
}

function assertLineNo(index: LineIndex, lineNo: number, label: string): void {
	if (!Number.isInteger(lineNo) || lineNo < 1 || lineNo > index.lineCount) {
		throw new Error(
			`${label} line number ${lineNo} is outside the file line range 1-${index.lineCount}.`,
		);
	}
}

function assertLineRange(
	index: LineIndex,
	startLineNo: number,
	endLineNo: number,
	label: string,
): void {
	assertLineNo(index, startLineNo, `${label} startLineNo`);
	assertLineNo(index, endLineNo, `${label} endLineNo`);
	if (startLineNo > endLineNo) {
		throw new Error(`${label} startLineNo must be <= endLineNo.`);
	}
}

function rangeContentChars(
	index: LineIndex,
	startLineNo: number,
	endLineNo: number,
): { start: number; end: number } {
	return {
		start: index.starts[startLineNo - 1] ?? 0,
		end: index.contentEnds[endLineNo - 1] ?? 0,
	};
}

function lineNoAtOffset(index: LineIndex, offset: number): number {
	let result = 1;
	for (let i = 0; i < index.starts.length; i++) {
		const start = index.starts[i] ?? 0;
		if (start > offset) break;
		result = i + 1;
	}
	return result;
}

function findOccurrences(
	haystack: string,
	needle: string,
	baseOffset: number,
): number[] {
	if (needle.length === 0)
		throw new Error("replaces oldText must not be empty.");
	const positions: number[] = [];
	let offset = 0;
	while (offset <= haystack.length) {
		const found = haystack.indexOf(needle, offset);
		if (found === -1) break;
		positions.push(baseOffset + found);
		offset = found + Math.max(needle.length, 1);
	}
	return positions;
}

function assertAllowedReplacementLineRange(
	index: LineIndex,
	start: number,
	end: number,
	label: string,
): void {
	assertLineNo(index, start, `${label} start`);
	assertLineNo(index, end, `${label} end`);
	if (start > end) {
		throw new Error(`${label} start must be <= end.`);
	}
}

function matchedLineCounts(
	index: LineIndex,
	positions: readonly number[],
): Map<number, number> {
	const counts = new Map<number, number>();
	for (const position of positions) {
		const lineNo = lineNoAtOffset(index, position);
		counts.set(lineNo, (counts.get(lineNo) ?? 0) + 1);
	}
	return counts;
}

function matchedLinesSummary(
	index: LineIndex,
	positions: readonly number[],
): string {
	return `[${Array.from(matchedLineCounts(index, positions).keys()).join(", ")}]`;
}

function multipleMatchesOnSameLineWarning(
	index: LineIndex,
	positions: readonly number[],
): string {
	const lines = Array.from(
		matchedLineCounts(index, positions).entries(),
	).filter(([, count]) => count > 1);
	if (lines.length === 0) return "";
	return `\nWarning: oldText matched multiple times on the same line.\nUse a wider oldText, such as the full line or surrounding phrase, so the intended replacement is unambiguous.\nLines with multiple matches:\n${lines.map(([lineNo, count]) => `- line ${lineNo}: ${count} matches`).join("\n")}`;
}

function assertNoSameLineMatches(
	index: LineIndex,
	positions: readonly number[],
	label: string,
): void {
	for (const [lineNo, count] of matchedLineCounts(index, positions)) {
		if (count > 1) {
			throw new Error(
				`${label} oldText matched multiple locations on line ${lineNo}.\nLine ranges cannot disambiguate multiple matches on the same line.\nUse a wider oldText, such as the full line or surrounding phrase, so the intended replacement is unambiguous.`,
			);
		}
	}
}

function createSequentialReplaceEdits(
	text: string,
	replace: ReplaceOperation,
	replaceIndex: number,
): TextEdit[] {
	const index = createLineIndex(text);
	const edits: TextEdit[] = [];
	const hasStart = replace.startLineNo !== undefined;
	const hasEnd = replace.endLineNo !== undefined;
	if (hasStart !== hasEnd) {
		throw new Error(
			`replaces[${replaceIndex}] must specify both startLineNo and endLineNo, or neither.`,
		);
	}
	if ((replace.allowedReplacementLineRanges?.length ?? 0) > 0) {
		if (hasStart || hasEnd) {
			throw new Error(
				`replaces[${replaceIndex}] must specify either startLineNo/endLineNo or allowedReplacementLineRanges, not both.`,
			);
		}
		for (const [rangeIndex, range] of (
			replace.allowedReplacementLineRanges ?? []
		).entries()) {
			const label = `replaces[${replaceIndex}].allowedReplacementLineRanges[${rangeIndex}]`;
			assertAllowedReplacementLineRange(index, range.start, range.end, label);
			const chars = rangeContentChars(index, range.start, range.end);
			const positions = findOccurrences(
				text.slice(chars.start, chars.end),
				replace.oldText,
				chars.start,
			);
			if (positions.length === 0) {
				throw new Error(
					`${label} oldText did not match within the allowed replacement line range.`,
				);
			}
			assertNoSameLineMatches(index, positions, label);
			for (const start of positions) {
				edits.push({
					start,
					end: start + replace.oldText.length,
					replacement: replace.newText,
					label,
				});
			}
		}
		return edits;
	}

	let searchText = text;
	let baseOffset = 0;
	if (hasStart && hasEnd) {
		const startLineNo = replace.startLineNo ?? 1;
		const endLineNo = replace.endLineNo ?? 1;
		assertLineRange(index, startLineNo, endLineNo, `replaces[${replaceIndex}]`);
		const chars = rangeContentChars(index, startLineNo, endLineNo);
		searchText = text.slice(chars.start, chars.end);
		baseOffset = chars.start;
	}
	const positions = findOccurrences(searchText, replace.oldText, baseOffset);
	if (positions.length === 0)
		throw new Error(`replaces[${replaceIndex}] oldText was not found.`);
	if (positions.length > 1) {
		throw new Error(
			`replaces[${replaceIndex}] oldText matched multiple locations.\nSpecify allowedReplacementLineRanges with the smallest line ranges that contain only intended replacements.\nMatched lines: ${matchedLinesSummary(index, positions)}.${multipleMatchesOnSameLineWarning(index, positions)}`,
		);
	}
	const start = positions[0] ?? 0;
	return [
		{
			start,
			end: start + replace.oldText.length,
			replacement: replace.newText,
			label: `replaces[${replaceIndex}]`,
		},
	];
}

function applySequentialReplaces(
	text: string,
	replaces: readonly ReplaceOperation[],
): { text: string; edits: number } {
	let nextText = text;
	let editCount = 0;
	for (const [i, replace] of replaces.entries()) {
		const edits = createSequentialReplaceEdits(nextText, replace, i);
		nextText = applyTextEdits(nextText, edits);
		editCount += edits.length;
	}
	return { text: nextText, edits: editCount };
}

type SedAddress = {
	readonly startLineNo: number;
	readonly endLineNo: number;
};

type SedCommand =
	| {
			readonly kind: "delete";
			readonly address: SedAddress | undefined;
	  }
	| {
			readonly kind: "append" | "insert";
			readonly address: SedAddress | undefined;
			readonly text: string;
	  }
	| {
			readonly kind: "substitute";
			readonly address: SedAddress | undefined;
			readonly regex: RegExp;
			readonly replacement: string;
	  };

type ParsedSedScript = {
	readonly commands: readonly SedCommand[];
	readonly usesLineAddresses: boolean;
};

type SedLine = {
	readonly content: string;
	readonly newline: string;
};

function isDigit(char: string | undefined): boolean {
	return char !== undefined && char >= "0" && char <= "9";
}

function skipSedSpaces(script: string, cursor: number): number {
	let nextCursor = cursor;
	while (/\s/u.test(script[nextCursor] ?? "")) nextCursor++;
	return nextCursor;
}

function readSedLineNo(
	script: string,
	cursor: number,
	label: string,
): { lineNo: number; cursor: number } {
	let nextCursor = cursor;
	while (isDigit(script[nextCursor])) nextCursor++;
	if (nextCursor === cursor) {
		throw new Error(`${label} expected a line number.`);
	}
	const lineNo = Number(script.slice(cursor, nextCursor));
	if (!Number.isSafeInteger(lineNo) || lineNo < 1) {
		throw new Error(`${label} line number must be a positive integer.`);
	}
	return { lineNo, cursor: nextCursor };
}

function parseSedAddress(
	script: string,
	cursor: number,
	label: string,
): { address: SedAddress | undefined; cursor: number } {
	let nextCursor = skipSedSpaces(script, cursor);
	if (!isDigit(script[nextCursor])) {
		return { address: undefined, cursor: nextCursor };
	}

	const start = readSedLineNo(script, nextCursor, label);
	nextCursor = skipSedSpaces(script, start.cursor);
	let endLineNo = start.lineNo;
	if (script[nextCursor] === ",") {
		nextCursor = skipSedSpaces(script, nextCursor + 1);
		const end = readSedLineNo(script, nextCursor, label);
		endLineNo = end.lineNo;
		nextCursor = skipSedSpaces(script, end.cursor);
	}
	if (start.lineNo > endLineNo) {
		throw new Error(`${label} address range start must be <= end.`);
	}
	return {
		address: { startLineNo: start.lineNo, endLineNo },
		cursor: nextCursor,
	};
}

function readSedEscapedSection(
	script: string,
	cursor: number,
	delimiter: string,
	label: string,
): { value: string; cursor: number } {
	let value = "";
	let nextCursor = cursor;
	while (nextCursor < script.length) {
		const char = script[nextCursor] ?? "";
		if (char === delimiter) {
			return { value, cursor: nextCursor + 1 };
		}
		if (char === "\\") {
			const nextChar = script[nextCursor + 1];
			if (nextChar === undefined) {
				value += char;
				nextCursor++;
				continue;
			}
			value += nextChar === delimiter ? delimiter : `${char}${nextChar}`;
			nextCursor += 2;
			continue;
		}
		value += char;
		nextCursor++;
	}
	throw new Error(`${label} unterminated substitute command.`);
}

function parseSedSubstitute(
	script: string,
	cursor: number,
	address: SedAddress | undefined,
	label: string,
): { command: SedCommand; cursor: number } {
	const delimiter = script[cursor];
	if (delimiter === undefined || delimiter === ";" || delimiter === "\\") {
		throw new Error(`${label} substitute command is missing a delimiter.`);
	}
	const pattern = readSedEscapedSection(script, cursor + 1, delimiter, label);
	const replacement = readSedEscapedSection(
		script,
		pattern.cursor,
		delimiter,
		label,
	);
	let global = false;
	let nextCursor = replacement.cursor;
	while (nextCursor < script.length && script[nextCursor] !== ";") {
		const flag = script[nextCursor] ?? "";
		if (/\s/u.test(flag)) {
			nextCursor++;
			continue;
		}
		if (flag !== "g") {
			throw new Error(
				`${label} unsupported substitute flag ${JSON.stringify(flag)}.`,
			);
		}
		if (global) {
			throw new Error(`${label} duplicate substitute flag "g".`);
		}
		global = true;
		nextCursor++;
	}
	try {
		return {
			command: {
				kind: "substitute",
				address,
				regex: new RegExp(pattern.value, global ? "g" : ""),
				replacement: replacement.value,
			},
			cursor: nextCursor,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`${label} invalid substitute pattern: ${message}`, {
			cause: error,
		});
	}
}

function readSedTextCommand(
	script: string,
	cursor: number,
	kind: "append" | "insert",
	address: SedAddress | undefined,
	label: string,
): { command: SedCommand; cursor: number } {
	if (script[cursor] !== "\\") {
		throw new Error(
			`${label} ${kind} command must use ${kind[0]}\\text syntax.`,
		);
	}
	let nextCursor = cursor + 1;
	while (nextCursor < script.length && script[nextCursor] !== ";") {
		nextCursor++;
	}
	return {
		command: { kind, address, text: script.slice(cursor + 1, nextCursor) },
		cursor: nextCursor,
	};
}

function parseSedScript(script: string, scriptIndex: number): ParsedSedScript {
	const commands: SedCommand[] = [];
	let cursor = 0;
	while (cursor < script.length) {
		cursor = skipSedSpaces(script, cursor);
		if (cursor >= script.length) break;
		if (script[cursor] === ";") {
			cursor++;
			continue;
		}

		const label = `sedScripts[${scriptIndex}] command ${commands.length}`;
		const parsedAddress = parseSedAddress(script, cursor, label);
		cursor = parsedAddress.cursor;
		const commandChar = script[cursor];
		if (commandChar === undefined) {
			throw new Error(`${label} missing command.`);
		}
		cursor++;

		let parsedCommand: { command: SedCommand; cursor: number };
		if (commandChar === "d") {
			parsedCommand = {
				command: { kind: "delete", address: parsedAddress.address },
				cursor: skipSedSpaces(script, cursor),
			};
		} else if (commandChar === "a") {
			parsedCommand = readSedTextCommand(
				script,
				cursor,
				"append",
				parsedAddress.address,
				label,
			);
		} else if (commandChar === "i") {
			parsedCommand = readSedTextCommand(
				script,
				cursor,
				"insert",
				parsedAddress.address,
				label,
			);
		} else if (commandChar === "s") {
			parsedCommand = parseSedSubstitute(
				script,
				cursor,
				parsedAddress.address,
				label,
			);
		} else {
			throw new Error(
				`${label} unsupported command ${JSON.stringify(commandChar)}.`,
			);
		}

		commands.push(parsedCommand.command);
		cursor = parsedCommand.cursor;
		if (cursor < script.length) {
			if (script[cursor] !== ";") {
				throw new Error(`${label} expected command separator ";".`);
			}
			cursor++;
		}
	}
	return {
		commands,
		usesLineAddresses: commands.some(
			(command) => command.address !== undefined,
		),
	};
}

function splitSedLines(text: string): SedLine[] {
	if (text.length === 0) return [];
	const lines: SedLine[] = [];
	let start = 0;
	while (start < text.length) {
		const newline = text.indexOf("\n", start);
		if (newline === -1) {
			lines.push({ content: text.slice(start), newline: "" });
			break;
		}
		lines.push({ content: text.slice(start, newline), newline: "\n" });
		start = newline + 1;
	}
	return lines;
}

function sedAddressMatches(
	address: SedAddress | undefined,
	lineNo: number,
): boolean {
	return (
		address === undefined ||
		(lineNo >= address.startLineNo && lineNo <= address.endLineNo)
	);
}

function sedCommandText(text: string): string {
	return text.endsWith("\n") ? text : `${text}\n`;
}

function applySedCommand(text: string, command: SedCommand): string {
	const output: string[] = [];
	for (const [lineIndex, line] of splitSedLines(text).entries()) {
		const lineNo = lineIndex + 1;
		if (!sedAddressMatches(command.address, lineNo)) {
			output.push(`${line.content}${line.newline}`);
			continue;
		}

		switch (command.kind) {
			case "delete":
				break;
			case "insert":
				output.push(sedCommandText(command.text));
				output.push(`${line.content}${line.newline}`);
				break;
			case "append":
				output.push(`${line.content}${line.newline}`);
				if (line.newline === "") output.push("\n");
				output.push(sedCommandText(command.text));
				break;
			case "substitute":
				output.push(
					`${line.content.replace(command.regex, () => command.replacement)}${line.newline}`,
				);
				break;
		}
	}
	return output.join("");
}

function applySedScript(text: string, script: ParsedSedScript): string {
	let nextText = text;
	for (const command of script.commands) {
		nextText = applySedCommand(nextText, command);
	}
	return nextText;
}

function applySedScripts(
	text: string,
	sedScripts: readonly string[],
): { text: string; edits: number } {
	const parsedScripts = sedScripts.map((script, index) =>
		parseSedScript(script, index),
	);
	if (
		parsedScripts.length > 1 &&
		parsedScripts.some((script) => script.usesLineAddresses)
	) {
		throw new Error(
			"sedScripts with line-number addresses must be provided as a single script entry.",
		);
	}

	let nextText = text;
	let edits = 0;
	for (const parsedScript of parsedScripts) {
		const previousText = nextText;
		nextText = applySedScript(nextText, parsedScript);
		if (nextText !== previousText) edits++;
	}
	return { text: nextText, edits };
}

function applyTextEdits(text: string, edits: readonly TextEdit[]): string {
	const sorted = Array.from(edits);
	sorted.sort((a: TextEdit, b: TextEdit) => a.start - b.start || a.end - b.end);
	for (let i = 1; i < sorted.length; i++) {
		const previous = sorted[i - 1];
		const current = sorted[i];
		if (!previous || !current) continue;
		if (current.start < previous.end) {
			throw new Error(`${current.label} overlaps ${previous.label}.`);
		}
	}
	let output = text;
	for (let i = sorted.length - 1; i >= 0; i--) {
		const edit = sorted[i];
		if (!edit) continue;
		output = `${output.slice(0, edit.start)}${edit.replacement}${output.slice(edit.end)}`;
	}
	return output;
}

function renderApplyPatchParams(args: unknown, theme: Theme): string[] {
	const input = (args ?? {}) as Record<string, unknown>;
	const lines: string[] = [];
	if (typeof input.path === "string") {
		lines.push(theme.fg("toolOutput", `path: ${JSON.stringify(input.path)}`));
	}
	for (const key of ["replaces", "sedScripts"] as const) {
		if (!Array.isArray(input[key]) || input[key].length === 0) continue;
		lines.push(theme.fg("toolOutput", `${key}: ${JSON.stringify(input[key])}`));
	}
	return lines;
}

export function renderApplyPatch(
	args: unknown,
	theme: Theme,
	context?: { readonly expanded?: boolean },
): Component {
	const input = (args ?? {}) as Record<string, unknown>;
	const path = typeof input.path === "string" ? input.path : "";
	let text = theme.fg("toolTitle", theme.bold("apply_patch"));
	if (path) text += ` ${theme.fg("accent", path)}`;
	if (!(context?.expanded ?? false)) return new Text(text, 0, 0);

	const params = renderApplyPatchParams(args, theme);
	if (params.length === 0) return new Text(text, 0, 0);
	return new Text(`${text}\n${params.join("\n")}`, 0, 0);
}

function isApplyPatchDetails(details: unknown): details is ApplyPatchDetails {
	if (typeof details !== "object" || details === null) return false;
	const value = details as Record<string, unknown>;
	return (
		value.operation === "apply_patch" &&
		typeof value.path === "string" &&
		typeof value.edits === "number" &&
		typeof value.diff === "string" &&
		typeof value.patch === "string"
	);
}

function renderToolResultText(
	result: AgentToolResult<unknown>,
	theme: Theme,
): Component {
	const text = result.content
		.filter((content) => content.type === "text")
		.map((content) => content.text)
		.join("\n");
	return new Text(theme.fg("toolOutput", text || "(no output)"), 0, 0);
}

export function renderApplyPatchResult(
	result: AgentToolResult<ApplyPatchDetails>,
	options: { expanded: boolean; isPartial: boolean },
	theme: Theme,
): Component {
	if (options.isPartial) {
		return new Text(theme.fg("warning", "Applying patch..."), 0, 0);
	}

	const details = result.details;
	if (!isApplyPatchDetails(details)) return renderToolResultText(result, theme);

	const summary = theme.fg("success", `Applied ${details.edits} edit(s).`);
	const resultParts = [
		...(details.diff.length === 0 ? [] : [renderDiff(details.diff)]),
		summary,
	];

	return new Text(resultParts.join("\n"), 0, 0);
}

export async function executeApplyPatch(
	cwd: string,
	params: ApplyPatchToolInput,
	signal: AbortSignal | undefined,
): Promise<AgentToolResult<ApplyPatchDetails>> {
	checkAbort(signal);
	if (operationCount(params) === 0) {
		throw new ToolError("missing_input", APPLY_PATCH_OPERATION, "operation");
	}
	const absolute = resolveRepoPath(cwd, params.path, APPLY_PATCH_OPERATION);
	const guardContext = await createFsGuardContext(cwd);
	await assertRepoPathAllowed(guardContext, absolute, APPLY_PATCH_OPERATION);
	const displayPath = displayRepoPath(cwd, absolute);
	const text = await readFile(absolute, "utf8");
	const sedResult = applySedScripts(text, params.sedScripts ?? []);
	const replaceResult = applySequentialReplaces(
		sedResult.text,
		params.replaces ?? [],
	);
	const result = {
		text: replaceResult.text,
		edits: sedResult.edits + replaceResult.edits,
	};
	const nextText = result.text;
	checkAbort(signal);
	await writeFile(absolute, nextText, "utf8");

	const diffResult: EditDiffResult = generateDiffString(text, nextText);
	const patch = generateUnifiedPatch(displayPath, text, nextText);
	const diffLineCount =
		diffResult.diff === "" ? 0 : diffResult.diff.split("\n").length;
	const resultSummary = `Applied ${result.edits} edit(s) to ${displayPath}.`;
	const resultBody = !diffResult.diff
		? resultSummary
		: diffLineCount >= LLM_DIFF_OMIT_LINE_THRESHOLD
			? `Diff omitted from tool result because it is ${diffLineCount} lines (>= ${LLM_DIFF_OMIT_LINE_THRESHOLD}).\n${resultSummary}`
			: `Diff:\n${diffResult.diff}\n${resultSummary}`;

	return {
		content: [
			{
				type: "text",
				text: resultBody,
			},
		],
		details: {
			operation: "apply_patch",
			path: displayPath,
			edits: result.edits,
			diff: diffResult.diff,
			patch,
		} satisfies ApplyPatchDetails,
	};
}
