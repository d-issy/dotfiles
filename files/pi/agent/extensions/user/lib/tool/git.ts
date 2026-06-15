import { execFile } from "node:child_process";
import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import { type Component, Text } from "@earendil-works/pi-tui";
import { type Static, Type } from "typebox";
import type { ToolPolicy } from "../policy";
import {
	type RenderableTextDetails,
	limitToolOutput,
	renderLimitedTextResult,
} from "./output";
import { defineToolContribution, toolCatalog } from "./catalog";

const GIT_TIMEOUT_MS = 30_000;
const GIT_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

const pathsSchema = Type.Optional(
	Type.Array(Type.String(), {
		description: "Optional pathspecs to limit the git query.",
	}),
);

const revisionRangeSchema = Type.Optional(
	Type.String({
		description: "Optional revision or range, e.g. HEAD, main, or main...HEAD.",
	}),
);

const revisionSchema = Type.String({
	description: "Revision, commit, tag, branch, or range to inspect.",
});

const lineLimitSchema = Type.Optional(
	Type.Number({
		description: "Maximum output lines to return. Defaults to 2000.",
	}),
);

const diffModeSchema = Type.Optional(
	Type.Union([Type.Literal("stat"), Type.Literal("patch")], {
		description:
			"Output detail level. stat lists changed files and change sizes; patch includes diff hunks. Defaults to stat.",
	}),
);

const gitStatusSchema = Type.Object({});

type GitStatusInput = Static<typeof gitStatusSchema>;

const gitDiffSchema = Type.Object({
	cached: Type.Optional(
		Type.Boolean({ description: "Show staged changes. Defaults to false." }),
	),
	revisionRange: revisionRangeSchema,
	paths: pathsSchema,
	mode: diffModeSchema,
	context: Type.Optional(
		Type.Number({
			description:
				"Number of context lines for patch output. Omit to use git's default.",
		}),
	),
	limit: lineLimitSchema,
});

type GitDiffInput = Static<typeof gitDiffSchema>;

const gitLogSchema = Type.Object({
	revisionRange: revisionRangeSchema,
	paths: pathsSchema,
	maxCount: Type.Optional(
		Type.Number({
			description: "Maximum number of commits to show. Defaults to 20.",
		}),
	),
	oneline: Type.Optional(
		Type.Boolean({
			description: "Use compact one-line output. Defaults to true.",
		}),
	),
	limit: lineLimitSchema,
});

type GitLogInput = Static<typeof gitLogSchema>;

const gitShowSchema = Type.Object({
	revision: revisionSchema,
	paths: pathsSchema,
	mode: diffModeSchema,
	context: Type.Optional(
		Type.Number({
			description:
				"Number of context lines for patch output. Omit to use git's default.",
		}),
	),
	limit: lineLimitSchema,
});

type GitShowInput = Static<typeof gitShowSchema>;

const gitBranchSchema = Type.Object({
	all: Type.Optional(
		Type.Boolean({
			description: "List local and remote branches. Defaults to true.",
		}),
	),
	verbose: Type.Optional(
		Type.Boolean({
			description: "Show verbose branch details. Defaults to true.",
		}),
	),
	contains: Type.Optional(
		Type.String({ description: "Show branches containing this commit." }),
	),
	limit: lineLimitSchema,
});

type GitBranchInput = Static<typeof gitBranchSchema>;

const gitLsFilesSchema = Type.Object({
	paths: pathsSchema,
	modified: Type.Optional(
		Type.Boolean({ description: "Show modified tracked files." }),
	),
	deleted: Type.Optional(
		Type.Boolean({ description: "Show deleted tracked files." }),
	),
	others: Type.Optional(
		Type.Boolean({ description: "Show untracked, non-ignored files." }),
	),
	limit: lineLimitSchema,
});

type GitLsFilesInput = Static<typeof gitLsFilesSchema>;

const gitGrepSchema = Type.Object({
	pattern: Type.String({ description: "Pattern to search for." }),
	paths: pathsSchema,
	ignoreCase: Type.Optional(
		Type.Boolean({ description: "Case-insensitive search." }),
	),
	literal: Type.Optional(
		Type.Boolean({ description: "Treat the pattern as a fixed string." }),
	),
	context: Type.Optional(
		Type.Number({
			description: "Number of context lines before and after matches.",
		}),
	),
	maxCount: Type.Optional(
		Type.Number({ description: "Maximum matches per file." }),
	),
	limit: lineLimitSchema,
});

