import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { executeEditChunk, executeReadChunk } from "#pi-user/lib/file/chunk";

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

		const editResult = await executeEditChunk(
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
		const editContent = editResult.content[0];
		assert.equal(editContent?.type, "text");
		assert.match(editContent.text, /^Diff:\n/u);
		assert.match(editContent.text, /-2 beta/u);
		assert.match(editContent.text, /\+2 BETA/u);
		assert.match(editContent.text, /Applied 2 chunk edits\.$/u);
		assert.equal(editResult.details.path, "src/demo.txt");
		assert.equal(editResult.details.replacements, 2);
		assert.equal(editResult.details.firstChangedLine, 2);
		assert.match(editResult.details.diff, /-2 beta/u);
		assert.match(editResult.details.diff, /\+2 BETA/u);
		assert.match(editResult.details.diff, /-5 epsilon/u);
		assert.match(editResult.details.diff, /\+4 tail/u);
		assert.match(editResult.details.patch, /--- src\/demo\.txt/u);
	});

	it("accepts anchors copied with a leading @ and warns", async () => {
		const root = tempRepo();
		const readResult = await executeReadChunk(
			root,
			{ path: "src/demo.txt" },
			undefined,
		);
		const anchors = anchorsByLine(resultText(readResult));

		const editResult = await executeEditChunk(
			root,
			{
				path: "src/demo.txt",
				edits: [
					{
						old_range: [`@${anchors[1]}`, `@${anchors[1]}`],
						new_lines: ["BETA"],
					},
				],
			},
			undefined,
		);

		assert.equal(
			readFileSync(join(root, "src", "demo.txt"), "utf8"),
			["alpha", "BETA", "gamma", "delta", "epsilon", ""].join("\n"),
		);
		const editContent = editResult.content[0];
		assert.equal(editContent?.type, "text");
		assert.match(editContent.text, /^Warning: Removed leading @/u);
		assert.deepEqual(editResult.details.warnings, [
			`Removed leading @ from edit_chunk anchor '@${anchors[1]}'. Use '${anchors[1]}' in old_range next time.`,
		]);
	});

	it("omits large diffs from the LLM-facing edit result content", async () => {
		const root = tempRepo();
		writeFileSync(
			join(root, "src", "large.txt"),
			[
				...Array.from({ length: 60 }, (_, index) => `old ${index + 1}`),
				"",
			].join("\n"),
		);

		const readResult = await executeReadChunk(
			root,
			{ path: "src/large.txt" },
			undefined,
		);
		const anchors = anchorsByLine(resultText(readResult));
		const editResult = await executeEditChunk(
			root,
			{
				path: "src/large.txt",
				edits: [
					{
						old_range: [anchors[0], anchors[59]],
						new_lines: Array.from(
							{ length: 60 },
							(_, index) => `new ${index + 1}`,
						),
					},
				],
			},
			undefined,
		);

		const editContent = editResult.content[0];
		assert.equal(editContent?.type, "text");
		assert.match(editContent.text, /^Diff omitted from tool result/u);
		assert.doesNotMatch(editContent.text, /Diff:\n/u);
		assert.match(editContent.text, /Applied 1 chunk edits\.$/u);
		assert.match(editResult.details.diff, /- 1 old 1/u);
		assert.match(editResult.details.diff, /\+ 1 new 1/u);
	});

	it("shows continuation offset when more lines remain", async () => {
		const root = tempRepo();
		writeFileSync(
			join(root, "src", "long.txt"),
			[
				...Array.from({ length: 205 }, (_, index) => `line ${index + 1}`),
				"",
			].join("\n"),
		);

		const readResult = await executeReadChunk(
			root,
			{ path: "src/long.txt" },
			undefined,
		);
		const output = resultText(readResult);

		assert.match(output, /Showing 200 of 205 line\(s\)\./u);
		assert.match(
			output,
			/\[5 more lines in file\. Use offset=201 to continue, or use grep to find the relevant lines first\.\]/u,
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
					edits: [{ old_range: [12, 12], new_lines: ["nope"] }],
				},
				undefined,
			),
			/Use read_chunk anchors, not line numbers/u,
		);
		await assert.rejects(
			executeEditChunk(
				root,
				{
					path: "src/demo.txt",
					edits: [{ old_range: ["12", "12"], new_lines: ["nope"] }],
				},
				undefined,
			),
			/Use read_chunk anchors, not line numbers/u,
		);
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
