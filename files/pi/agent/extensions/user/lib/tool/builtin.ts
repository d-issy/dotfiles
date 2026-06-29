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
import { type SpawnableFocus, registerAgentTool } from "./agent";

export type RegisterCoreUserToolsOptions = {
	/** Focuses the agent tool may launch (used to build the `focus` enum). */
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
	registerAgentTool(catalog, options?.spawnableFocuses);
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
					"Apply one or more edits to a single file using pre-edit 1-based line numbers and/or exact text replacement. Supports replaces, removeLineRanges, and insertLines in one call.",
				promptSnippet: "Apply multiple edits to one file",
				promptGuidelines: [
					"Use path plus the operation array that matches the edit: replaces for changing existing text, removeLineRanges for deleting whole lines, and insertLines for adding lines.",
					"Prefer the operation that states the intent directly so the tool can validate the edit and avoid ambiguous text matches.",
					"Use 1-based line numbers from the file as it existed before this apply_patch call.",
					"Read the target file immediately before line-number based edits; after applying one patch, read again before another line-number based patch because line numbers may have shifted.",
					"Keep non-replace operations on separate lines: removeLineRanges and insertLines reserve their target lines so overlapping edits fail instead of guessing order.",
					"For insertLines, choose exactly one insertion point: insertAfterLineNo or insertBeforeLineNo.",
					"For replaces, oldText must match exactly, including whitespace and newlines.",
					"When line numbers can make a replacement unambiguous, prefer allowedReplacementLineRanges with concise oldText and the smallest suitable line ranges; avoid broad ranges such as the whole file.",
					"When the same line contains multiple oldText matches, make oldText wider (for example the full line or surrounding phrase) because line ranges cannot choose between matches on one line.",
					"Multiple replaces run in order on temporary text before the file is written, so a later replace can match text produced by an earlier replace and any failure leaves the file unchanged.",
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