type GitGrepInput = Static<typeof gitGrepSchema>;

const gitBlameSchema = Type.Object({
	path: Type.String({ description: "File path to blame." }),
	revision: Type.Optional(
		Type.String({
			description: "Optional revision to blame from. Defaults to HEAD.",
		}),
	),
	startLine: Type.Optional(
		Type.Number({ description: "First line to blame." }),
	),
	endLine: Type.Optional(Type.Number({ description: "Last line to blame." })),
	limit: lineLimitSchema,
});

type GitBlameInput = Static<typeof gitBlameSchema>;

type GitToolDetails = RenderableTextDetails & {
	readonly command: string;
	readonly exitCode: number | null;
	readonly stdout: string;
	readonly stderr: string;
};

type ExecResult = {
	readonly exitCode: number | null;
	readonly stdout: string;
	readonly stderr: string;
};

function renderGitCall(name: string, args: unknown, theme: Theme): Component {
	const record =
		typeof args === "object" && args !== null && !Array.isArray(args)
			? (args as Record<string, unknown>)
			: {};
	const params = Object.entries(record)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => `${key}=${formatParam(value)}`)
		.join(", ");
	const suffix = params ? theme.fg("dim", ` (${params})`) : "";
	return new Text(`${theme.fg("toolTitle", theme.bold(name))}${suffix}`, 0, 0);
}

function formatParam(value: unknown): string {
	if (Array.isArray(value)) return `[${value.join(", ")}]`;
	return String(value);
}

function shellQuote(value: string): string {
	return value === "" || /[^A-Za-z0-9_./:=@%+-]/u.test(value)
		? `'${value.replaceAll("'", `'"'"'`)}'`
		: value;
}

function commandText(args: readonly string[]): string {
	return ["git", ...args].map(shellQuote).join(" ");
}

function validateRevision(value: string | undefined, field: string): void {
	if (value === undefined) return;
	if (value.trim() === "") throw new Error(`${field} must not be empty.`);
	if (value.startsWith("-"))
		throw new Error(`${field} must not start with '-'.`);
}

function positiveInteger(
	value: number | undefined,
	field: string,
	options?: { defaultValue?: number; max?: number },
): number | undefined {
	if (value === undefined) return options?.defaultValue;
	if (!Number.isInteger(value) || value < 1) {
		throw new Error(`${field} must be a positive integer.`);
	}
	if (options?.max !== undefined && value > options.max) return options.max;
	return value;
}

function appendPathspecs(
	args: string[],
	paths: readonly string[] | undefined,
): void {
	if (!paths || paths.length === 0) return;
	args.push("--", ...paths);
}

async function execGit(
	cwd: string,
	args: readonly string[],
	signal: AbortSignal | undefined,
): Promise<ExecResult> {
	return await new Promise((resolve) => {
		execFile(
			"git",
			args,
			{
				cwd,
				env: { ...process.env, GIT_PAGER: "cat" },
				maxBuffer: GIT_MAX_BUFFER_BYTES,
				timeout: GIT_TIMEOUT_MS,
				signal,
			},
			(error, stdout, stderr) => {
				const exitCode = error && "code" in error ? Number(error.code) : 0;
				resolve({
					exitCode: Number.isNaN(exitCode) ? null : exitCode,
					stdout: String(stdout),
					stderr: String(stderr),
				});
			},
		);
	});
}

async function runGitTool(
	cwd: string,
	args: readonly string[],
	signal: AbortSignal | undefined,
	options?: {
		allowedExitCodes?: readonly number[];
		emptyMessage?: string;
		lineLimit?: number;
		hint?: string;
		fileName?: string;
	},
): Promise<AgentToolResult<GitToolDetails>> {
	const startedAt = Date.now();
	const result = await execGit(cwd, ["--no-pager", ...args], signal);
	const durationMs = Date.now() - startedAt;
	const allowed = options?.allowedExitCodes ?? [0];
	if (result.exitCode === null || !allowed.includes(result.exitCode)) {
		throw new Error(
			result.stderr.trim() ||
				`git command failed with exit code ${String(result.exitCode)}`,
		);
	}

	const fullOutput = [result.stdout.trimEnd(), result.stderr.trimEnd()]
		.filter(Boolean)
		.join("\n");
	const output = await limitToolOutput(fullOutput, {
		tempPrefix: "pi-git-tool",
		fileName: options?.fileName ?? "output.txt",
		lineLimit: options?.lineLimit,
		emptyMessage: options?.emptyMessage,
		hint: options?.hint,
	});
	return {
		content: [{ type: "text", text: output.text }],
		details: {
			command: commandText(["--no-pager", ...args]),
			exitCode: result.exitCode,
			durationMs,
			stdout: output.output,
			stderr: "",
			output: output.output,
			truncated: output.truncated,
			truncation: output.truncation,
			fullOutputPath: output.fullOutputPath,
		},
	};
}

