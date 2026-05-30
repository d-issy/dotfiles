import { constants } from "node:fs";
import { access, lstat, rename, rm as remove } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import { type Component, Text } from "@earendil-works/pi-tui";
import { type Static, Type } from "typebox";
import { ToolError, isErrnoCode } from "./errors";
import {
	assertNoIgnoredDescendants,
	assertRepoPathAllowed,
	createFsGuardContext,
	displayRepoPath,
	resolveRepoPath,
} from "./guard";

const RM_OPERATION = "Removing";
const MV_OPERATION = "Moving";
const MV_OPERATION_TO = "Moving to";

export function normalizeStringOrArray(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (Array.isArray(value)) {
		return value.filter((v): v is string => typeof v === "string");
	}
	return [];
}

function checkAbort(signal: AbortSignal | undefined, operation: string): void {
	if (signal?.aborted) throw new ToolError("aborted", operation, "");
}

function renderToolHeader(
	name: string,
	paths: string[],
	theme: Theme,
	options?: { destination?: string; suffix?: string },
): Text {
	let text = theme.fg("toolTitle", theme.bold(name));
	if (paths.length === 1) {
		text += ` ${theme.fg("accent", paths[0])}`;
	} else if (paths.length > 1) {
		text += ` ${theme.fg("accent", `${paths.length} items`)}`;
	}
	if (options?.destination) {
		text += theme.fg("dim", " -> ");
		text += theme.fg("accent", options.destination);
	}
	if (options?.suffix) {
		text += theme.fg("dim", ` ${options.suffix}`);
	}
	return new Text(text, 0, 0);
}

export const rmSchema = Type.Object({
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

export const mvSchema = Type.Object({
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
	destinationAbsolute: string,
): Promise<void> {
	const display = displayRepoPath(cwd, destinationAbsolute);
	let stat;
	try {
		stat = await lstat(destinationAbsolute);
	} catch (error) {
		if (isErrnoCode(error, "ENOENT")) {
			throw new ToolError(
				"destination_not_directory",
				MV_OPERATION_TO,
				display,
			);
		}
		throw error;
	}
	if (!stat.isDirectory()) {
		throw new ToolError("destination_not_directory", MV_OPERATION_TO, display);
	}
}

export function renderRm(args: RmToolInput, theme: Theme): Component {
	const renderArgs = args as Partial<RmToolInput> | undefined;
	const paths = normalizeStringOrArray(renderArgs?.path);
	return renderToolHeader("rm", paths, theme, {
		suffix: renderArgs?.recursive ? "(recursive)" : undefined,
	});
}

export async function executeRemove(
	cwd: string,
	params: RmToolInput,
	signal: AbortSignal | undefined,
): Promise<AgentToolResult<RmToolDetails>> {
	checkAbort(signal, RM_OPERATION);
	const inputs = normalizeStringOrArray(params.path);
	if (inputs.length === 0) {
		throw new ToolError("missing_input", RM_OPERATION, "path");
	}

	const targets = inputs.map((p) => {
		const absolute = resolveRepoPath(cwd, p, RM_OPERATION);
		return { absolute, display: displayRepoPath(cwd, absolute) };
	});

	const guardContext = await createFsGuardContext(cwd);
	await Promise.all(
		targets.map(({ absolute }) =>
			assertNoIgnoredDescendants(guardContext, absolute, RM_OPERATION),
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
}

export function renderMv(args: MvToolInput, theme: Theme): Component {
	const renderArgs = args as Partial<MvToolInput> | undefined;
	const sources = normalizeStringOrArray(renderArgs?.source);
	const destination =
		typeof renderArgs?.destination === "string"
			? renderArgs.destination
			: undefined;
	return renderToolHeader("mv", sources, theme, { destination });
}

export async function executeMove(
	cwd: string,
	params: MvToolInput,
	signal: AbortSignal | undefined,
): Promise<AgentToolResult<MvToolDetails>> {
	checkAbort(signal, MV_OPERATION);
	const sources = normalizeStringOrArray(params.source);
	if (sources.length === 0) {
		throw new ToolError("missing_input", MV_OPERATION, "source");
	}
	const guardContext = await createFsGuardContext(cwd);
	const destinationAbsolute = resolveRepoPath(
		cwd,
		params.destination,
		MV_OPERATION_TO,
	);
	await assertRepoPathAllowed(guardContext, destinationAbsolute, MV_OPERATION_TO);

	const moves: { source: string; destination: string }[] = [];

	if (sources.length === 1) {
		const sourceAbsolute = resolveRepoPath(cwd, sources[0], MV_OPERATION);
		moves.push({ source: sourceAbsolute, destination: destinationAbsolute });
	} else {
		await assertDestinationIsDirectory(cwd, destinationAbsolute);
		for (const s of sources) {
			const sourceAbsolute = resolveRepoPath(cwd, s, MV_OPERATION);
			const target = resolve(destinationAbsolute, basename(sourceAbsolute));
			moves.push({ source: sourceAbsolute, destination: target });
		}
	}

	await Promise.all(
		moves.map(async ({ source, destination }) => {
			await assertNoIgnoredDescendants(guardContext, source, MV_OPERATION);
			await assertRepoPathAllowed(guardContext, destination, MV_OPERATION_TO);
			if (await destinationExists(destination)) {
				throw new ToolError(
					"destination_exists",
					MV_OPERATION_TO,
					displayRepoPath(cwd, destination),
				);
			}
		}),
	);

	const results = await Promise.all(
		moves.map(async ({ source, destination }) => {
			await rename(source, destination);
			return {
				source: displayRepoPath(cwd, source),
				destination: displayRepoPath(cwd, destination),
			};
		}),
	);

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
}
