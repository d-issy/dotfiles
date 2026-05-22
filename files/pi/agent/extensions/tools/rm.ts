import { rm as remove } from "node:fs/promises";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type Static, Type } from "typebox";
import { checkAbort, normalizeStringOrArray } from "./lib/args";
import { ToolError } from "./lib/errors";
import {
	assertNoIgnoredDescendants,
	createFsGuardContext,
	displayRepoPath,
	resolveRepoPath,
} from "./lib/fs-guard";
import { policyRegistry } from "./lib/policy";
import { renderToolHeader } from "./lib/render";

const OPERATION = "Removing";

const rmSchema = Type.Object({
	path: Type.Union(
		[Type.String(), Type.Array(Type.String(), { minItems: 1 })],
		{
			description:
				"File or directory to remove. Pass an array to remove multiple paths in one call.",
		},
	),
	recursive: Type.Optional(
		Type.Boolean({
			description:
				"Remove directories and their contents recursively. Applied to every path. Defaults to false.",
		}),
	),
});

export type RmToolInput = Static<typeof rmSchema>;

type RmToolDetails = {
	operation: "rm";
	removed: string[];
};

export default function rmTool(pi: ExtensionAPI): void {
	policyRegistry.register<RmToolInput>({
		name: "rm",
		allowedModes: ["write", "yolo"],
		extractSecretPaths: (input) => normalizeStringOrArray(input.path),
		secretBlockReason: (mode) =>
			`Removing secret files is disabled in ${mode} mode.`,
	});

	pi.registerTool({
		name: "rm",
		label: "rm",
		description: "Remove files or directories.",
		promptSnippet: "Remove files/directories",
		promptGuidelines: [
			"Use rm recursive=true only when removing a directory tree is explicitly intended.",
			"rm cannot remove files outside the repository or files ignored by .gitignore.",
			"Pass path as an array to remove multiple targets in one call; recursive applies to every path.",
			"rm errors if any path does not exist; existence is not silently ignored.",
			"rm is not atomic across multiple paths: if a later removal fails, earlier removals are not rolled back.",
		],
		parameters: rmSchema,
		executionMode: "sequential",
		renderCall(args, theme) {
			const renderArgs = args as Partial<RmToolInput> | undefined;
			const paths = normalizeStringOrArray(renderArgs?.path);
			return renderToolHeader("rm", paths, theme, {
				suffix: renderArgs?.recursive ? "(recursive)" : undefined,
			});
		},
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			checkAbort(signal, OPERATION);
			const inputs = normalizeStringOrArray(params.path);
			if (inputs.length === 0) {
				throw new ToolError("missing_input", OPERATION, "path");
			}

			const targets = inputs.map((p) => {
				const absolute = resolveRepoPath(ctx.cwd, p, OPERATION);
				return { absolute, display: displayRepoPath(ctx.cwd, absolute) };
			});

			const fsCtx = await createFsGuardContext(ctx.cwd);
			await Promise.all(
				targets.map(({ absolute }) =>
					assertNoIgnoredDescendants(fsCtx, absolute, OPERATION),
				),
			);

			const recursive = params.recursive ?? false;
			const removed = await Promise.all(
				targets.map(async ({ absolute, display }) => {
					await remove(absolute, { recursive, force: false });
					return display;
				}),
			);

			return {
				content: [
					{
						type: "text",
						text: removed.map((p) => `Removed ${p}`).join("\n"),
					},
				],
				details: {
					operation: "rm",
					removed,
				} satisfies RmToolDetails,
			};
		},
	});
}
