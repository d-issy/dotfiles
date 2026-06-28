import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import { type Component, Text } from "@earendil-works/pi-tui";
import { type Static, Type } from "typebox";
import type { ToolPolicy } from "../policy";
import {
	type RenderableTextDetails,
	limitToolOutput,
	renderLimitedTextResult,
} from "./output";
import { type ToolCatalog, defineToolContribution } from "./catalog";

const GH_TIMEOUT_MS = 30_000;
const GH_WATCH_TIMEOUT_MS = 30 * 60 * 1000;
const GH_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const GITHUB_WRITE_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_FILES = 50;
const MAX_FILES_LIMIT = 200;
const DEFAULT_MAX_PATCH_BYTES = 20_000;
const MAX_PATCH_BYTES_LIMIT = 100_000;
const DEFAULT_MAX_BODY_CHARS = 4_000;
const MAX_BODY_CHARS_LIMIT = 20_000;
const DEFAULT_MAX_CHECKS = 100;

const prSelectorSchema = Type.Optional(
	Type.String({
		description:
			"PR number, URL, or branch to inspect. Omit to use the PR for the current branch.",
	}),
);

const pathsSchema = Type.Optional(
	Type.Array(Type.String(), {
		description:
			"Optional exact file paths or directory prefixes to include. Use this to keep output small.",
	}),
);

const modeSchema = Type.Optional(
	Type.Union(
		[Type.Literal("summary"), Type.Literal("names"), Type.Literal("patch")],
		{
			description:
				"Output detail level. summary lists file stats, names lists paths only, patch includes patches. Defaults to summary.",
		},
	),
);

const lineLimitSchema = Type.Optional(
	Type.Number({
		description: "Maximum output lines to return. Defaults to 2000.",
	}),
);

const githubPrViewSchema = Type.Object({
	pr: prSelectorSchema,
	includeBody: Type.Optional(
		Type.Boolean({ description: "Include PR body. Defaults to false." }),
	),
	includeFiles: Type.Optional(
		Type.Boolean({
			description: "Include changed file summaries. Defaults to false.",
		}),
	),
	includeChecks: Type.Optional(
		Type.Boolean({
			description: "Include CI/check summaries. Defaults to false.",
		}),
	),
	maxBodyChars: Type.Optional(
		Type.Number({ description: "Maximum body characters to include." }),
	),
	maxFiles: Type.Optional(
		Type.Number({ description: "Maximum changed files to include." }),
	),
	limit: lineLimitSchema,
});

type GithubPrViewInput = Static<typeof githubPrViewSchema>;

const githubPrFilesSchema = Type.Object({
	pr: prSelectorSchema,
	paths: pathsSchema,
	status: Type.Optional(
		Type.String({
			description:
				"Optional GitHub file status filter, e.g. added, modified, removed, renamed.",
		}),
	),
	maxFiles: Type.Optional(
		Type.Number({ description: "Maximum files to return." }),
	),
	limit: lineLimitSchema,
});

type GithubPrFilesInput = Static<typeof githubPrFilesSchema>;

const githubPrDiffSchema = Type.Object({
	pr: prSelectorSchema,
	paths: pathsSchema,
	mode: modeSchema,
	maxFiles: Type.Optional(
		Type.Number({ description: "Maximum files to include." }),
	),
	maxPatchBytes: Type.Optional(
		Type.Number({
			description: "Maximum total patch bytes when mode is patch.",
		}),
	),
	limit: lineLimitSchema,
});

type GithubPrDiffInput = Static<typeof githubPrDiffSchema>;

const githubCompareSchema = Type.Object({
	base: Type.String({ description: "Base branch, tag, or commit." }),
	head: Type.String({ description: "Head branch, tag, or commit." }),
	paths: pathsSchema,
	mode: modeSchema,
	maxFiles: Type.Optional(
		Type.Number({ description: "Maximum files to include." }),
	),
	maxCommits: Type.Optional(
		Type.Number({
			description: "Maximum commits to include in summary output.",
		}),
	),
	maxPatchBytes: Type.Optional(
		Type.Number({
			description: "Maximum total patch bytes when mode is patch.",
		}),
	),
	limit: lineLimitSchema,
});

type GithubCompareInput = Static<typeof githubCompareSchema>;

const githubPrChecksSchema = Type.Object({
	pr: prSelectorSchema,
	state: Type.Optional(
		Type.Union(
			[
				Type.Literal("all"),
				Type.Literal("failed"),
				Type.Literal("pending"),
				Type.Literal("passing"),
				Type.Literal("required"),
			],
			{
				description:
					"Filter checks. all, failed, pending, passing, or required. Defaults to all.",
			},
		),
	),
	maxChecks: Type.Optional(
		Type.Number({ description: "Maximum checks to return." }),
	),
	includeLinks: Type.Optional(
		Type.Boolean({ description: "Include check URLs. Defaults to false." }),
	),
	watch: Type.Optional(
		Type.Boolean({
			description:
				"Wait for checks to complete before returning. Defaults to false.",
		}),
	),
	limit: lineLimitSchema,
});

