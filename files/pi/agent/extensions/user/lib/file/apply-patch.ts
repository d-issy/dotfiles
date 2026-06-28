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

const targetLineNoRangeSchema = Type.Object({
	start: lineNoSchema,
	end: lineNoSchema,
});

const replaceSchema = Type.Object({
	oldText: Type.String(),
	newText: Type.String(),
	startLineNo: Type.Optional(lineNoSchema),
	endLineNo: Type.Optional(lineNoSchema),
	targetLineNoRanges: Type.Optional(
		Type.Array(targetLineNoRangeSchema, {
			description:
				"Optional target 1-based line number ranges where oldText may match and be replaced. When omitted, the whole file is searched.",
		}),
	),
});

const lineRangeSchema = Type.Object({
	startLineNo: lineNoSchema,
	endLineNo: lineNoSchema,
});

export const applyPatchSchema = Type.Object({
	path: Type.String({ description: "Path of the file to edit." }),
	replaces: Type.Optional(
		Type.Array(replaceSchema, {
			description:
				"Replace oldText with newText. If oldText matches multiple locations, startLineNo/endLineNo or targetLineNoRanges must disambiguate where replacements are allowed.",
		}),
	),
	removeLineRanges: Type.Optional(
		Type.Array(lineRangeSchema, {
			description: "Remove inclusive 1-based line ranges.",
		}),
	),
	insertLines: Type.Optional(
		Type.Array(
			Type.Object({
				contentLines: Type.Array(Type.String()),
				insertAfterLineNo: Type.Optional(lineNoSchema),
				insertBeforeLineNo: Type.Optional(lineNoSchema),
			}),
			{
				description:
					"Insert contentLines before or after a 1-based line number. Exactly one of insertAfterLineNo or insertBeforeLineNo is required.",
			},
		),
	),
});

export type ApplyPatchToolInput = Static<typeof applyPatchSchema>;

function checkAbort(signal: AbortSignal | undefined): void {
	if (signal?.aborted)
		throw new ToolError("aborted", APPLY_PATCH_OPERATION, "");
}

function operationCount(params: ApplyPatchToolInput): number {
	return (
		(params.replaces?.length ?? 0) +
		(params.removeLineRanges?.length ?? 0) +
		(params.insertLines?.length ?? 0)
	);
}