function lineLimitFromInput(
	input: Record<string, unknown>,
): number | undefined {
	return positiveInteger(
		typeof input.limit === "number" ? input.limit : undefined,
		"limit",
	);
}

const DIFF_TRUNCATION_HINT =
	"Narrow large diffs with paths, or use mode=patch with context=0 to locate changed lines before reading surrounding code.";

function registerGitTool<TInput extends object>(config: {
	readonly name: string;
	readonly label: string;
	readonly description: string;
	readonly parameters: Parameters<
		typeof toolCatalog.register
	>[0]["definition"]["parameters"];
	readonly promptSnippet: string;
	readonly buildArgs: (params: TInput) => string[];
	readonly allowedExitCodes?: readonly number[];
	readonly emptyMessage?: string;
	readonly hint?: string;
	readonly outputFileName?: string;
	readonly extractSecretPaths?: (input: TInput) => readonly string[];
}): void {
	toolCatalog.register(
		defineToolContribution({
			policy: {
				name: config.name,
				extractSecretPaths: config.extractSecretPaths
					? (input) => config.extractSecretPaths?.(input as TInput) ?? []
					: undefined,
				notAllowedReason: (focus) =>
					`${config.name} is available only in git read-only investigation focuses, not in ${focus} focus.`,
			} satisfies ToolPolicy,
			definition: {
				name: config.name,
				label: config.label,
				description: config.description,
				promptSnippet: config.promptSnippet,
				promptGuidelines: [
					`${config.name} runs a fixed read-only git command; it must not be used for checkout, reset, commit, push, fetch, stash, clean, or config changes.`,
					"Outputs are bounded like built-in tools. If output is truncated, inspect the saved temp file with read offset/limit or retry with narrower parameters such as paths/context.",
				],
				parameters: config.parameters,
				executionMode: "parallel",
				renderCall: (args, theme) => renderGitCall(config.name, args, theme),
				renderResult: renderLimitedTextResult,
				execute: (_toolCallId, params, signal, _onUpdate, ctx) =>
					runGitTool(ctx.cwd, config.buildArgs(params as TInput), signal, {
						allowedExitCodes: config.allowedExitCodes,
						emptyMessage: config.emptyMessage,
						lineLimit: lineLimitFromInput(params as Record<string, unknown>),
						hint: config.hint,
						fileName: config.outputFileName,
					}),
			},
		}),
	);
}

