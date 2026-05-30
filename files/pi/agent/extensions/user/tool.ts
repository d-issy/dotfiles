import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Feature } from "./lib/feature";
import {
	type MvToolInput,
	type RmToolInput,
	executeMove,
	executeRemove,
	mvSchema,
	normalizeStringOrArray,
	renderMv,
	renderRm,
	rmSchema,
} from "./lib/file";
import { policyRegistry, secretActionReason } from "./lib/policy";

/**
 * A single agent tool exposed to pi: its permission policy plus the pi tool
 * registration. Mirrors {@link Feature}, one level down — a Feature wires a
 * subsystem, a Tool wires one callable tool.
 */
interface Tool {
	/** Identifier for logging / ordering; not surfaced in pi's UI. */
	readonly name: string;
	/** Register this tool's policy and definition against pi. */
	register(pi: ExtensionAPI): void;
}

const mvTool = {
	name: "mv",
	register(pi) {
		policyRegistry.register<MvToolInput>({
			name: "mv",
			allowedModes: ["write", "yolo"],
			extractSecretPaths: (input) => [
				...normalizeStringOrArray(input.source),
				input.destination,
			],
			secretBlockReason: secretActionReason("Moving"),
		});

		pi.registerTool({
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
		});
	},
} satisfies Tool;

const rmTool = {
	name: "rm",
	register(pi) {
		policyRegistry.register<RmToolInput>({
			name: "rm",
			allowedModes: ["write", "yolo"],
			extractSecretPaths: (input) => normalizeStringOrArray(input.path),
			secretBlockReason: secretActionReason("Removing"),
		});

		pi.registerTool({
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
		});
	},
} satisfies Tool;

const tools: readonly Tool[] = [mvTool, rmTool];

function register(pi: ExtensionAPI): void {
	for (const tool of tools) tool.register(pi);
}

export default { name: "file-tools", register } satisfies Feature;
