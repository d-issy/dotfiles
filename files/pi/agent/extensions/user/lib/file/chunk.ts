import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { type Component, Text } from "@earendil-works/pi-tui";
import { type Static, Type } from "typebox";
import { ToolError } from "./errors";
import { isSecretPath } from "../secrets";
import {
	assertRepoPathAllowed,
	createFsGuardContext,
	displayRepoPath,
	isRepoPath,
	resolveRepoPath,
} from "./guard";

const READ_CHUNK_OPERATION = "Reading chunk from";
const EDIT_CHUNK_OPERATION = "Editing chunk in";
const ANCHOR_LENGTH = 3;
const DEFAULT_READ_CHUNK_LIMIT = 200;
const MAX_CONTEXT_RADIUS = 16;

const anchorSchema = Type.String({
	description:
		"Three-character anchor shown by read_chunk. Anchors are only emitted when unique in the file.",
	minLength: ANCHOR_LENGTH,
	maxLength: ANCHOR_LENGTH,
});

export const readChunkSchema = Type.Object({
	path: Type.String({ description: "Path to the file to read." }),
	offset: Type.Optional(
		Type.Number({
			description: "Line number to start reading from (1-indexed).",
		}),
	),
	limit: Type.Optional(
		Type.Number({
			description: `Maximum number of lines to read. Defaults to ${DEFAULT_READ_CHUNK_LIMIT}; pass an explicit limit to read more.`,
		}),
	),
});

export type ReadChunkToolInput = Static<typeof readChunkSchema>;

const chunkEditSchema = Type.Object(
	{
		old_range: Type.Array(anchorSchema, {
			description:
				"Inclusive [start_anchor, end_anchor] range from read_chunk output. Use the same anchor twice for a single-line edit.",
			minItems: 2,
			maxItems: 2,
		}),
		new_lines: Type.Array(Type.String(), {
			description:
				"Replacement lines for the range. Pass an empty array to delete the range. Blank lines are significant: use empty strings for intentional blank lines, and include adjacent blank lines in old_range when deleting or replacing a block so the final spacing is correct in the same edit. Do not include trailing newline characters.",
		}),
	},
	{ additionalProperties: false },
);

export const editChunkSchema = Type.Object({
	path: Type.String({ description: "Path to the file to edit." }),
	edits: Type.Array(chunkEditSchema, {
		description:
			"One or more chunk edits. All old_range anchors are resolved against the original file before any replacements are applied.",
		minItems: 1,
	}),
});

export type EditChunkToolInput = Static<typeof editChunkSchema>;

type ReadChunkDetails = {
	operation: "read_chunk";
	path: string;
	startLine: number;
	endLine: number;
	totalLines: number;
	visibleAnchors: number;
	ambiguousLines: number;
};

type EditChunkDetails = {
	operation: "edit_chunk";
	path: string;
	replacements: number;
};

type TextDocument = {
	readonly lines: readonly string[];
	readonly lineEnding: "\n" | "\r\n";
	readonly finalNewline: boolean;
};

type AnchorIndex = {
	readonly perLine: readonly (string | undefined)[];
	readonly unique: ReadonlyMap<string, number>;
	readonly ambiguousCount: number;
};

type ResolvedEdit = {
	readonly start: number;
	readonly end: number;
	readonly newLines: readonly string[];
};

function checkAbort(signal: AbortSignal | undefined, operation: string): void {
	if (signal?.aborted) throw new ToolError("aborted", operation, "");
}

function parseDocument(content: string): TextDocument {
	const lineEnding = content.includes("\r\n") ? "\r\n" : "\n";
	const normalized = content.replaceAll("\r\n", "\n");
	const finalNewline = normalized.endsWith("\n");
	const body = finalNewline ? normalized.slice(0, -1) : normalized;
	return {
		lines: body === "" ? [] : body.split("\n"),
		lineEnding,
		finalNewline,
	};
}

function serializeDocument(
	lines: readonly string[],
	lineEnding: "\n" | "\r\n",
	finalNewline: boolean,
): string {
	const body = lines.join("\n");
	const normalized = finalNewline && lines.length > 0 ? `${body}\n` : body;
	return lineEnding === "\n" ? normalized : normalized.replaceAll("\n", "\r\n");
}

function lineAnchorInput(
	lines: readonly string[],
	index: number,
	radius: number,
): string {
	const start = Math.max(0, index - radius);
	const end = Math.min(lines.length, index + radius + 1);
	const parts = [`radius:${radius}`];
	for (let lineIndex = start; lineIndex < end; lineIndex += 1) {
		if (lineIndex === index) parts.push("current-line");
		parts.push(lines[lineIndex] ?? "");
	}
	return parts.join("\u0000");
}

