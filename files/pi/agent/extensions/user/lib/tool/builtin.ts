import {
	applyPatchSchema,
	editChunkSchema,
	executeApplyPatch,
	executeEditChunk,
	executeMove,
	executeReadChunk,
	executeRemove,
	mvSchema,
	normalizeStringOrArray,
	readChunkSchema,
	renderApplyPatch,
	renderApplyPatchResult,
	renderEditChunk,
	renderEditChunkResult,
	renderMv,
	renderReadChunk,
	renderReadChunkResult,
	renderRm,
	rmSchema,
} from "../file";
import { makeSecretActionReason } from "../policy";
import { type ToolCatalog, defineToolContribution } from "./catalog";
import { registerGitTools } from "./git";
import { registerGithubTools } from "./github";
import { registerInterviewTools } from "./interview";
import { type SpawnableFocus, registerSubagentTool } from "./subagent";

export type RegisterCoreUserToolsOptions = {
	/** Focuses the subagent tool may launch (used to build the `focus` enum). */
	readonly spawnableFocuses?: readonly SpawnableFocus[];
};

/**
 * Register every core user-extension tool into the provided catalog. Grouped by
 * domain so non-file tools (git, …) can be added here without touching the
 * `tool` feature.
 */
export function registerCoreUserTools(
	catalog: ToolCatalog,
	options?: RegisterCoreUserToolsOptions,
): void {
	registerFileTools(catalog);
	registerGitTools(catalog);
	registerGithubTools(catalog);
	registerInterviewTools(catalog);
	registerSubagentTool(catalog, options?.spawnableFocuses);
}

