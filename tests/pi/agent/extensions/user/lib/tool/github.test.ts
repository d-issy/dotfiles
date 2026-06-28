import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", async (importActual) => ({
	...(await importActual<typeof import("node:child_process")>()),
	execFile: execFileMock,
}));

import { createToolCatalog } from "#pi-user/lib/tool/catalog";
import { registerGithubTools } from "#pi-user/lib/tool/github";

type ExecArgs = readonly unknown[];

type Call = {
	readonly bin: string;
	readonly args: readonly string[];
};

function ctx(cwd: string): ExtensionContext {
	return { cwd } as ExtensionContext;
}

function invoke(
	result: { readonly execute: (...args: never[]) => Promise<unknown> },
	params: unknown,
	cwd: string,
	signal?: AbortSignal,
): Promise<unknown> {
	return result.execute(
		"" as never,
		params as never,
		signal as never,
		undefined as never,
		ctx(cwd) as never,
	);
}

function defaultArgs(
	bin: string,
	args: readonly string[],
): Partial<Record<string, string>> {
	const key = `${bin} ${args.join(" ")}`;
	const map: Record<string, string> = {
		"git symbolic-ref --short refs/remotes/origin/HEAD": "origin/main\n",
	};
	return { [key]: map[key] ?? "" };
}

function setupExec(responses: {
	readonly stdout?: Partial<Record<string, string>>;
	readonly exitCodes?: Partial<Record<string, number>>;
	readonly calls?: Call[];
}): void {
	execFileMock.mockImplementation(
		(
			bin: string,
			args: ExecArgs,
			_options: unknown,
			callback: (
				error: Error | null,
				stdout: string | Buffer,
				stderr: string | Buffer,
			) => void,
		) => {
			if (responses.calls) {
				responses.calls.push({
					bin,
					args: args as unknown as readonly string[],
				});
			}
			const key = `${bin} ${(args as unknown as readonly string[]).join(" ")}`;
			const stdout = responses.stdout?.[key] ?? "";
			const exitCode = responses.exitCodes?.[key] ?? 0;
			// Node's execFile passes a non-null error when the exit code is non-zero.
			const error =
				exitCode === 0 ? null : ({ code: exitCode } as unknown as Error);
			callback(error, stdout, "");
		},
	);
}

function findTool(name: string): {
	readonly execute: (...args: never[]) => Promise<unknown>;
} {
	const catalog = createToolCatalog();
	registerGithubTools(catalog);
	const tool = catalog
		.list()
		.find((candidate) => candidate.definition.name === name);
	assert.ok(tool, `${name} tool should be registered`);
	return {
		execute: tool.definition.execute as (...args: never[]) => Promise<unknown>,
	};
}

function tempRepo(files: readonly string[]): string {
	const cwd = mkdtempSync(path.join(tmpdir(), "pi-github-test-"));
	for (const file of files) {
		const target = path.join(cwd, file);
		mkdirSync(path.dirname(target), { recursive: true });
		writeFileSync(target, "test\n");
	}
	return cwd;
}

async function reject(promise: Promise<unknown>): Promise<Error> {
	try {
		await promise;
		throw new Error("Expected promise to reject but it resolved.");
	} catch (error) {
		if (error instanceof Error) return error;
		return new Error(String(error));
	}
}

const validCreateInput = {
	branchName: "feature/test",
	commitFiles: ["src/a.ts", "src/b.ts"],
	commitMessage: "feat: add a and b",
	title: "Add a and b",
	body: "## Summary\n- adds a and b",
};

