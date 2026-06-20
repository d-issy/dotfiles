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
import { type ToolCatalog, defineToolContribution } from "./catalog";

const PR_TIMEOUT_MS = 60_000;
const PR_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

const createPullRequestSchema = Type.Object({
	branchName: Type.String({
		description:
			"Name of the new working branch to create. Must not be the repository default branch.",
	}),
	commitFiles: Type.Array(Type.String(), {
		description:
			"Explicit list of files to stage and commit. Only these files are staged.",
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
			description: "If provided, stage only these files, commit, and push.",
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

type PullRequestToolDetails = RenderableTextDetails & {
	readonly commands: readonly string[];
};

type PullRequestToolOutput = {
	readonly text: string;
	readonly commands: readonly string[];
};

type ExecResult = {
	readonly command: string;
	readonly exitCode: number | null;
	readonly stdout: string;
	readonly stderr: string;
};

function shellQuote(value: string): string {
	return value === "" || /[^A-Za-z0-9_./:=@%+-]/u.test(value)
		? `'${value.replaceAll("'", `'"'"'`)}'`
		: value;
}

function commandText(bin: string, args: readonly string[]): string {
	return [bin, ...args].map(shellQuote).join(" ");
}

function nonEmpty(value: string | undefined, field: string): string {
	if (value === undefined || value.trim() === "") {
		throw new Error(`${field} must not be empty.`);
	}
	return value;
}

function renderPullRequestCall(
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

function execBin(
	bin: string,
	cwd: string,
	args: readonly string[],
	signal: AbortSignal | undefined,
	options?: { readonly timeoutMs?: number },
): Promise<ExecResult> {
	return new Promise((resolve) => {
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
				maxBuffer: PR_MAX_BUFFER_BYTES,
				timeout: options?.timeoutMs ?? PR_TIMEOUT_MS,
				signal,
			},
			(error, stdout, stderr) => {
				const rawCode = error && "code" in error ? error.code : 0;
				const exitCode = typeof rawCode === "number" ? rawCode : null;
				resolve({
					command: commandText(bin, args),
					exitCode,
					stdout: String(stdout),
					stderr: String(stderr),
				});
			},
		);
	});
}

function assertSuccess(result: ExecResult): void {
	if (result.exitCode === 0) return;
	const detail = result.stderr.trim() || result.stdout.trim() || "no output";
	throw new Error(
		`${result.command} failed with exit code ${String(result.exitCode)}: ${detail}`,
	);
}

async function runBin(
	bin: string,
	cwd: string,
	args: readonly string[],
	signal: AbortSignal | undefined,
	commands: string[],
	options?: { readonly timeoutMs?: number },
): Promise<ExecResult> {
	const result = await execBin(bin, cwd, args, signal, options);
	commands.push(result.command);
	assertSuccess(result);
	return result;
}

async function detectDefaultBranch(
	cwd: string,
	signal: AbortSignal | undefined,
): Promise<string> {
	// 1. origin/HEAD symbolic ref (set after clone/fetch).
	const sym = await execBin(
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

	// 2. GitHub repo metadata via gh (authoritative when available).
	const ghRepo = await execBin(
		"gh",
		cwd,
		["repo", "view", "--json", "defaultBranchRef"],
		signal,
	);
	if (ghRepo.exitCode === 0) {
		const branch = parseDefaultBranchRef(ghRepo.stdout);
		if (branch) return branch;
	}

	// 3. `git remote show origin` HEAD branch (works without origin/HEAD set).
	const remote = await execBin(
		"git",
		cwd,
		["remote", "show", "origin"],
		signal,
	);
	if (remote.exitCode === 0) {
		const branch = parseRemoteHeadBranch(remote.stdout);
		if (branch) return branch;
	}

	// 4. Local init.defaultBranch config.
	const config = await execBin(
		"git",
		cwd,
		["config", "--get", "init.defaultBranch"],
		signal,
	);
	if (config.exitCode === 0 && config.stdout.trim()) {
		return config.stdout.trim();
	}

	// 5. Last-resort heuristic.
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
	// `git remote show origin` prints a line like:
	//   HEAD branch: main
	const match = /HEAD branch:\s*(\S+)/u.exec(stdout);
	return match?.[1];
}

async function currentBranch(
	cwd: string,
	signal: AbortSignal | undefined,
	commands: string[],
): Promise<string> {
	const result = await runBin(
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

async function createPullRequest(
	params: CreatePullRequestInput,
	cwd: string,
	signal: AbortSignal | undefined,
): Promise<PullRequestToolOutput> {
	const branchName = nonEmpty(params.branchName, "branchName");
	const commitMessage = nonEmpty(params.commitMessage, "commitMessage");
	const title = nonEmpty(params.title, "title");
	const body = nonEmpty(params.body, "body");
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

	await runBin("git", cwd, ["switch", "-c", branchName], signal, commands);
	// Stage the listed files first so untracked new files become committable,
	// then commit only those pathspecs with `git commit --only` to preserve
	// unrelated staged changes.
	await runBin(
		"git",
		cwd,
		["add", "--", ...params.commitFiles],
		signal,
		commands,
	);
	await runBin(
		"git",
		cwd,
		["commit", "--only", "-m", commitMessage, "--", ...params.commitFiles],
		signal,
		commands,
	);
	await runBin(
		"git",
		cwd,
		["push", "-u", "origin", branchName],
		signal,
		commands,
	);
	const pr = await runBin(
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
): Promise<PullRequestToolOutput> {
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
		nonEmpty(params.commitMessage, "commitMessage");
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
		const commitMessage = nonEmpty(params.commitMessage, "commitMessage");
		// Stage the listed files first so untracked new files become
		// committable, then commit only those pathspecs with `git commit
		// --only` to preserve unrelated staged changes.
		await runBin("git", cwd, ["add", "--", ...files], signal, commands);
		await runBin(
			"git",
			cwd,
			["commit", "--only", "-m", commitMessage, "--", ...files],
			signal,
			commands,
		);
		await runBin("git", cwd, ["push"], signal, commands);
		lines.push("Pushed new commit to the current branch.");
	}

	if (params.title !== undefined) {
		nonEmpty(params.title, "title");
		await runBin(
			"gh",
			cwd,
			["pr", "edit", "--title", params.title],
			signal,
			commands,
		);
		lines.push("Updated PR title.");
	}

	if (params.body !== undefined) {
		nonEmpty(params.body, "body");
		await runBin(
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
			await runBin("gh", cwd, ["pr", "ready", "--undo"], signal, commands);
			lines.push("Converted PR to draft.");
		} else {
			await runBin("gh", cwd, ["pr", "ready"], signal, commands);
			lines.push("Marked PR ready for review.");
		}
	}

	return { text: lines.join("\n"), commands };
}

function registerPullRequestTool<TInput extends object>(
	catalog: ToolCatalog,
	config: {
		readonly name: string;
		readonly label: string;
		readonly description: string;
		readonly promptSnippet: string;
		readonly parameters: Parameters<
			ToolCatalog["register"]
		>[0]["definition"]["parameters"];
		readonly execute: (
			params: TInput,
			cwd: string,
			signal: AbortSignal | undefined,
		) => Promise<PullRequestToolOutput>;
		readonly extractSecretPaths?: (input: TInput) => readonly string[];
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
					`${config.name} is available only in pull-request focus, not in ${focus} focus.`,
			} satisfies ToolPolicy,
			definition: {
				name: config.name,
				label: config.label,
				description: config.description,
				promptSnippet: config.promptSnippet,
				promptGuidelines: [
					`${config.name} performs git and gh write operations directly from explicit inputs. Do not add interactive confirmation prompts.`,
					"Use explicit commitFiles lists to avoid committing unrelated work. Only the listed files are staged.",
					"Fail clearly when required inputs are missing, the target branch is the repository default branch, or unsafe conditions are detected.",
					"Do not force-push, amend, rebase, or rewrite history.",
				],
				parameters: config.parameters,
				executionMode: "sequential",
				renderCall: (args, theme) =>
					renderPullRequestCall(config.name, args, theme),
				renderResult: renderLimitedTextResult,
				execute: async (_toolCallId, params, signal, _onUpdate, ctx) => {
					const startedAt = Date.now();
					const output = await config.execute(
						params as TInput,
						ctx.cwd,
						signal,
					);
					const limited = await limitToolOutput(output.text, {
						tempPrefix: "pi-pull-request-tool",
						fileName: `${config.name}.txt`,
						emptyMessage: "(no output)",
					});
					return {
						content: [{ type: "text", text: limited.text }],
						details: {
							commands: output.commands,
							durationMs: Date.now() - startedAt,
							output: limited.output,
							truncated: limited.truncated,
							truncation: limited.truncation,
							fullOutputPath: limited.fullOutputPath,
						} satisfies PullRequestToolDetails,
					} satisfies AgentToolResult<PullRequestToolDetails>;
				},
			},
		}),
	);
}

export function registerPullRequestTools(catalog: ToolCatalog): void {
	registerPullRequestTool<CreatePullRequestInput>(catalog, {
		name: "create_pull_request",
		label: "create pull request",
		description:
			"Create a new draft pull request from specified commit files. Creates a new branch, stages only the listed files, commits, pushes, and opens a draft PR with gh.",
		parameters: createPullRequestSchema,
		promptSnippet: "Create a draft pull request from explicit files",
		extractSecretPaths: (input) => input.commitFiles,
		execute: createPullRequest,
	});

	registerPullRequestTool<UpdatePullRequestInput>(catalog, {
		name: "update_pull_request",
		label: "update pull request",
		description:
			"Update the pull request associated with the current branch: push new commits from explicit files, and/or update title, body, or draft/ready state.",
		parameters: updatePullRequestSchema,
		promptSnippet: "Update the PR for the current branch",
		extractSecretPaths: (input) => input.commitFiles ?? [],
		execute: updatePullRequest,
	});
}
