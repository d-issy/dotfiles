import { constants } from "node:fs";
import { access, lstat, rename } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type Static, Type } from "typebox";
import { checkAbort, normalizeStringOrArray } from "./lib/args.js";
import { ToolError, isErrnoCode } from "./lib/errors.js";
import {
	assertNoIgnoredDescendants,
	assertRepoPathAllowed,
	createFsGuardContext,
	displayRepoPath,
	resolveRepoPath,
} from "./lib/fs-guard.js";
import { policyRegistry } from "./lib/policy.js";
import { renderToolHeader } from "./lib/render.js";

const OPERATION = "Moving";
const OPERATION_TO = "Moving to";

const mvSchema = Type.Object({
	source: Type.Union(
		[Type.String(), Type.Array(Type.String(), { minItems: 1 })],
		{
			description:
				"File or directory to move/rename. Pass an array to move multiple sources into an existing destination directory.",
		},
	),
	destination: Type.String({
		description:
			"Destination path. For a single source this is the new path. For multiple sources this must be an existing directory.",
	}),
});

export type MvToolInput = Static<typeof mvSchema>;

type MvToolDetails = {
	operation: "mv";
	moves: { source: string; destination: string }[];
};

async function destinationExists(path: string): Promise<boolean> {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

async function assertDestinationIsDirectory(
	cwd: string,
	destinationAbs: string,
): Promise<void> {
	const display = displayRepoPath(cwd, destinationAbs);
	let stat;
	try {
		stat = await lstat(destinationAbs);
	} catch (error) {
		if (isErrnoCode(error, "ENOENT")) {
			throw new ToolError("destination_not_directory", OPERATION_TO, display);
		}
		throw error;
	}
	if (!stat.isDirectory()) {
		throw new ToolError("destination_not_directory", OPERATION_TO, display);
	}
}

export default function mvTool(pi: ExtensionAPI): void {
	policyRegistry.register<MvToolInput>({
		name: "mv",
		allowedModes: ["write", "yolo"],
		extractSecretPaths: (input) => [
			...normalizeStringOrArray(input.source),
			input.destination,
		],
		secretBlockReason: (mode) =>
			`Moving secret files is disabled in ${mode} mode.`,
	});

	pi.registerTool({
		name: "mv",
		label: "mv",
		description: "Move or rename files or directories.",
		promptSnippet: "Move or rename files/directories",
		promptGuidelines: [
			"mv cannot move files outside the repository or files ignored by .gitignore.",
			"Pass source as an array to move multiple files; destination must then be an existing directory and each source lands at destination/basename(source).",
			"mv is not atomic across multiple sources: if a later move fails, earlier moves are not rolled back.",
		],
		parameters: mvSchema,
		executionMode: "sequential",
		renderCall(args, theme) {
			const renderArgs = args as Partial<MvToolInput> | undefined;
			const sources = normalizeStringOrArray(renderArgs?.source);
			const destination =
				typeof renderArgs?.destination === "string"
					? renderArgs.destination
					: undefined;
			return renderToolHeader("mv", sources, theme, { destination });
		},
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			checkAbort(signal, OPERATION);
			const sources = normalizeStringOrArray(params.source);
			if (sources.length === 0) {
				throw new ToolError("missing_input", OPERATION, "source");
			}
			const fsCtx = await createFsGuardContext(ctx.cwd);
			const destinationAbs = resolveRepoPath(
				ctx.cwd,
				params.destination,
				OPERATION_TO,
			);
			await assertRepoPathAllowed(fsCtx, destinationAbs, OPERATION_TO);

			const moves: { source: string; destination: string }[] = [];

			if (sources.length === 1) {
				const sourceAbs = resolveRepoPath(ctx.cwd, sources[0], OPERATION);
				moves.push({ source: sourceAbs, destination: destinationAbs });
			} else {
				await assertDestinationIsDirectory(ctx.cwd, destinationAbs);
				for (const s of sources) {
					const sourceAbs = resolveRepoPath(ctx.cwd, s, OPERATION);
					const target = resolve(destinationAbs, basename(sourceAbs));
					moves.push({ source: sourceAbs, destination: target });
				}
			}

			for (const { source, destination } of moves) {
				await assertNoIgnoredDescendants(fsCtx, source, OPERATION);
				await assertRepoPathAllowed(fsCtx, destination, OPERATION_TO);
				if (await destinationExists(destination)) {
					throw new ToolError(
						"destination_exists",
						OPERATION_TO,
						displayRepoPath(ctx.cwd, destination),
					);
				}
			}

			const results: { source: string; destination: string }[] = [];
			for (const { source, destination } of moves) {
				await rename(source, destination);
				results.push({
					source: displayRepoPath(ctx.cwd, source),
					destination: displayRepoPath(ctx.cwd, destination),
				});
			}

			return {
				content: [
					{
						type: "text",
						text: results
							.map((r) => `Moved ${r.source} -> ${r.destination}`)
							.join("\n"),
					},
				],
				details: {
					operation: "mv",
					moves: results,
				} satisfies MvToolDetails,
			};
		},
	});
}