describe("create_pull_request", () => {
	beforeEach(() => {
		execFileMock.mockReset();
	});

	it("rejects an empty body", async () => {
		const create = findTool("create_pull_request");
		const error = await reject(
			invoke(create, { ...validCreateInput, body: "   " }, "/repo"),
		);
		assert.match(error.message, /body must not be empty/u);
		assert.equal(execFileMock.mock.calls.length, 0);
	});

	it("rejects an empty title and empty commitMessage", async () => {
		const create = findTool("create_pull_request");
		const titleError = await reject(
			invoke(create, { ...validCreateInput, title: "" }, "/repo"),
		);
		assert.match(titleError.message, /title must not be empty/u);

		const messageError = await reject(
			invoke(create, { ...validCreateInput, commitMessage: "" }, "/repo"),
		);
		assert.match(messageError.message, /commitMessage must not be empty/u);
	});

	it("rejects an empty commitFiles array", async () => {
		const create = findTool("create_pull_request");
		const error = await reject(
			invoke(create, { ...validCreateInput, commitFiles: [] }, "/repo"),
		);
		assert.match(error.message, /commitFiles must not be empty/u);
	});

	it("rejects branchName equal to the detected default branch", async () => {
		const calls: Call[] = [];
		setupExec({ calls });
		const create = findTool("create_pull_request");
		const error = await reject(
			invoke(create, { ...validCreateInput, branchName: "main" }, "/repo"),
		);
		assert.match(error.message, /repository default branch/u);
		// Detection may run, but no branch creation should happen.
		assert.ok(!calls.some((c) => c.bin === "git" && c.args[0] === "switch"));
	});

	it("stages existing files, then commits only listed files", async () => {
		const cwd = tempRepo(["src/a.ts", "src/b.ts"]);
		try {
			const calls: Call[] = [];
			setupExec({
				calls,
				stdout: {
					...defaultArgs("git", [
						"symbolic-ref",
						"--short",
						"refs/remotes/origin/HEAD",
					]),
					"gh pr create --draft --title Add a and b --body ## Summary\n- adds a and b":
						"https://github.com/owner/repo/pull/1\n",
				},
			});
			const create = findTool("create_pull_request");
			const result = (await invoke(create, validCreateInput, cwd)) as {
				readonly content: readonly { readonly text: string }[];
			};
			assert.match(result.content[0]?.text ?? "", /pull\/1/u);

			const commands = calls.map(
				(call) => `${call.bin} ${call.args.join(" ")}`,
			);
			const addIndex = commands.indexOf("git add -- src/a.ts src/b.ts");
			const commitIndex = commands.indexOf(
				"git commit --only -m feat: add a and b -- src/a.ts src/b.ts",
			);
			assert.notEqual(
				addIndex,
				-1,
				`git add should run; commands:\n${commands.join("\n")}`,
			);
			assert.notEqual(
				commitIndex,
				-1,
				`git commit --only should run; commands:\n${commands.join("\n")}`,
			);
			assert.ok(addIndex < commitIndex);
			assert.ok(!commands.some((cmd) => cmd.includes("diff --cached")));
			assert.ok(!commands.some((cmd) => cmd.startsWith("git reset ")));
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});
});

describe("update_pull_request", () => {
	beforeEach(() => {
		execFileMock.mockReset();
	});

	it("rejects when no update inputs are provided", async () => {
		const update = findTool("update_pull_request");
		const error = await reject(invoke(update, {}, "/repo"));
		assert.match(error.message, /No update inputs provided/u);
	});

	it("requires commitMessage when commitFiles is provided", async () => {
		const update = findTool("update_pull_request");
		const error = await reject(
			invoke(update, { commitFiles: ["src/a.ts"] }, "/repo"),
		);
		assert.match(error.message, /commitMessage must not be empty/u);
	});

	it("rejects empty commitFiles", async () => {
		const update = findTool("update_pull_request");
		const error = await reject(
			invoke(update, { commitFiles: [], commitMessage: "msg" }, "/repo"),
		);
		assert.match(error.message, /commitFiles must not be empty/u);
	});

	it("fails on the repository default branch before committing", async () => {
		const calls: Call[] = [];
		setupExec({
			calls,
			stdout: {
				"git symbolic-ref --short refs/remotes/origin/HEAD": "origin/main\n",
				"git rev-parse --abbrev-ref HEAD": "main\n",
			},
		});
		const update = findTool("update_pull_request");
		const error = await reject(
			invoke(
				update,
				{
					commitFiles: ["src/a.ts"],
					commitMessage: "msg",
				},
				"/repo",
			),
		);
		assert.match(error.message, /repository default branch/u);
		assert.ok(
			!calls.some((c) => c.args[0] === "add"),
			`should not stage on default branch; commands:\n${calls
				.map((c) => `${c.bin} ${c.args.join(" ")}`)
				.join("\n")}`,
		);
	});

	it("stages existing files, then commits only listed files", async () => {
		const cwd = tempRepo(["src/a.ts"]);
		try {
			const calls: Call[] = [];
			setupExec({
				calls,
				stdout: {
					"git symbolic-ref --short refs/remotes/origin/HEAD": "origin/main\n",
					"git rev-parse --abbrev-ref HEAD": "feature/test\n",
				},
			});
			const update = findTool("update_pull_request");
			const result = (await invoke(
				update,
				{ commitFiles: ["src/a.ts"], commitMessage: "msg" },
				cwd,
			)) as { readonly content: readonly { readonly text: string }[] };
			assert.match(result.content[0]?.text ?? "", /Pushed new commit/u);

			const commands = calls.map(
				(call) => `${call.bin} ${call.args.join(" ")}`,
			);
			const addIndex = commands.indexOf("git add -- src/a.ts");
			const commitIndex = commands.indexOf(
				"git commit --only -m msg -- src/a.ts",
			);
			assert.notEqual(
				addIndex,
				-1,
				`git add should run; commands:\n${commands.join("\n")}`,
			);
			assert.notEqual(
				commitIndex,
				-1,
				`git commit --only should run; commands:\n${commands.join("\n")}`,
			);
			assert.ok(addIndex < commitIndex);
			assert.ok(!commands.some((cmd) => cmd.includes("diff --cached")));
			assert.ok(!commands.some((cmd) => cmd.startsWith("git reset ")));
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});

	it("stages only existing rename/delete paths and commits all listed paths with --only", async () => {
		const cwd = tempRepo(["new/name.ts"]);
		try {
			const calls: Call[] = [];
			setupExec({
				calls,
				stdout: {
					"git symbolic-ref --short refs/remotes/origin/HEAD": "origin/main\n",
					"git rev-parse --abbrev-ref HEAD": "feature/test\n",
				},
			});
			const update = findTool("update_pull_request");
			await invoke(
				update,
				{
					commitFiles: ["old/name.ts", "new/name.ts", "deleted.ts"],
					commitMessage: "rename and delete",
				},
				cwd,
			);

			const commands = calls.map(
				(call) => `${call.bin} ${call.args.join(" ")}`,
			);
			assert.ok(
				commands.includes("git add -- new/name.ts"),
				`git add should stage only existing paths; commands:\n${commands.join("\n")}`,
			);
			assert.ok(
				commands.includes(
					"git commit --only -m rename and delete -- old/name.ts new/name.ts deleted.ts",
				),
				`git commit should use --only with all paths; commands:\n${commands.join("\n")}`,
			);
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});

	it("converts to draft with gh pr ready --undo", async () => {
		const calls: Call[] = [];
		setupExec({
			calls,
			stdout: {
				"git symbolic-ref --short refs/remotes/origin/HEAD": "origin/main\n",
				"git rev-parse --abbrev-ref HEAD": "feature/test\n",
			},
		});
		const update = findTool("update_pull_request");
		await invoke(update, { reviewStatus: "draft" }, "/repo");
		const commands = calls.map((call) => `${call.bin} ${call.args.join(" ")}`);
		assert.ok(
			commands.includes("gh pr ready --undo"),
			`should run gh pr ready --undo; commands:\n${commands.join("\n")}`,
		);
	});

	it("marks ready with gh pr ready", async () => {
		const calls: Call[] = [];
		setupExec({
			calls,
			stdout: {
				"git symbolic-ref --short refs/remotes/origin/HEAD": "origin/main\n",
				"git rev-parse --abbrev-ref HEAD": "feature/test\n",
			},
		});
		const update = findTool("update_pull_request");
		await invoke(update, { reviewStatus: "ready" }, "/repo");
		const commands = calls.map((call) => `${call.bin} ${call.args.join(" ")}`);
		assert.ok(
			commands.includes("gh pr ready"),
			`should run gh pr ready; commands:\n${commands.join("\n")}`,
		);
	});
});