type GithubPrChecksInput = Static<typeof githubPrChecksSchema>;

const createPullRequestSchema = Type.Object({
	branchName: Type.String({
		description:
			"Name of the working branch to use. If the current branch already matches, it is reused; otherwise a new branch is created. Must not be the repository default branch.",
	}),
	commitFiles: Type.Array(Type.String(), {
		description:
			"Explicit list of files to stage and commit. Existing listed files are staged; only listed files are committed.",
	}),
	commitMessage: Type.String({
		description: "Commit message for the new commit.",
	}),
	title: Type.String({ description: "Pull request title." }),
	body: Type.String({ description: "Pull request body." }),
});

type CreatePullRequestInput = Static<typeof createPullRequestSchema>;

const updatePullRequestSchema = Type.Object({
	commitFiles: Type.Optional(
		Type.Array(Type.String(), {
			description:
				"If provided, stage existing listed files, commit only listed files, and push.",
		}),
	),
	commitMessage: Type.Optional(
		Type.String({
			description: "Commit message. Required when commitFiles is provided.",
		}),
	),
	title: Type.Optional(
		Type.String({ description: "If provided, update the PR title." }),
	),
	body: Type.Optional(
		Type.String({ description: "If provided, update the PR body." }),
	),
	reviewStatus: Type.Optional(
		Type.Union([Type.Literal("draft"), Type.Literal("ready")], {
			description:
				"If provided, update whether the PR is draft or ready for review. Allowed values: draft, ready. If omitted, do not change review readiness state.",
		}),
	),
});

type UpdatePullRequestInput = Static<typeof updatePullRequestSchema>;

type GithubToolDetails = RenderableTextDetails & {
	readonly commands: readonly string[];
};

type GhExecResult = {
	readonly command: string;
	readonly exitCode: number | null;
	readonly stdout: string;
	readonly stderr: string;
	readonly error?: string;
};

type GithubToolOutput = {
	readonly text: string;
	readonly commands: readonly string[];
	readonly truncated?: boolean;
};

type GithubFile = {
	readonly filename: string;
	readonly status?: string;
	readonly additions?: number;
	readonly deletions?: number;
	readonly changes?: number;
	readonly patch?: string;
};

type GithubCheck = {
	readonly name?: string;
	readonly state?: string;
	readonly conclusion?: string;
	readonly bucket?: string;
	readonly workflow?: string;
	readonly link?: string;
	readonly detailsUrl?: string;
};

