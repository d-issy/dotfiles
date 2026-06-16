import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
	buildDetails,
	formatDuration,
	formatLlmOutput,
	isProjectToolDetails,
	statusLine,
} from "./details";
import type { MutableCommandState } from "./details";

type StateOverrides = Partial<Omit<MutableCommandState, "output">> & {
	readonly output?: Pick<MutableCommandState["output"], "snapshot">;
};

function state(overrides: StateOverrides = {}): MutableCommandState {
	return {
		config: {
			index: 0,
			label: "demo",
			command: "demo",
			arguments: [],
			displayLabel: "demo",
			displayCommand: "pnpm test",
			absoluteCwd: "/repo",
			displayCwd: ".",
			timeoutSeconds: 120,
		},
		output: {
			snapshot: () => ({
				content: "done\n",
				truncated: false,
				totalLines: 1,
				totalBytes: 5,
			}),
		},
		status: "succeeded",
		startedAt: 1_000,
		endedAt: 2_500,
		...overrides,
	} as MutableCommandState;
}

describe("project tool details", () => {
	it("builds command details from mutable command state", () => {
		assert.deepEqual(buildDetails("test", [state()], "finished"), {
			kind: "project-tool",
			toolName: "test",
			status: "finished",
			commandCount: 1,
			failed: false,
			commands: [
				{
					label: "demo",
					command: "pnpm test",
					cwd: ".",
					timeoutSeconds: 120,
					status: "succeeded",
					exitCode: undefined,
					error: undefined,
					output: "done\n",
					fullOutputPath: undefined,
					truncated: false,
					durationMs: 1_500,
				},
			],
		});
	});

	it("formats status and duration variants", () => {
		assert.equal(statusLine({ status: "succeeded" } as never), "exit 0");
		assert.equal(
			statusLine({ status: "failed", exitCode: 2 } as never),
			"exit 2",
		);
		assert.equal(
			statusLine({ status: "failed", error: "boom" } as never),
			"boom",
		);
		assert.equal(statusLine({ status: "running" } as never), "running");
		assert.equal(formatDuration(undefined), undefined);
		assert.equal(formatDuration(1_250), "1.3s");
	});

	it("formats llm output for success and failure", () => {
		const success = buildDetails("test", [state()], "finished");
		assert.match(formatLlmOutput(success), /Project tool "test" succeeded\./u);
		assert.match(formatLlmOutput(success), /duration: 1\.5s/u);

		const failed = buildDetails(
			"test",
			[
				state({
					status: "failed",
					exitCode: 1,
					output: {
						snapshot: () => ({
							content: "",
							truncated: true,
							fullOutputPath: "/tmp/full.log",
							totalLines: 0,
							totalBytes: 0,
						}),
					},
				}),
			],
			"finished",
		);

		const output = formatLlmOutput(failed);
		assert.match(output, /failed: 1 of 1 commands failed/u);
		assert.match(output, /\(no output\)/u);
		assert.match(output, /Full output: \/tmp\/full\.log/u);
	});

	it("recognizes project tool details", () => {
		assert.equal(
			isProjectToolDetails(buildDetails("test", [], "running")),
			true,
		);
		assert.equal(
			isProjectToolDetails({ kind: "project-tool", commands: [] }),
			true,
		);
		assert.equal(isProjectToolDetails({ kind: "other", commands: [] }), false);
		assert.equal(isProjectToolDetails(null), false);
	});
});
