import {
	editChunkSchema,
	executeEditChunk,
	executeMove,
	executeReadChunk,
	executeRemove,
	mvSchema,
	normalizeStringOrArray,
	readChunkSchema,
	renderEditChunk,
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

/**
 * Register every core user-extension tool into the provided catalog. Grouped by
 * domain so non-file tools (git, …) can be added here without touching the
 * `tool` feature.
 */
export function registerCoreUserTools(catalog: ToolCatalog): void {
	registerFileTools(catalog);
	registerGitTools(catalog);
	registerGithubTools(catalog);
	registerInterviewTools(catalog);
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
					"Edit a file by replacing anchor-delimited line chunks produced by read_chunk. Whitespace and blank lines are part of the edit: choose old_range and new_lines so the file has correct spacing after this single edit, without requiring a follow-up cleanup edit. Fails without modifying files when anchors are missing, ambiguous, reversed, or overlapping.",
				promptSnippet: "Replace line chunks using anchors from read_chunk",
				promptGuidelines: [
					"Use edit_chunk with anchors copied from read_chunk when normal edit oldText matching is likely ambiguous.",
					"For edit_chunk, pass edits: [{ old_range: [startAnchor, endAnchor], new_lines: [...] }]. Use the same anchor twice for a single-line edit.",
					"Whitespace and blank lines are part of the edit. Choose old_range and new_lines so the final file has correct spacing in the same edit.",
					"When deleting a whole block such as a function, type, const/var block, import group, or test case, include the adjacent blank line in old_range when needed so the remaining code keeps normal spacing.",
					"Do not leave doubled blank lines, and do not remove all separation between adjacent top-level declarations. Prefer deleting the trailing blank line after the removed block; if the block is at the end of a section/file, delete the preceding blank line instead.",
					"Do not use @--- as an edit_chunk anchor. If needed anchors are hidden or stale, run read_chunk again on a smaller relevant area.",
				],
				parameters: editChunkSchema,
				executionMode: "sequential",
				renderCall: renderEditChunk,
				execute: (_toolCallId, params, signal, _onUpdate, ctx) =>
					executeEditChunk(ctx.cwd, params, signal),
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