function renderGithubCall(
	name: string,
	args: unknown,
	theme: Theme,
): Component {
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
	return ["gh", ...args].map(shellQuote).join(" ");
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

function nonEmpty(
	value: string | undefined,
	field: string,
): string | undefined {
	if (value === undefined) return undefined;
	if (value.trim() === "") throw new Error(`${field} must not be empty.`);
	return value;
}

function selectorArgs(pr: string | undefined): string[] {
	const selector = nonEmpty(pr, "pr");
	return selector ? [selector] : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
	return typeof value === "number" ? value : undefined;
}

function parseJson<T>(value: string, context: string): T {
	try {
		return JSON.parse(value) as T;
	} catch (error) {
		throw new Error(
			`Failed to parse ${context}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
}

async function execGh(
	cwd: string,
	args: readonly string[],
	signal: AbortSignal | undefined,
	options?: { readonly timeoutMs?: number },
): Promise<GhExecResult> {
	return await new Promise((resolve) => {
		execFile(
			"gh",
			args,
			{
				cwd,
				env: { ...process.env, GH_PAGER: "cat", NO_COLOR: "1" },
				maxBuffer: GH_MAX_BUFFER_BYTES,
				timeout: options?.timeoutMs ?? GH_TIMEOUT_MS,
				signal,
			},
			(error, stdout, stderr) => {
				const rawCode = error && "code" in error ? error.code : 0;
				const exitCode = typeof rawCode === "number" ? rawCode : null;
				resolve({
					command: commandText(args),
					exitCode,
					stdout: String(stdout),
					stderr: String(stderr),
					error: error instanceof Error ? error.message : undefined,
				});
			},
		);
	});
}

function assertGhSuccess(result: GhExecResult, allowedExitCodes = [0]): void {
	if (result.exitCode !== null && allowedExitCodes.includes(result.exitCode)) {
		return;
	}
	throw new Error(
		result.stderr.trim() || result.error || `${result.command} failed`,
	);
}

async function ghJson<T>(
	cwd: string,
	args: readonly string[],
	signal: AbortSignal | undefined,
	context: string,
	allowedExitCodes?: readonly number[],
): Promise<{ readonly value: T; readonly command: string }> {
	const result = await execGh(cwd, args, signal);
	assertGhSuccess(result, allowedExitCodes ? [...allowedExitCodes] : [0]);
	return {
		value: parseJson<T>(result.stdout, context),
		command: result.command,
	};
}

async function repoNameWithOwner(
	cwd: string,
	signal: AbortSignal | undefined,
): Promise<{ readonly repo: string; readonly command: string }> {
	const result = await ghJson<{ nameWithOwner?: string }>(
		cwd,
		["repo", "view", "--json", "nameWithOwner"],
		signal,
		"repo metadata",
	);
	if (!result.value.nameWithOwner)
		throw new Error("Could not resolve GitHub repo.");
	return { repo: result.value.nameWithOwner, command: result.command };
}

async function prNumber(
	cwd: string,
	pr: string | undefined,
	signal: AbortSignal | undefined,
): Promise<{ readonly number: number; readonly command: string }> {
	const result = await ghJson<{ number?: number }>(
		cwd,
		["pr", "view", ...selectorArgs(pr), "--json", "number"],
		signal,
		"PR number",
	);
	if (!result.value.number) throw new Error("Could not resolve PR number.");
	return { number: result.value.number, command: result.command };
}

function normalizeFiles(value: unknown): GithubFile[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		if (!isRecord(entry)) return [];
		const filename = getString(entry.filename) ?? getString(entry.path);
		if (!filename) return [];
		return [
			{
				filename,
				status: getString(entry.status),
				additions: getNumber(entry.additions),
				deletions: getNumber(entry.deletions),
				changes: getNumber(entry.changes),
				patch: getString(entry.patch),
			},
		];
	});
}

function normalizeChecks(value: unknown): GithubCheck[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		if (!isRecord(entry)) return [];
		return [
			{
				name: getString(entry.name),
				state: getString(entry.state),
				conclusion: getString(entry.conclusion),
				bucket: getString(entry.bucket),
				workflow: getString(entry.workflow),
				link: getString(entry.link),
				detailsUrl: getString(entry.detailsUrl),
			},
		];
	});
}

function pathMatches(
	filename: string,
	filters: readonly string[] | undefined,
): boolean {
	if (!filters || filters.length === 0) return true;
	return filters.some((filter) => {
		const normalized = filter.endsWith("/") ? filter.slice(0, -1) : filter;
		return filename === normalized || filename.startsWith(`${normalized}/`);
	});
}

function filterFiles(
	files: readonly GithubFile[],
	options: {
		readonly paths?: readonly string[];
		readonly status?: string;
		readonly maxFiles?: number;
	},
): GithubFile[] {
	const maxFiles = positiveInteger(options.maxFiles, "maxFiles", {
		defaultValue: DEFAULT_MAX_FILES,
		max: MAX_FILES_LIMIT,
	});
	const status = options.status?.toLowerCase();
	return files
		.filter((file) => pathMatches(file.filename, options.paths))
		.filter((file) => !status || file.status?.toLowerCase() === status)
		.slice(0, maxFiles);
}

function formatFileLine(file: GithubFile): string {
	const status = file.status ? `${file.status} ` : "";
	const additions = file.additions ?? 0;
	const deletions = file.deletions ?? 0;
	const changes = file.changes ?? additions + deletions;
	return `${status}${file.filename} (+${additions} -${deletions}, ${changes} changes)`;
}

function appendPatch(
	lines: string[],
	file: GithubFile,
	remainingBytes: { value: number },
): boolean {
	lines.push(`\n### ${formatFileLine(file)}`);
	if (!file.patch) {
		lines.push("(no textual patch available)");
		return false;
	}
	const bytes = Buffer.byteLength(file.patch, "utf8");
	if (bytes > remainingBytes.value) {
		const clipped = file.patch.slice(0, Math.max(0, remainingBytes.value));
		lines.push(clipped, "... (patch truncated)");
		remainingBytes.value = 0;
		return true;
	}
	lines.push(file.patch);
	remainingBytes.value -= bytes;
	return false;
}

function formatFiles(
	files: readonly GithubFile[],
	options: {
		readonly mode?: "summary" | "names" | "patch";
		readonly maxPatchBytes?: number;
	},
): { readonly text: string; readonly truncated: boolean } {
	const mode = options.mode ?? "summary";
	if (files.length === 0) return { text: "(no files)", truncated: false };
	if (mode === "names") {
		return {
			text: files.map((file) => file.filename).join("\n"),
			truncated: false,
		};
	}
	if (mode === "summary") {
		return { text: files.map(formatFileLine).join("\n"), truncated: false };
	}

	const maxPatchBytes = positiveInteger(
		options.maxPatchBytes,
		"maxPatchBytes",
		{
			defaultValue: DEFAULT_MAX_PATCH_BYTES,
			max: MAX_PATCH_BYTES_LIMIT,
		},
	);
	const remainingBytes = { value: maxPatchBytes ?? DEFAULT_MAX_PATCH_BYTES };
	const lines: string[] = [];
	let truncated = false;
	for (const file of files) {
		truncated = appendPatch(lines, file, remainingBytes) || truncated;
		if (remainingBytes.value <= 0) break;
	}
	return { text: lines.join("\n").trimStart(), truncated };
}

async function prFiles(
	cwd: string,
	pr: string | undefined,
	signal: AbortSignal | undefined,
): Promise<{
	readonly files: GithubFile[];
	readonly commands: readonly string[];
}> {
	const [repo, prRef] = await Promise.all([
		repoNameWithOwner(cwd, signal),
		prNumber(cwd, pr, signal),
	]);
	const endpoint = `repos/${repo.repo}/pulls/${prRef.number}/files`;
	const result = await ghJson<unknown>(
		cwd,
		[
			"api",
			"--paginate",
			"--slurp",
			"--method",
			"GET",
			endpoint,
			"-f",
			"per_page=100",
		],
		signal,
		"PR files",
	);
	const pages = Array.isArray(result.value) ? result.value : [result.value];
	const files = normalizeFiles(
		pages.flatMap((page) => (Array.isArray(page) ? page : [])),
	);
	return { files, commands: [repo.command, prRef.command, result.command] };
}

function checkMatches(
	check: GithubCheck,
	state: GithubPrChecksInput["state"],
): boolean {
	if (!state || state === "all") return true;
	const bucket = check.bucket?.toLowerCase();
	const conclusion = check.conclusion?.toLowerCase();
	const currentState = check.state?.toLowerCase();
	if (state === "required") return bucket === "required";
	if (state === "failed") {
		return (
			bucket === "fail" ||
			conclusion === "failure" ||
			conclusion === "cancelled"
		);
	}
	if (state === "pending") {
		return (
			bucket === "pending" ||
			currentState === "pending" ||
			currentState === "queued"
		);
	}
	if (state === "passing") return bucket === "pass" || conclusion === "success";
	return true;
}

function formatChecks(
	checks: readonly GithubCheck[],
	options: {
		readonly state?: GithubPrChecksInput["state"];
		readonly maxChecks?: number;
		readonly includeLinks?: boolean;
	},
): string {
	const maxChecks = positiveInteger(options.maxChecks, "maxChecks", {
		defaultValue: DEFAULT_MAX_CHECKS,
		max: 300,
	});
	const filtered = checks
		.filter((check) => checkMatches(check, options.state))
		.slice(0, maxChecks);
	if (filtered.length === 0) return "(no checks)";
	return filtered
		.map((check) => {
			const status =
				check.bucket ?? check.conclusion ?? check.state ?? "unknown";
			const workflow = check.workflow ? ` [${check.workflow}]` : "";
			const link = options.includeLinks
				? ` ${check.link ?? check.detailsUrl ?? ""}`.trimEnd()
				: "";
			return `${status} ${check.name ?? "(unnamed)"}${workflow}${link ? ` ${link}` : ""}`;
		})
		.join("\n");
}

async function githubPrView(
	params: GithubPrViewInput,
	cwd: string,
	signal: AbortSignal | undefined,
): Promise<GithubToolOutput> {
	const fields = [
		"number",
		"title",
		"state",
		"isDraft",
		"author",
		"baseRefName",
		"headRefName",
		"url",
		"reviewDecision",
		"mergeable",
	];
	if (params.includeBody) fields.push("body");
	if (params.includeFiles) fields.push("files");
	if (params.includeChecks) fields.push("statusCheckRollup");

	const result = await ghJson<Record<string, unknown>>(
		cwd,
		["pr", "view", ...selectorArgs(params.pr), "--json", fields.join(",")],
		signal,
		"PR view",
	);
	const lines = [
		`#${String(result.value.number ?? "?")} ${String(result.value.title ?? "")}`,
		`state: ${String(result.value.state ?? "?")}${result.value.isDraft ? " (draft)" : ""}`,
		`base/head: ${String(result.value.baseRefName ?? "?")}...${String(result.value.headRefName ?? "?")}`,
		`review: ${String(result.value.reviewDecision ?? "?")}`,
		`mergeable: ${String(result.value.mergeable ?? "?")}`,
		`url: ${String(result.value.url ?? "")}`,
	];

	if (params.includeBody && typeof result.value.body === "string") {
		const maxBodyChars = positiveInteger(params.maxBodyChars, "maxBodyChars", {
			defaultValue: DEFAULT_MAX_BODY_CHARS,
			max: MAX_BODY_CHARS_LIMIT,
		});
		const body = result.value.body.slice(0, maxBodyChars);
		lines.push("", "## Body", body || "(empty)");
		if (result.value.body.length > (maxBodyChars ?? DEFAULT_MAX_BODY_CHARS)) {
			lines.push("... (body truncated)");
		}
	}

	if (params.includeFiles) {
		const files = filterFiles(normalizeFiles(result.value.files), {
			maxFiles: params.maxFiles,
		});
		lines.push("", "## Files", formatFiles(files, { mode: "summary" }).text);
	}

	if (params.includeChecks) {
		const checks = normalizeChecks(result.value.statusCheckRollup);
		lines.push("", "## Checks", formatChecks(checks, {}));
	}

	return { text: lines.join("\n"), commands: [result.command] };
}

async function githubPrFiles(
	params: GithubPrFilesInput,
	cwd: string,
	signal: AbortSignal | undefined,
): Promise<GithubToolOutput> {
	const result = await prFiles(cwd, params.pr, signal);
	const files = filterFiles(result.files, {
		paths: params.paths,
		status: params.status,
		maxFiles: params.maxFiles,
	});
	return {
		text: formatFiles(files, { mode: "summary" }).text,
		commands: result.commands,
	};
}

async function githubPrDiff(
	params: GithubPrDiffInput,
	cwd: string,
	signal: AbortSignal | undefined,
): Promise<GithubToolOutput> {
	const result = await prFiles(cwd, params.pr, signal);
	const files = filterFiles(result.files, {
		paths: params.paths,
		maxFiles: params.maxFiles,
	});
	const formatted = formatFiles(files, {
		mode: params.mode,
		maxPatchBytes: params.maxPatchBytes,
	});
	return {
		text: formatted.text,
		commands: result.commands,
		truncated: formatted.truncated,
	};
}

async function githubCompare(
	params: GithubCompareInput,
	cwd: string,
	signal: AbortSignal | undefined,
): Promise<GithubToolOutput> {
	const base = nonEmpty(params.base, "base") ?? "";
	const head = nonEmpty(params.head, "head") ?? "";
	const repo = await repoNameWithOwner(cwd, signal);
	const endpoint = `repos/${repo.repo}/compare/${encodeURIComponent(`${base}...${head}`)}`;
	const result = await ghJson<Record<string, unknown>>(
		cwd,
		["api", "--method", "GET", endpoint],
		signal,
		"compare",
	);
	const files = filterFiles(normalizeFiles(result.value.files), {
		paths: params.paths,
		maxFiles: params.maxFiles,
	});
	const formatted = formatFiles(files, {
		mode: params.mode,
		maxPatchBytes: params.maxPatchBytes,
	});
	const lines = [
		`${base}...${head}`,
		`status: ${String(result.value.status ?? "?")}`,
		`ahead/behind: ${String(result.value.ahead_by ?? "?")}/${String(result.value.behind_by ?? "?")}`,
		"",
		formatted.text,
	];
	const commits = Array.isArray(result.value.commits)
		? result.value.commits
		: [];
	const maxCommits = positiveInteger(params.maxCommits, "maxCommits", {
		max: 100,
	});
	if ((maxCommits ?? 0) > 0 && commits.length > 0) {
		lines.push("", "## Commits");
		for (const commit of commits.slice(0, maxCommits)) {
			if (!isRecord(commit)) continue;
			const sha = getString(commit.sha)?.slice(0, 7) ?? "???????";
			const nested = isRecord(commit.commit) ? commit.commit : {};
			const message = getString(nested.message)?.split("\n")[0] ?? "";
			lines.push(`${sha} ${message}`);
		}
	}
	return {
		text: lines.join("\n"),
		commands: [repo.command, result.command],
		truncated: formatted.truncated,
	};
}

async function githubPrChecks(
	params: GithubPrChecksInput,
	cwd: string,
	signal: AbortSignal | undefined,
): Promise<GithubToolOutput> {
	const args = ["pr", "checks", ...selectorArgs(params.pr)];
	if (params.state === "required") args.push("--required");
	if (params.watch) args.push("--watch");
	args.push("--json", "name,state,bucket,workflow,link");
	const result = await execGh(cwd, args, signal, {
		timeoutMs: params.watch ? GH_WATCH_TIMEOUT_MS : undefined,
	});
	if (result.exitCode !== 0 && result.stdout.trim() === "") {
		assertGhSuccess(result);
	}
	const checks = normalizeChecks(
		parseJson<unknown>(result.stdout || "[]", "PR checks"),
	);
	return {
		text: formatChecks(checks, {
			state: params.state === "required" ? "all" : params.state,
			maxChecks: params.maxChecks,
			includeLinks: params.includeLinks,
		}),
		commands: [result.command],
	};
}

function commandTextForBin(bin: string, args: readonly string[]): string {
	return [bin, ...args].map(shellQuote).join(" ");
}

function requireNonEmpty(value: string | undefined, field: string): string {
	const text = nonEmpty(value, field);
	if (text === undefined) throw new Error(`${field} must not be empty.`);
	return text;
}

async function execCommand(
	bin: string,
	cwd: string,
	args: readonly string[],
	signal: AbortSignal | undefined,
	options?: { readonly timeoutMs?: number },
): Promise<GhExecResult> {
	return await new Promise((resolve) => {
		execFile(
			bin,
			[...args],
			{
				cwd,
				env: {
					...process.env,
					GIT_PAGER: "cat",
					GH_PAGER: "cat",
					NO_COLOR: "1",
				},
				maxBuffer: GH_MAX_BUFFER_BYTES,
				timeout: options?.timeoutMs ?? GITHUB_WRITE_TIMEOUT_MS,
				signal,
			},
			(error, stdout, stderr) => {
				const rawCode = error && "code" in error ? error.code : 0;
				const exitCode = typeof rawCode === "number" ? rawCode : null;
				resolve({
					command: commandTextForBin(bin, args),
					exitCode,
					stdout: String(stdout),
					stderr: String(stderr),
					error: error instanceof Error ? error.message : undefined,
				});
			},
		);
	});
}

function assertCommandSuccess(result: GhExecResult): void {
	if (result.exitCode === 0) return;
	const detail = result.stderr.trim() || result.stdout.trim() || "no output";
	throw new Error(
		`${result.command} failed with exit code ${String(result.exitCode)}: ${detail}`,
	);
}

async function runCommand(
	bin: string,
	cwd: string,
	args: readonly string[],
	signal: AbortSignal | undefined,
	commands: string[],
	options?: { readonly timeoutMs?: number },
): Promise<GhExecResult> {
	const result = await execCommand(bin, cwd, args, signal, options);
	commands.push(result.command);
	assertCommandSuccess(result);
	return result;
}

async function detectDefaultBranch(
	cwd: string,
	signal: AbortSignal | undefined,
): Promise<string> {
	const sym = await execCommand(
		"git",
		cwd,
		["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
		signal,
	);
	if (sym.exitCode === 0) {
		const ref = sym.stdout.trim();
		if (ref.startsWith("origin/")) return ref.slice("origin/".length);
		if (ref) return ref;
	}

	const ghRepo = await execCommand(
		"gh",
		cwd,
		["repo", "view", "--json", "defaultBranchRef"],
		signal,
	);
	if (ghRepo.exitCode === 0) {
		const branch = parseDefaultBranchRef(ghRepo.stdout);
		if (branch) return branch;
	}

	const remote = await execCommand(
		"git",
		cwd,
		["remote", "show", "origin"],
		signal,
	);
	if (remote.exitCode === 0) {
		const branch = parseRemoteHeadBranch(remote.stdout);
		if (branch) return branch;
	}

	const config = await execCommand(
		"git",
		cwd,
		["config", "--get", "init.defaultBranch"],
		signal,
	);
	if (config.exitCode === 0 && config.stdout.trim()) {
		return config.stdout.trim();
	}

	return "main";
}

function parseDefaultBranchRef(stdout: string): string | undefined {
	try {
		const value = JSON.parse(stdout) as {
			defaultBranchRef?: { name?: string };
		};
		const name = value.defaultBranchRef?.name;
		return typeof name === "string" && name.trim() !== ""
			? name.trim()
			: undefined;
	} catch {
		return undefined;
	}
}

function parseRemoteHeadBranch(stdout: string): string | undefined {
	const match = /HEAD branch:\s*(\S+)/u.exec(stdout);
	return match?.[1];
}

async function currentBranch(
	cwd: string,
	signal: AbortSignal | undefined,
	commands: string[],
): Promise<string> {
	const result = await runCommand(
		"git",
		cwd,
		["rev-parse", "--abbrev-ref", "HEAD"],
		signal,
		commands,
	);
	const branch = result.stdout.trim();
	if (!branch || branch === "HEAD") {
		throw new Error("Could not detect the current branch (detached HEAD).");
	}
	return branch;
}

async function currentBranchIfAvailable(
	cwd: string,
	signal: AbortSignal | undefined,
	commands: string[],
): Promise<string | undefined> {
	const result = await execCommand(
		"git",
		cwd,
		["branch", "--show-current"],
		signal,
	);
	commands.push(result.command);
	if (result.exitCode !== 0) return undefined;

	const branch = result.stdout.trim();
	return branch === "" ? undefined : branch;
}

function existingWorkingTreeFiles(
	cwd: string,
	files: readonly string[],
): string[] {
	return files.filter((file) => existsSync(path.resolve(cwd, file)));
}

async function stageAndCommitFiles(
	cwd: string,
	files: readonly string[],
	commitMessage: string,
	signal: AbortSignal | undefined,
	commands: string[],
): Promise<void> {
	const existingFiles = existingWorkingTreeFiles(cwd, files);
	if (existingFiles.length > 0) {
		await runCommand(
			"git",
			cwd,
			["add", "--", ...existingFiles],
			signal,
			commands,
		);
	}
	await runCommand(
		"git",
		cwd,
		["commit", "--only", "-m", commitMessage, "--", ...files],
		signal,
		commands,
	);
}

async function createPullRequest(
	params: CreatePullRequestInput,
	cwd: string,
	signal: AbortSignal | undefined,
): Promise<GithubToolOutput> {
	const branchName = requireNonEmpty(params.branchName, "branchName");
	const commitMessage = requireNonEmpty(params.commitMessage, "commitMessage");
	const title = requireNonEmpty(params.title, "title");
	const body = requireNonEmpty(params.body, "body");
	if (params.commitFiles.length === 0) {
		throw new Error("commitFiles must not be empty.");
	}

	const commands: string[] = [];
	const defaultBranchName = await detectDefaultBranch(cwd, signal);
	if (branchName === defaultBranchName) {
		throw new Error(
			`branchName must not be the repository default branch ('${defaultBranchName}').`,
		);
	}

	const branch = await currentBranchIfAvailable(cwd, signal, commands);
	if (branch !== branchName) {
		await runCommand(
			"git",
			cwd,
			["switch", "-c", branchName],
			signal,
			commands,
		);
	}
	await stageAndCommitFiles(
		cwd,
		params.commitFiles,
		commitMessage,
		signal,
		commands,
	);
	await runCommand(
		"git",
		cwd,
		["push", "-u", "origin", branchName],
		signal,
		commands,
	);
	const pr = await runCommand(
		"gh",
		cwd,
		["pr", "create", "--draft", "--title", title, "--body", body],
		signal,
		commands,
	);

	const output =
		pr.stdout.trim() || pr.stderr.trim() || "Created draft pull request.";
	return { text: output, commands };
}

async function updatePullRequest(
	params: UpdatePullRequestInput,
	cwd: string,
	signal: AbortSignal | undefined,
): Promise<GithubToolOutput> {
	const hasCommit = params.commitFiles !== undefined;
	const hasMeta =
		params.title !== undefined ||
		params.body !== undefined ||
		params.reviewStatus !== undefined;
	if (!hasCommit && !hasMeta) {
		throw new Error(
			"No update inputs provided. Provide commitFiles, title, body, or reviewStatus.",
		);
	}

	if (hasCommit) {
		if ((params.commitFiles ?? []).length === 0) {
			throw new Error("commitFiles must not be empty.");
		}
		requireNonEmpty(params.commitMessage, "commitMessage");
	}

	const commands: string[] = [];
	const lines: string[] = [];

	const defaultBranchName = await detectDefaultBranch(cwd, signal);
	const branch = await currentBranch(cwd, signal, commands);
	if (branch === defaultBranchName) {
		throw new Error(
			`update_pull_request must not run on the repository default branch ('${defaultBranchName}').`,
		);
	}

	if (hasCommit) {
		const files = params.commitFiles ?? [];
		const commitMessage = requireNonEmpty(
			params.commitMessage,
			"commitMessage",
		);
		await stageAndCommitFiles(cwd, files, commitMessage, signal, commands);
		await runCommand("git", cwd, ["push"], signal, commands);
		lines.push("Pushed new commit to the current branch.");
	}

	if (params.title !== undefined) {
		requireNonEmpty(params.title, "title");
		await runCommand(
			"gh",
			cwd,
			["pr", "edit", "--title", params.title],
			signal,
			commands,
		);
		lines.push("Updated PR title.");
	}

	if (params.body !== undefined) {
		requireNonEmpty(params.body, "body");
		await runCommand(
			"gh",
			cwd,
			["pr", "edit", "--body", params.body],
			signal,
			commands,
		);
		lines.push("Updated PR body.");
	}

	if (params.reviewStatus !== undefined) {
		if (params.reviewStatus === "draft") {
			await runCommand("gh", cwd, ["pr", "ready", "--undo"], signal, commands);
			lines.push("Converted PR to draft.");
		} else {
			await runCommand("gh", cwd, ["pr", "ready"], signal, commands);
			lines.push("Marked PR ready for review.");
		}
	}

	return { text: lines.join("\n"), commands };
}

function lineLimitFromInput(
	input: Record<string, unknown>,
): number | undefined {
	return positiveInteger(
		typeof input.limit === "number" ? input.limit : undefined,
		"limit",
	);
}

function registerGithubTool<TInput extends object>(
	catalog: ToolCatalog,
	config: {
		readonly name: string;
		readonly label: string;
		readonly description: string;
		readonly parameters: Parameters<
			ToolCatalog["register"]
		>[0]["definition"]["parameters"];
		readonly promptSnippet: string;
		readonly execute: (
			params: TInput,
			cwd: string,
			signal: AbortSignal | undefined,
		) => Promise<GithubToolOutput>;
		readonly extractSecretPaths?: (input: TInput) => readonly string[];
		readonly write?: boolean;
	},
): void {
	catalog.register(
		defineToolContribution({
			policy: {
				name: config.name,
				extractSecretPaths: config.extractSecretPaths
					? (input) => config.extractSecretPaths?.(input as TInput) ?? []
					: undefined,
				notAllowedReason: (focus) =>
					config.write === true
						? `${config.name} is available only in github focus, not in ${focus} focus.`
						: `${config.name} is available only in git/GitHub read-only investigation focuses, not in ${focus} focus.`,
			} satisfies ToolPolicy,
			definition: {
				name: config.name,
				label: config.label,
				description: config.description,
				promptSnippet: config.promptSnippet,
				promptGuidelines: config.write
					? [
							`${config.name} performs git and gh write operations directly from explicit inputs. Do not add interactive confirmation prompts.`,
							"Use explicit commitFiles lists to avoid committing unrelated work. Existing listed files are staged, and only listed files are committed.",
							"Fail clearly when required inputs are missing, the target branch is the repository default branch, or unsafe conditions are detected.",
							"Do not force-push, amend, rebase, or rewrite history.",
						]
					: [
							`${config.name} runs fixed read-only GitHub CLI commands. Use filtering parameters such as paths, mode, maxFiles, and include* flags to keep context small.`,
							"Outputs are bounded like built-in tools. If output is truncated, inspect the saved temp file with read offset/limit or retry with narrower parameters.",
						],
				parameters: config.parameters,
				executionMode: config.write ? "sequential" : "parallel",
				renderCall: (args, theme) => renderGithubCall(config.name, args, theme),
				renderResult: renderLimitedTextResult,
				execute: async (_toolCallId, params, signal, _onUpdate, ctx) => {
					const startedAt = Date.now();
					const output = await config.execute(
						params as TInput,
						ctx.cwd,
						signal,
					);
					const limited = await limitToolOutput(output.text, {
						tempPrefix: config.write
							? "pi-github-write-tool"
							: "pi-github-tool",
						fileName: `${config.name}.txt`,
						lineLimit: config.write
							? undefined
							: lineLimitFromInput(params as Record<string, unknown>),
						emptyMessage: "(no output)",
						hint: "Retry with narrower paths, mode, maxFiles, include* flags, or check filters when possible.",
					});
					return {
						content: [{ type: "text", text: limited.text }],
						details: {
							commands: output.commands,
							durationMs: Date.now() - startedAt,
							output: limited.output,
							truncated: output.truncated === true || limited.truncated,
							truncation: limited.truncation,
							fullOutputPath: limited.fullOutputPath,
						} satisfies GithubToolDetails,
					} satisfies AgentToolResult<GithubToolDetails>;
				},
			},
		}),
	);
}

export function registerGithubTools(catalog: ToolCatalog): void {
	registerGithubTool<GithubPrViewInput>(catalog, {
		name: "github_pull_request_view",
		label: "github pr view",
		description:
			"Inspect GitHub PR metadata, with optional body, file, and CI summaries.",
		parameters: githubPrViewSchema,
		promptSnippet: "Inspect GitHub PR metadata",
		execute: githubPrView,
	});

	registerGithubTool<GithubPrFilesInput>(catalog, {
		name: "github_pull_request_files",
		label: "github pr files",
		description:
			"List GitHub PR changed files with optional path and status filters.",
		parameters: githubPrFilesSchema,
		promptSnippet: "List GitHub PR files",
		extractSecretPaths: (input) => input.paths ?? [],
		execute: githubPrFiles,
	});

	registerGithubTool<GithubPrDiffInput>(catalog, {
		name: "github_pull_request_diff",
		label: "github pr diff",
		description: "Inspect GitHub PR diff summaries, names, or bounded patches.",
		parameters: githubPrDiffSchema,
		promptSnippet: "Inspect GitHub PR diffs",
		extractSecretPaths: (input) => input.paths ?? [],
		execute: githubPrDiff,
	});

	registerGithubTool<GithubCompareInput>(catalog, {
		name: "github_compare",
		label: "github compare",
		description: "Inspect a GitHub base...head comparison with bounded output.",
		parameters: githubCompareSchema,
		promptSnippet: "Inspect GitHub branch or commit comparisons",
		extractSecretPaths: (input) => input.paths ?? [],
		execute: githubCompare,
	});

	registerGithubTool<GithubPrChecksInput>(catalog, {
		name: "github_pull_request_checks",
		label: "github pr checks",
		description: "Inspect GitHub PR CI/check status with optional filters.",
		parameters: githubPrChecksSchema,
		promptSnippet: "Inspect GitHub PR CI checks",
		execute: githubPrChecks,
	});

	registerGithubTool<CreatePullRequestInput>(catalog, {
		name: "create_pull_request",
		label: "create pull request",
		description:
			"Create a new draft pull request from specified commit files. Reuses the current branch when it matches branchName; otherwise creates a new branch. Stages existing listed files, commits only listed files, pushes, and opens a draft PR with gh.",
		parameters: createPullRequestSchema,
		promptSnippet: "Create a draft pull request from explicit files",
		extractSecretPaths: (input) => input.commitFiles,
		write: true,
		execute: createPullRequest,
	});

	registerGithubTool<UpdatePullRequestInput>(catalog, {
		name: "update_pull_request",
		label: "update pull request",
		description:
			"Update the pull request associated with the current branch: push new commits from explicit files, and/or update title, body, or draft/ready state.",
		parameters: updatePullRequestSchema,
		promptSnippet: "Update the PR for the current branch",
		extractSecretPaths: (input) => input.commitFiles ?? [],
		write: true,
		execute: updatePullRequest,
	});
}
