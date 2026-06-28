import {
	applyPatchSchema,
	executeApplyPatch,
	executeMove,
	executeRemove,
	mvSchema,
	normalizeStringOrArray,
	renderApplyPatch,
	renderApplyPatchResult,
	renderMv,
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
					"Read the target file immediately before using line-number based edits (insertLines, removeLineRanges, replaceLineRanges); after applying one, read again before another line-number based edit because line numbers may have shifted.",
					"Do not target the same line with multiple operations; overlapping line targets fail to avoid ambiguous edits.",
					"For insertLines, specify exactly one of insertAfterLineNo or insertBeforeLineNo.",
					"If replaces.oldText matches multiple locations, specify startLineNo/endLineNo or targetLineNoRanges to disambiguate.",
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