function registerFileTools(catalog: ToolCatalog): void {
	catalog.register(
		defineToolContribution({
			policy: {
				name: "read_chunk",
				extractSecretPaths: (input) => [input.path],
				secretBlockReason: makeSecretActionReason("Reading chunk from"),
			},
			definition: {
				name: "read_chunk",
				label: "read_chunk",
				description:
					"Read up to 200 file lines by default with 3-character per-line anchors for later chunk edits. Pass offset and limit explicitly for large files or other ranges. Ambiguous anchors are hidden as @--- and cannot be used for editing.",
				promptSnippet:
					"Read file lines with short unique anchors for edit_chunk",
				promptGuidelines: [
					"Use read_chunk before edit_chunk when exact oldText replacement would be ambiguous or wasteful.",
					"read_chunk defaults to the first 200 lines. For large files, pass offset and limit to read only the relevant range.",
					"read_chunk shows @--- for ambiguous lines; do not use @--- as an edit_chunk old_range endpoint.",
				],
				parameters: readChunkSchema,
				executionMode: "parallel",
				renderCall: renderReadChunk,
				renderResult: renderReadChunkResult,
				execute: (_toolCallId, params, signal, _onUpdate, ctx) =>
					executeReadChunk(ctx.cwd, params, signal),
			},
		}),
	);

	catalog.register(
		defineToolContribution({
			policy: {
				name: "edit_chunk",
				extractSecretPaths: (input) => [input.path],
				secretBlockReason: makeSecretActionReason("Editing chunk in"),
			},
			definition: {
				name: "edit_chunk",
				label: "edit_chunk",
				description:
					"Edit a file by replacing anchor-delimited whole-line ranges produced by read_chunk. Each old_range endpoint is included: the complete start-anchor line, complete end-anchor line, and every line between them are replaced by new_lines. Anchors are not insertion points; to insert before or after a line, replace an adjacent line and include that original line plus the inserted lines in new_lines. Whitespace and blank lines are part of the edit: choose old_range and new_lines so the file has correct spacing after this single edit, without requiring a follow-up cleanup edit. Fails without modifying files when anchors are missing, ambiguous, reversed, or overlapping.",
				promptSnippet: "Replace line chunks using anchors from read_chunk",
				promptGuidelines: [
					"Use anchors copied from read_chunk; use the same anchor twice to replace that one entire line.",
					"old_range is an inclusive whole-line range, and new_lines is its exact replacement. Nothing inside old_range is preserved unless you copy it into new_lines. For deletions, use []; include only the lines intended for removal in old_range.",
					"To insert new lines, replace a nearby existing line and include that original line plus the inserted lines in new_lines.",
					"Use only visible unique anchors. If needed anchors are hidden as @--- or stale, run read_chunk again on a smaller relevant area.",
				],
				parameters: editChunkSchema,
				executionMode: "sequential",
				renderCall: renderEditChunk,
				renderResult: renderEditChunkResult,
				execute: (_toolCallId, params, signal, _onUpdate, ctx) =>
					executeEditChunk(ctx.cwd, params, signal),
			},
		}),
	);

	catalog.register(
		defineToolContribution({
			policy: {
				name: "apply_patch",
				extractSecretPaths: (input) => [input.path],
				secretBlockReason: makeSecretActionReason("Applying patch to"),
			},
			definition: {
				name: "apply_patch",
				label: "apply_patch",
				description:
					"Apply one or more edits to a single file using pre-edit 1-based line numbers and/or text replacement. Supports replaces, removeLineRanges, insertLines, and replaceLineRanges in one call.",
				promptSnippet: "Apply multiple edits to one file",
				promptGuidelines: [
					"Use path plus one or more operation arrays: replaces, removeLineRanges, insertLines, replaceLineRanges.",
					"All line numbers are 1-based and refer to the file before any edits in this call are applied.",
					"Do not target the same line with multiple operations; overlapping line targets fail to avoid ambiguous edits.",
					"For insertLines, specify exactly one of insertAfterLineNo or insertBeforeLineNo.",
					"If replaces.oldText matches multiple ranges, specify startLineNo and endLineNo to disambiguate.",
				],
				parameters: applyPatchSchema,
				executionMode: "sequential",
				renderCall: renderApplyPatch,
				renderResult: renderApplyPatchResult,
				execute: (_toolCallId, params, signal, _onUpdate, ctx) =>
					executeApplyPatch(ctx.cwd, params, signal),
			},
		}),
	);

	catalog.register(
		defineToolContribution({
			policy: {
				name: "mv",
				extractSecretPaths: (input) => [
					...normalizeStringOrArray(input.source),
					input.destination,
				],
				secretBlockReason: makeSecretActionReason("Moving"),
			},
			definition: {
				name: "mv",
				label: "mv",
				description: "Move or rename files or directories.",
				promptSnippet: "Move or rename files/directories",
				promptGuidelines: [
					"Cannot move paths outside the repo or ignored by .gitignore.",
					"Pass an array of sources to move several at once; destination must be an existing directory and each lands at destination/<basename>.",
					"Not atomic: if one move fails, earlier moves are not rolled back.",
				],
				parameters: mvSchema,
				executionMode: "sequential",
				renderCall: renderMv,
				execute: (_toolCallId, params, signal, _onUpdate, ctx) =>
					executeMove(ctx.cwd, params, signal),
			},
		}),
	);

	catalog.register(
		defineToolContribution({
			policy: {
				name: "rm",
				extractSecretPaths: (input) => normalizeStringOrArray(input.path),
				secretBlockReason: makeSecretActionReason("Removing"),
			},
			definition: {
				name: "rm",
				label: "rm",
				description: "Remove files or directories.",
				promptSnippet: "Remove files/directories",
				promptGuidelines: [
					"Set recursive=true only to delete a directory and its contents.",
					"Cannot delete paths outside the repo or ignored by .gitignore.",
					"Pass an array of paths to delete several at once; recursive applies to all.",
					"Fails if any path is missing.",
					"Not atomic: if one deletion fails, earlier ones are not rolled back.",
				],
				parameters: rmSchema,
				executionMode: "sequential",
				renderCall: renderRm,
				execute: (_toolCallId, params, signal, _onUpdate, ctx) =>
					executeRemove(ctx.cwd, params, signal),
			},
		}),
	);
}