function lineText(lines: readonly string[]): string {
	if (lines.length === 0) return "";
	return `${lines.join("\n")}\n`;
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

function lineRangeToChars(
	index: LineIndex,
	startLineNo: number,
	endLineNo: number,
): { start: number; end: number } {
	return {
		start: index.starts[startLineNo - 1] ?? 0,
		end: index.rangeEnds[endLineNo - 1] ?? 0,
	};
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

function collectLineUsage(usedLines: Set<number>, lineNo: number): void {
	if (usedLines.has(lineNo))
		throw new Error(
			`Line ${lineNo} is used by multiple apply_patch operations.`,
		);
	usedLines.add(lineNo);
}

function collectLineRangeUsage(
	usedLines: Set<number>,
	startLineNo: number,
	endLineNo: number,
): void {
	for (let lineNo = startLineNo; lineNo <= endLineNo; lineNo++) {
		collectLineUsage(usedLines, lineNo);
	}
}

function assertTargetLineNoRange(
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
	const lines = Array.from(matchedLineCounts(index, positions).entries()).filter(
		([, count]) => count > 1,
	);
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

function createEdits(text: string, params: ApplyPatchToolInput): TextEdit[] {
	const index = createLineIndex(text);
	const edits: TextEdit[] = [];
	const usedLines = new Set<number>();

	for (const [i, range] of (params.removeLineRanges ?? []).entries()) {
		assertLineRange(
			index,
			range.startLineNo,
			range.endLineNo,
			`removeLineRanges[${i}]`,
		);
		collectLineRangeUsage(usedLines, range.startLineNo, range.endLineNo);
		const chars = lineRangeToChars(index, range.startLineNo, range.endLineNo);
		edits.push({ ...chars, replacement: "", label: `removeLineRanges[${i}]` });
	}

	for (const [i, insert] of (params.insertLines ?? []).entries()) {
		const hasAfter = insert.insertAfterLineNo !== undefined;
		const hasBefore = insert.insertBeforeLineNo !== undefined;
		if (hasAfter === hasBefore) {
			throw new Error(
				`insertLines[${i}] requires exactly one of insertAfterLineNo or insertBeforeLineNo.`,
			);
		}
		const lineNo = insert.insertAfterLineNo ?? insert.insertBeforeLineNo;
		if (lineNo === undefined)
			throw new Error(`insertLines[${i}] is missing a line number.`);
		assertLineNo(index, lineNo, `insertLines[${i}]`);
		collectLineUsage(usedLines, lineNo);
		const insertAfter = insert.insertAfterLineNo !== undefined;
		const position = insertAfter
			? (index.rangeEnds[lineNo - 1] ?? 0)
			: (index.starts[lineNo - 1] ?? 0);
		let replacement = lineText(insert.contentLines);
		if (insertAfter && position === text.length && !text.endsWith("\n")) {
			replacement = `\n${insert.contentLines.join("\n")}`;
		}
		edits.push({
			start: position,
			end: position,
			replacement,
			label: `insertLines[${i}]`,
		});
	}

	for (const [i, replace] of (params.replaces ?? []).entries()) {
		const hasStart = replace.startLineNo !== undefined;
		const hasEnd = replace.endLineNo !== undefined;
		if (hasStart !== hasEnd) {
			throw new Error(
				`replaces[${i}] must specify both startLineNo and endLineNo, or neither.`,
			);
		}
		if ((replace.targetLineNoRanges?.length ?? 0) > 0) {
			if (hasStart || hasEnd) {
				throw new Error(
					`replaces[${i}] must specify either startLineNo/endLineNo or targetLineNoRanges, not both.`,
				);
			}
			for (const [rangeIndex, range] of (
				replace.targetLineNoRanges ?? []
			).entries()) {
				const label = `replaces[${i}].targetLineNoRanges[${rangeIndex}]`;
				assertTargetLineNoRange(index, range.start, range.end, label);
				const chars = rangeContentChars(index, range.start, range.end);
				const positions = findOccurrences(
					text.slice(chars.start, chars.end),
					replace.oldText,
					chars.start,
				);
				if (positions.length === 0) {
					throw new Error(
						`${label} oldText did not match within the target line range.`,
					);
				}
				assertNoSameLineMatches(index, positions, label);
				for (const start of positions) {
					collectLineUsage(usedLines, lineNoAtOffset(index, start));
					edits.push({
						start,
						end: start + replace.oldText.length,
						replacement: replace.newText,
						label,
					});
				}
			}
			continue;
		}

		let searchText = text;
		let baseOffset = 0;
		if (hasStart && hasEnd) {
			const startLineNo = replace.startLineNo ?? 1;
			const endLineNo = replace.endLineNo ?? 1;
			assertLineRange(index, startLineNo, endLineNo, `replaces[${i}]`);
			collectLineRangeUsage(usedLines, startLineNo, endLineNo);
			const chars = rangeContentChars(index, startLineNo, endLineNo);
			searchText = text.slice(chars.start, chars.end);
			baseOffset = chars.start;
		}
		const positions = findOccurrences(searchText, replace.oldText, baseOffset);
		if (positions.length === 0)
			throw new Error(`replaces[${i}] oldText was not found.`);
		if (positions.length > 1) {
			throw new Error(
				`replaces[${i}] oldText matched multiple locations.\nSpecify targetLineNoRanges to limit where replacements apply.\nMatched lines: ${matchedLinesSummary(index, positions)}.${multipleMatchesOnSameLineWarning(index, positions)}`,
			);
		}
		const start = positions[0] ?? 0;
		edits.push({
			start,
			end: start + replace.oldText.length,
			replacement: replace.newText,
			label: `replaces[${i}]`,
		});
	}

	return edits;
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
	for (const key of ["replaces", "removeLineRanges", "insertLines"] as const) {
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
	const edits = createEdits(text, params);
	const nextText = applyTextEdits(text, edits);
	checkAbort(signal);
	await writeFile(absolute, nextText, "utf8");

	const diffResult: EditDiffResult = generateDiffString(text, nextText);
	const patch = generateUnifiedPatch(displayPath, text, nextText);
	const diffLineCount =
		diffResult.diff === "" ? 0 : diffResult.diff.split("\n").length;
	const resultSummary = `Applied ${edits.length} edit(s) to ${displayPath}.`;
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
			edits: edits.length,
			diff: diffResult.diff,
			patch,
		} satisfies ApplyPatchDetails,
	};
}
