import {
	executeMove,
	executeRemove,
	mvSchema,
	normalizeStringOrArray,
	renderMv,
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
