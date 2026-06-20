import assert from "node:assert/strict";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, it, vi } from "vitest";
import { executeProjectTool } from "#pi-user/lib/tool/project/execute";
import type {
	ProjectToolInput,
	ResolvedProjectTool,
	ResolvedProjectToolCommand,
} from "#pi-user/lib/tool/project/types";

const mocks = vi.hoisted(() => ({
	exec: vi.fn(),
	createLocalBashOperations: vi.fn(),
	settingsCreate: vi.fn(),
}));

vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@earendil-works/pi-coding-agent")>();
	return {
		...actual,
		createLocalBashOperations: mocks.createLocalBashOperations,
		SettingsManager: { create: mocks.settingsCreate },
	};
});

function command(
	overrides: Partial<ResolvedProjectToolCommand> = {},
): ResolvedProjectToolCommand {
	return {
		index: 0,
		label: "demo",
		displayLabel: "demo",
		command: "pnpm",
		arguments: [{ kind: "literal", value: "test" }],
		displayCommand: "pnpm test",
		absoluteCwd: "/repo",
		displayCwd: ".",
		timeoutSeconds: 30,
		...overrides,
	};
}

function tool(
	overrides: Partial<ResolvedProjectTool> = {},
): ResolvedProjectTool {
	return {
		name: "demo_tool",
		description: "Run demo",
		projectRoot: "/repo",
		parameters: {},
		parametersSchema: { type: "object" } as never,
		executionMode: "sequential",
		commands: [command()],
		...overrides,
	};
}

function context(): ExtensionContext {
	return { cwd: "/repo" } as ExtensionContext;
}

describe("executeProjectTool", () => {
	beforeEach(() => {
		mocks.exec.mockReset();
		mocks.createLocalBashOperations.mockReset();
		mocks.settingsCreate.mockReset();
		mocks.createLocalBashOperations.mockReturnValue({ exec: mocks.exec });
		mocks.settingsCreate.mockReturnValue({
			getShellPath: () => "/bin/zsh",
			getShellCommandPrefix: () => "set -euo pipefail",
		});
	});

	it("runs sequential commands with shell settings and streams updates", async () => {
		const calls: string[] = [];
		mocks.exec.mockImplementation(async (cmd, cwd, options) => {
			calls.push(`${cwd}:${cmd}`);
			options.onData(Buffer.from(`output from ${cmd}\n`));
			return { exitCode: 0 };
		});
		const onUpdate = vi.fn();

		const result = await executeProjectTool(
			tool({
				commands: [
					command({
						index: 0,
						label: "lint",
						displayLabel: "lint",
						arguments: [{ kind: "literal", value: "lint" }],
					}),
					command({
						index: 1,
						label: "test",
						displayLabel: "test",
						arguments: [{ kind: "literal", value: "test" }],
						absoluteCwd: "/repo/app",
						displayCwd: "app",
						timeoutSeconds: 60,
					}),
				],
			}),
			{},
			context(),
			undefined,
			onUpdate,
		);

		assert.deepEqual(calls, [
			"/repo:set -euo pipefail\n'pnpm' 'lint'",
			"/repo/app:set -euo pipefail\n'pnpm' 'test'",
		]);
		assert.equal(mocks.settingsCreate.mock.calls[0]?.[0], "/repo");
		assert.deepEqual(mocks.createLocalBashOperations.mock.calls[0]?.[0], {
			shellPath: "/bin/zsh",
		});
		assert.equal(result.details.status, "finished");
		assert.equal(result.details.failed, false);
		assert.equal(result.details.commands[0]?.status, "succeeded");
		assert.equal(result.details.commands[1]?.cwd, "app");
		assert.match(resultText(result), /succeeded/u);
		assert.equal(onUpdate.mock.calls.length > 0, true);
		assert.equal(onUpdate.mock.calls[0]?.[0].details.status, "running");
	});

	it("captures non-zero exits, timeouts, aborts, and thrown errors", async () => {
		mocks.settingsCreate.mockReturnValue({
			getShellPath: () => "/bin/bash",
			getShellCommandPrefix: () => undefined,
		});
		mocks.exec.mockImplementation(async (cmd, _cwd, options) => {
			options.onData(Buffer.from(`${cmd}\n`));
			if (cmd.includes("nonzero")) return { exitCode: 2 };
			if (cmd.includes("timeout")) throw new Error("timeout:5");
			if (cmd.includes("abort")) throw new Error("aborted");
			throw new Error("boom");
		});

		const result = await executeProjectTool(
			tool({
				executionMode: "parallel",
				commands: [
					command({
						index: 0,
						label: "nonzero",
						displayLabel: "nonzero",
						arguments: [{ kind: "literal", value: "nonzero" }],
					}),
					command({
						index: 1,
						label: "timeout",
						displayLabel: "timeout",
						arguments: [{ kind: "literal", value: "timeout" }],
					}),
					command({
						index: 2,
						label: "abort",
						displayLabel: "abort",
						arguments: [{ kind: "literal", value: "abort" }],
					}),
					command({
						index: 3,
						label: "boom",
						displayLabel: "boom",
						arguments: [{ kind: "literal", value: "boom" }],
					}),
				],
			}),
			{} satisfies ProjectToolInput,
			context(),
			new AbortController().signal,
			undefined,
		);

		assert.equal(result.details.failed, true);
		assert.deepEqual(
			result.details.commands.map((item) => ({
				label: item.label,
				status: item.status,
				exitCode: item.exitCode,
				error: item.error,
			})),
			[
				{
					label: "nonzero",
					status: "failed",
					exitCode: 2,
					error: undefined,
				},
				{
					label: "timeout",
					status: "failed",
					exitCode: null,
					error: "timed out after 5s",
				},
				{
					label: "abort",
					status: "failed",
					exitCode: null,
					error: "aborted",
				},
				{
					label: "boom",
					status: "failed",
					exitCode: null,
					error: "boom",
				},
			],
		);
		assert.match(resultText(result), /failed: 4 of 4/u);
	});
});

function resultText(
	result: Awaited<ReturnType<typeof executeProjectTool>>,
): string {
	const content = result.content[0];
	return content?.type === "text" ? content.text : "";
}