function anchorForLine(
	lines: readonly string[],
	index: number,
	radius: number,
): string {
	const alphabet =
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	const space = alphabet.length ** ANCHOR_LENGTH;
	let value =
		createHash("sha256")
			.update(lineAnchorInput(lines, index, radius))
			.digest()
			.readUInt32BE(0) % space;
	let anchor = "";
	for (let i = 0; i < ANCHOR_LENGTH; i += 1) {
		anchor = alphabet[value % alphabet.length] + anchor;
		value = Math.floor(value / alphabet.length);
	}
	return anchor;
}

function buildAnchorIndex(lines: readonly string[]): AnchorIndex {
	const perLine = Array<string | undefined>(lines.length).fill(undefined);
	const unique = new Map<string, number>();
	const usedAnchors = new Set<string>();
	let unresolved = new Set(lines.map((_, index) => index));

	for (let radius = 1; radius <= MAX_CONTEXT_RADIUS; radius += 1) {
		if (unresolved.size === 0) break;
		const candidates = new Map<number, string>();
		const counts = new Map<string, number>();
		for (const index of unresolved) {
			const anchor = anchorForLine(lines, index, radius);
			candidates.set(index, anchor);
			counts.set(anchor, (counts.get(anchor) ?? 0) + 1);
		}

		const nextUnresolved = new Set<number>();
		for (const index of unresolved) {
			const anchor = candidates.get(index);
			if (
				anchor === undefined ||
				counts.get(anchor) !== 1 ||
				usedAnchors.has(anchor)
			) {
				nextUnresolved.add(index);
				continue;
			}
			perLine[index] = anchor;
			unique.set(anchor, index);
			usedAnchors.add(anchor);
		}
		unresolved = nextUnresolved;
	}

	return { perLine, unique, ambiguousCount: unresolved.size };
}

function validateRange(
	offset: number | undefined,
	limit: number | undefined,
): void {
	if (offset !== undefined && (!Number.isInteger(offset) || offset < 1)) {
		throw new Error("offset must be a positive integer.");
	}
	if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
		throw new Error("limit must be a non-negative integer.");
	}
}

function resolveAnchor(anchorIndex: AnchorIndex, anchor: string): number {
	const line = anchorIndex.unique.get(anchor);
	if (line === undefined) {
		throw new Error(
			`Anchor '${anchor}' is unavailable. It may be stale, ambiguous, or not present in the file. Re-run read_chunk and use displayed anchors only.`,
		);
	}
	return line;
}

function resolveEdit(
	anchorIndex: AnchorIndex,
	edit: EditChunkToolInput["edits"][number],
): ResolvedEdit {
	const [startAnchor, endAnchor] = edit.old_range;
	const start = resolveAnchor(anchorIndex, startAnchor);
	const end = resolveAnchor(anchorIndex, endAnchor);
	if (start > end) {
		throw new Error(
			`Invalid old_range: start anchor '${startAnchor}' appears after end anchor '${endAnchor}'.`,
		);
	}
	for (const line of edit.new_lines) {
		if (line.includes("\n") || line.includes("\r")) {
			throw new Error("new_lines entries must not contain newline characters.");
		}
	}
	return { start, end, newLines: edit.new_lines };
}

function assertNonOverlapping(edits: readonly ResolvedEdit[]): void {
	for (let index = 1; index < edits.length; index += 1) {
		const previous = edits[index - 1];
		const current = edits[index];
		if (current.start <= previous.end) {
			throw new Error("edit_chunk ranges must not overlap.");
		}
	}
}

function applyResolvedEdits(
	lines: readonly string[],
	edits: readonly ResolvedEdit[],
): string[] {
	const output: string[] = [];
	let cursor = 0;
	for (const edit of edits) {
		output.push(...lines.slice(cursor, edit.start));
		output.push(...edit.newLines);
		cursor = edit.end + 1;
	}
	output.push(...lines.slice(cursor));
	return output;
}

