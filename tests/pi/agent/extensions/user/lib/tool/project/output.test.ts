import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
	StreamingOutput,
	truncateLines,
} from "#pi-user/lib/tool/project/output";

describe("project tool output", () => {
	it("keeps only the requested tail lines", () => {
		assert.equal(truncateLines("one\ntwo\nthree", 2), "two\nthree");
		assert.equal(truncateLines("one\ntwo", 3), "one\ntwo");
	});

	it("tracks streaming output snapshots", () => {
		const output = new StreamingOutput("demo command", {
			maxLines: 3,
			maxBytes: 1024,
		});

		output.append(Buffer.from("one\n"));
		output.append(Buffer.from("two"));
		output.finish();

		assert.deepEqual(output.snapshot(), {
			content: "one\ntwo",
			truncated: false,
			fullOutputPath: undefined,
			totalLines: 2,
			totalBytes: 7,
		});
	});

	it("spools full output to a safe temporary file after truncation", () => {
		const output = new StreamingOutput("demo command!", {
			maxLines: 1,
			maxBytes: 1024,
		});

		output.append(Buffer.from("one\ntwo"));
		const snapshot = output.snapshot();

		assert.equal(snapshot.content, "two");
		assert.equal(snapshot.truncated, true);
		assert.ok(snapshot.fullOutputPath?.endsWith("demo_command.log"));
		assert.ok(existsSync(snapshot.fullOutputPath ?? ""));
		assert.equal(
			readFileSync(snapshot.fullOutputPath ?? "", "utf8"),
			"one\ntwo",
		);
	});
});
