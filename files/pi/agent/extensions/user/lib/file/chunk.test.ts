import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { executeEditChunk, executeReadChunk } from "./chunk";

function tempRepo(): string {
	const root = mkdtempSync(join(tmpdir(), "pi-file-chunk-"));
	execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
	writeFileSync(join(root, ".gitignore"), "ignored.txt\n");
	mkdirSync(join(root, "src"), { recursive: true });
	writeFileSync(
		join(root, "src", "demo.txt"),
		["alpha", "beta", "gamma", "delta", "epsilon", ""].join("\n"),
	);
	writeFileSync(join(root, "ignored.txt"), "ignored\n");
	return root;
}

function resultText(
	result: Awaited<ReturnType<typeof executeReadChunk>>,
): string {
	const content = result.content[0];
	return content?.type === "text" ? content.text : "";
}

function anchorsByLine(output: string): string[] {
	return output
		.split("\n")
		.map((line) => line.match(/^\s*\d+ @([A-Za-z0-9]{3}|---) \| /u)?.[1])
		.filter((anchor): anchor is string => anchor !== undefined);
}

describe("chunk file tools", () => {
	it("reads file-wide unique anchors and edits multiple chunks", async () => {
		const root = tempRepo();
		const readResult = await executeReadChunk(
			root,
			{ path: "src/demo.txt" },
			undefined,
		);
		const anchors = anchorsByLine(resultText(readResult));

		assert.equal(anchors.length, 5);
		assert.ok(anchors.every((anchor) => anchor !== "---"));

		await executeEditChunk(
			root,
			{
				path: "src/demo.txt",
				edits: [
					{ old_range: [anchors[1], anchors[1]], new_lines: ["BETA"] },
					{ old_range: [anchors[3], anchors[4]], new_lines: ["tail"] },
				],
			},
			undefined,
		);

		assert.equal(
			readFileSync(join(root, "src", "demo.txt"), "utf8"),
			["alpha", "BETA", "gamma", "tail", ""].join("\n"),
		);
	});

	it("fails without modifying files when anchors are stale, reversed, or overlapping", async () => {
		const root = tempRepo();
		const readResult = await executeReadChunk(
			root,
			{ path: "src/demo.txt" },
			undefined,
		);
		const anchors = anchorsByLine(resultText(readResult));
		const original = readFileSync(join(root, "src", "demo.txt"), "utf8");

		await assert.rejects(
			executeEditChunk(
				root,
				{
					path: "src/demo.txt",
					edits: [{ old_range: ["zzz", "zzz"], new_lines: ["nope"] }],
				},
				undefined,
			),
			/Anchor 'zzz' is unavailable/u,
		);
		await assert.rejects(
			executeEditChunk(
				root,
				{
					path: "src/demo.txt",
					edits: [{ old_range: [anchors[2], anchors[1]], new_lines: ["nope"] }],
				},
				undefined,
			),
			/appears after end anchor/u,
		);
		await assert.rejects(
			executeEditChunk(
				root,
				{
					path: "src/demo.txt",
					edits: [
						{ old_range: [anchors[1], anchors[3]], new_lines: ["one"] },
						{ old_range: [anchors[2], anchors[4]], new_lines: ["two"] },
					],
				},
				undefined,
			),
			/ranges must not overlap/u,
		);

		assert.equal(readFileSync(join(root, "src", "demo.txt"), "utf8"), original);
	});

	it("hides ambiguous anchors and rejects unsafe paths", async () => {
		const root = tempRepo();
		writeFileSync(
			join(root, "src", "ambiguous.txt"),
			[...Array.from({ length: 40 }, () => "else:"), ""].join("\n"),
		);

		const readResult = await executeReadChunk(
			root,
			{ path: "src/ambiguous.txt" },
			undefined,
		);
		const output = resultText(readResult);

		assert.match(output, /\d+ @--- \| else:/u);
		assert.ok(readResult.details.ambiguousLines > 0);
		await assert.rejects(
			executeReadChunk(root, { path: "ignored.txt" }, undefined),
			/Reading chunk from ignored files is not allowed/u,
		);
		writeFileSync(join(root, ".envrc"), "SECRET=value\n");
		await assert.rejects(
			executeReadChunk(root, { path: ".envrc" }, undefined),
			/Reading chunk from secret files is not allowed/u,
		);
		const outsideDir = mkdtempSync(join(tmpdir(), "pi-file-chunk-outside-"));
		const outsidePath = join(outsideDir, "outside.txt");
		writeFileSync(outsidePath, ["outside", "file", ""].join("\n"));
		const outsideResult = await executeReadChunk(
			root,
			{ path: outsidePath },
			undefined,
		);
		const outsideOutput = resultText(outsideResult);
		assert.equal(outsideResult.details.visibleAnchors, 0);
		assert.match(outsideOutput, /Anchors are disabled/u);
		assert.match(outsideOutput, /1 \| outside/u);
		assert.doesNotMatch(outsideOutput, /@[A-Za-z0-9]{3} \|/u);
		assert.doesNotMatch(outsideOutput, /@--- \|/u);
		await assert.rejects(
			executeEditChunk(
				root,
				{ path: resolve(root, "..", "outside.txt"), edits: [] },
				undefined,
			),
			/Editing chunk in outside the repository is not allowed/u,
		);
	});
});