async function readAllowedTextFile(
	cwd: string,
	path: string,
	operation: string,
	mode: number,
	options?: { readonly allowOutsideRepoWithoutAnchors?: boolean },
): Promise<{
	absolutePath: string;
	displayPath: string;
	content: string;
	anchorsEnabled: boolean;
}> {
	const absolutePath = resolveRepoPath(cwd, path, operation);
	const guardContext = await createFsGuardContext(cwd);
	const displayPath = displayRepoPath(cwd, absolutePath);
	if (isSecretPath(displayPath) || isSecretPath(absolutePath)) {
		throw new ToolError("secret", operation, displayPath);
	}

	const insideRepo = isRepoPath(guardContext, absolutePath);
	if (insideRepo || options?.allowOutsideRepoWithoutAnchors !== true) {
		await assertRepoPathAllowed(guardContext, absolutePath, operation);
	}
	await access(absolutePath, mode);
	return {
		absolutePath,
		displayPath,
		content: await readFile(absolutePath, "utf8"),
		anchorsEnabled: insideRepo,
	};
}

function formatReadChunkLineRange(
	args: Record<string, unknown>,
	theme: Theme,
): string {
	if (args.offset === undefined && args.limit === undefined) return "";
	const startLine = typeof args.offset === "number" ? args.offset : 1;
	const limit =
		typeof args.limit === "number" ? args.limit : DEFAULT_READ_CHUNK_LIMIT;
	const endLine = startLine + limit - 1;
	return theme.fg("warning", `:${startLine}-${endLine}`);
}

function renderChunkHeaderText(
	name: string,
	args: unknown,
	theme: Theme,
	context?: { readonly expanded?: boolean },
): string {
	const input = (args ?? {}) as Record<string, unknown>;
	const path = typeof input.path === "string" ? input.path : "";
	let text = theme.fg("toolTitle", theme.bold(name));
	if (path) text += ` ${theme.fg("accent", path)}`;
	if (name === "read_chunk") {
		text += formatReadChunkLineRange(input, theme);
		if (!(context?.expanded ?? false)) {
			text += theme.fg("dim", " (ctrl+o to expand)");
		}
	}
	return text;
}

function renderChunkHeader(
	name: string,
	args: unknown,
	theme: Theme,
	context?: { readonly expanded?: boolean },
): Component {
	return new Text(renderChunkHeaderText(name, args, theme, context), 0, 0);
}

export function renderReadChunk(
	args: unknown,
	theme: Theme,
	context?: { readonly expanded?: boolean },
): Component {
	return renderChunkHeader("read_chunk", args, theme, context);
}

function renderToolResultText(
	result: AgentToolResult<ReadChunkDetails>,
	theme: Theme,
): Component {
	const text = result.content
		.filter((content) => content.type === "text")
		.map((content) => content.text)
		.join("\n");
	return new Text(theme.fg("toolOutput", text || "(no output)"), 0, 0);
}

function isReadChunkDetails(details: unknown): details is ReadChunkDetails {
	if (typeof details !== "object" || details === null) return false;
	const value = details as Record<string, unknown>;
	return (
		value.operation === "read_chunk" &&
		typeof value.path === "string" &&
		typeof value.startLine === "number" &&
		typeof value.endLine === "number" &&
		typeof value.totalLines === "number" &&
		typeof value.visibleAnchors === "number" &&
		typeof value.ambiguousLines === "number"
	);
}

export function renderReadChunkResult(
	result: AgentToolResult<ReadChunkDetails>,
	options: { expanded: boolean; isPartial: boolean },
	theme: Theme,
): Component {
	if (options.expanded) return renderToolResultText(result, theme);

	const details = result.details;
	if (!isReadChunkDetails(details)) return renderToolResultText(result, theme);

	const summaryParts = [`${details.visibleAnchors} visible anchor(s)`];
	if (details.ambiguousLines > 0) {
		summaryParts.push(`${details.ambiguousLines} ambiguous line(s)`);
	}
	return new Text(theme.fg("muted", summaryParts.join(". ")), 0, 0);
}

function renderEditChunkParams(args: unknown, theme: Theme): string[] {
	const input = (args ?? {}) as Record<string, unknown>;
	if (!Array.isArray(input.edits)) return [];
	return input.edits.map((edit) => {
		const chunkEdit = edit as Record<string, unknown>;
		return theme.fg(
			"toolOutput",
			JSON.stringify({
				old_range: chunkEdit.old_range,
				new_lines: chunkEdit.new_lines,
			}),
		);
	});
}

export function renderEditChunk(
	args: unknown,
	theme: Theme,
	context?: { readonly expanded?: boolean },
): Component {
	const header = renderChunkHeaderText("edit_chunk", args, theme, context);
	if (!(context?.expanded ?? false)) return new Text(header, 0, 0);

	const params = renderEditChunkParams(args, theme);
	if (params.length === 0) return new Text(header, 0, 0);
	return new Text(`${header}\n${params.join("\n")}`, 0, 0);
}