export function registerGitTools(): void {
	registerGitTool<GitStatusInput>({
		name: "git_status",
		label: "git status",
		description: "Inspect repository status with git status --short --branch.",
		parameters: gitStatusSchema,
		promptSnippet: "Inspect git status",
		buildArgs() {
			return ["status", "--short", "--branch"];
		},
	});

	registerGitTool<GitDiffInput>({
		name: "git_diff",
		label: "git diff",
		description:
			"Inspect unstaged, staged, or revision-based diffs. Defaults to compact diffstat; use mode=patch only for detailed hunks.",
		parameters: gitDiffSchema,
		promptSnippet: "Inspect git diffs",
		hint: DIFF_TRUNCATION_HINT,
		outputFileName: "diff.txt",
		extractSecretPaths: (input) => input.paths ?? [],
		buildArgs(input) {
			if (input.cached && input.revisionRange) {
				throw new Error("cached and revisionRange cannot be combined.");
			}
			validateRevision(input.revisionRange, "revisionRange");
			const mode = input.mode ?? "stat";
			const args = ["diff", "--no-ext-diff", "--no-color"];
			if (mode === "stat") args.push("--stat");
			else {
				const context = positiveInteger(input.context, "context");
				if (context !== undefined) args.push(`--unified=${context}`);
			}
			if (input.cached) args.push("--cached");
			if (input.revisionRange) args.push(input.revisionRange);
			appendPathspecs(args, input.paths);
			return args;
		},
	});

	registerGitTool<GitLogInput>({
		name: "git_log",
		label: "git log",
		description: "Inspect commit history with bounded git log output.",
		parameters: gitLogSchema,
		promptSnippet: "Inspect git history",
		extractSecretPaths: (input) => input.paths ?? [],
		buildArgs(input) {
			validateRevision(input.revisionRange, "revisionRange");
			const maxCount = positiveInteger(input.maxCount, "maxCount", {
				defaultValue: 20,
				max: 200,
			});
			const args = ["log", "--no-color", `--max-count=${String(maxCount)}`];
			if (input.oneline ?? true) args.push("--oneline", "--decorate=short");
			if (input.revisionRange) args.push(input.revisionRange);
			appendPathspecs(args, input.paths);
			return args;
		},
	});

	registerGitTool<GitShowInput>({
		name: "git_show",
		label: "git show",
		description:
			"Inspect a git object, commit, tag, or revision. Defaults to compact diffstat; use mode=patch only for detailed hunks.",
		parameters: gitShowSchema,
		promptSnippet: "Inspect a git revision or object",
		hint: DIFF_TRUNCATION_HINT,
		outputFileName: "show.txt",
		extractSecretPaths: (input) => input.paths ?? [],
		buildArgs(input) {
			validateRevision(input.revision, "revision");
			const mode = input.mode ?? "stat";
			const args = ["show", "--no-color"];
			if (mode === "stat") args.push("--stat");
			else {
				const context = positiveInteger(input.context, "context");
				if (context !== undefined) args.push(`--unified=${context}`);
			}
			args.push(input.revision);
			appendPathspecs(args, input.paths);
			return args;
		},
	});

	registerGitTool<GitBranchInput>({
		name: "git_branch",
		label: "git branch",
		description: "Inspect local and remote branches.",
		parameters: gitBranchSchema,
		promptSnippet: "Inspect git branches",
		buildArgs(input) {
			validateRevision(input.contains, "contains");
			const args = ["branch", "--no-color"];
			if (input.all ?? true) args.push("--all");
			if (input.verbose ?? true) args.push("--verbose", "--verbose");
			if (input.contains) args.push("--contains", input.contains);
			return args;
		},
	});

	registerGitTool<GitLsFilesInput>({
		name: "git_ls_files",
		label: "git ls-files",
		description: "List tracked or selected untracked files with git ls-files.",
		parameters: gitLsFilesSchema,
		promptSnippet: "List files known to git",
		extractSecretPaths: (input) => input.paths ?? [],
		buildArgs(input) {
			const args = ["ls-files"];
			if (input.modified) args.push("--modified");
			if (input.deleted) args.push("--deleted");
			if (input.others) args.push("--others", "--exclude-standard");
			appendPathspecs(args, input.paths);
			return args;
		},
	});

	registerGitTool<GitGrepInput>({
		name: "git_grep",
		label: "git grep",
		description: "Search tracked content with git grep.",
		parameters: gitGrepSchema,
		promptSnippet: "Search tracked files with git grep",
		allowedExitCodes: [0, 1],
		emptyMessage: "(no matches)",
		extractSecretPaths: (input) => input.paths ?? [],
		buildArgs(input) {
			const args = ["grep", "--no-color", "-n"];
			if (input.ignoreCase) args.push("-i");
			if (input.literal) args.push("-F");
			const context = positiveInteger(input.context, "context");
			if (context !== undefined) args.push(`-C${context}`);
			const maxCount = positiveInteger(input.maxCount, "maxCount");
			if (maxCount !== undefined) args.push("-m", String(maxCount));
			args.push("-e", input.pattern);
			appendPathspecs(args, input.paths);
			return args;
		},
	});

	registerGitTool<GitBlameInput>({
		name: "git_blame",
		label: "git blame",
		description: "Inspect per-line history for a file with git blame.",
		parameters: gitBlameSchema,
		promptSnippet: "Inspect per-line git history",
		extractSecretPaths: (input) => [input.path],
		buildArgs(input) {
			validateRevision(input.revision, "revision");
			const startLine = positiveInteger(input.startLine, "startLine");
			const endLine = positiveInteger(input.endLine, "endLine");
			const args = ["blame", "--date=short"];
			if (startLine !== undefined || endLine !== undefined) {
				args.push("-L", `${startLine ?? 1},${endLine ?? ""}`);
			}
			if (input.revision) args.push(input.revision);
			args.push("--", input.path);
			return args;
		},
	});
}