export async function executeReadChunk(
	cwd: string,
	params: ReadChunkToolInput,
	signal: AbortSignal | undefined,
): Promise<AgentToolResult<ReadChunkDetails>> {
	checkAbort(signal, READ_CHUNK_OPERATION);
	validateRange(params.offset, params.limit);
	const { displayPath, content, anchorsEnabled } = await readAllowedTextFile(
		cwd,
		params.path,
		READ_CHUNK_OPERATION,
		constants.R_OK,
		{ allowOutsideRepoWithoutAnchors: true },
	);
	checkAbort(signal, READ_CHUNK_OPERATION);

	const document = parseDocument(content);
	const anchors = anchorsEnabled ? buildAnchorIndex(document.lines) : undefined;
	const start = Math.min((params.offset ?? 1) - 1, document.lines.length);
	const limit = params.limit ?? DEFAULT_READ_CHUNK_LIMIT;
	const endExclusive = Math.min(document.lines.length, start + limit);
	const lines = document.lines.slice(start, endExclusive);
	const lineNumberWidth = String(document.lines.length).length;
	const output = lines.map((line, index) => {
		const lineNumber = String(start + index + 1).padStart(lineNumberWidth);
		if (!anchorsEnabled) return `${lineNumber} | ${line}`;
		const anchor = anchors?.perLine[start + index] ?? "---";
		return `${lineNumber} @${anchor} | ${line}`;
	});
	const visibleAnchors = anchorsEnabled
		? lines.filter((_, index) => anchors?.perLine[start + index] !== undefined)
				.length
		: 0;
	const header = [
		`${displayPath}`,
		anchorsEnabled
			? `Anchors are ${ANCHOR_LENGTH}-character tokens shown after line numbers. Only file-wide unique anchors are shown; @--- lines cannot be used as old_range endpoints.`
			: "Anchors are disabled for files outside the repository; edit_chunk cannot use this output.",
		`Use edit_chunk with edits: [{ old_range: ["start", "end"], new_lines: [...] }]. Use the same anchor twice for one line.`,
		`Showing ${lines.length} of ${document.lines.length} line(s).`,
	];
	const continuation =
		endExclusive < document.lines.length
			? [
					"",
					`[${document.lines.length - endExclusive} more lines in file. Use offset=${endExclusive + 1} to continue, or use grep to find the relevant lines first.]`,
				]
			: [];

	return {
		content: [
			{
				type: "text",
				text: [...header, ...output, ...continuation].join("\n"),
			},
		],
		details: {
			operation: "read_chunk",
			path: displayPath,
			startLine: start + 1,
			endLine: endExclusive,
			totalLines: document.lines.length,
			visibleAnchors,
			ambiguousLines: anchors?.ambiguousCount ?? 0,
		} satisfies ReadChunkDetails,
	};
}

export async function executeEditChunk(
	cwd: string,
	params: EditChunkToolInput,
	signal: AbortSignal | undefined,
): Promise<AgentToolResult<EditChunkDetails>> {
	checkAbort(signal, EDIT_CHUNK_OPERATION);
	const { absolutePath, displayPath } = await readAllowedTextFile(
		cwd,
		params.path,
		EDIT_CHUNK_OPERATION,
		constants.R_OK | constants.W_OK,
	);
	if (params.edits.length === 0) {
		throw new ToolError("missing_input", EDIT_CHUNK_OPERATION, "edit");
	}

	return withFileMutationQueue(absolutePath, async () => {
		checkAbort(signal, EDIT_CHUNK_OPERATION);
		const latestContent = await readFile(absolutePath, "utf8");
		const document = parseDocument(latestContent);
		const anchors = buildAnchorIndex(document.lines);
		const resolved = Array.from(params.edits, (edit) =>
			resolveEdit(anchors, edit),
		);
		resolved.sort((a, b) => a.start - b.start);
		assertNonOverlapping(resolved);
		checkAbort(signal, EDIT_CHUNK_OPERATION);

		const nextLines = applyResolvedEdits(document.lines, resolved);
		const nextContent = serializeDocument(
			nextLines,
			document.lineEnding,
			document.finalNewline,
		);
		await writeFile(absolutePath, nextContent, "utf8");
		checkAbort(signal, EDIT_CHUNK_OPERATION);

		return {
			content: [
				{
					type: "text",
					text: `Successfully applied ${resolved.length} chunk edit(s) to ${displayPath}.`,
				},
			],
			details: {
				operation: "edit_chunk",
				path: displayPath,
				replacements: resolved.length,
			} satisfies EditChunkDetails,
		};
	});
}
