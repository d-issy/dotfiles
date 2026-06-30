import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";
import { executeApplyPatch } from "#pi-user/lib/file/apply-patch";

const tempParents: string[] = [];

afterEach(() => {
	for (const root of tempParents.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

function tempRepo(): string {
	const root = mkdtempSync(join(tmpdir(), "pi-apply-patch-suite-"));
	tempParents.push(root);
	execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
	writeFileSync(join(root, ".gitignore"), "ignored.txt\n");
	mkdirSync(join(root, "src"), { recursive: true });
	return root;
}

async function expectApplyPatchError(
	root: string,
	params: Parameters<typeof executeApplyPatch>[1],
	messageIncludes: readonly string[],
): Promise<void> {
	await assert.rejects(executeApplyPatch(root, params, undefined), (error) => {
		assert(error instanceof Error);
		for (const text of messageIncludes) {
			assert.ok(
				error.message.includes(text),
				`Expected error message to include ${JSON.stringify(text)}, got ${JSON.stringify(error.message)}`,
			);
		}
		return true;
	});
}

describe("apply_patch", () => {
	it("applies sed scripts and replaces on a temporary copy", async () => {
		const root = tempRepo();
		writeFileSync(
			join(root, "src", "example.txt"),
			["one", "two", "three", "four", "five", "six", ""].join("\n"),
		);

		const result = await executeApplyPatch(
			root,
			{
				path: "src/example.txt",
				sedScripts: ["4d;4a\\inserted"],
				replaces: [
					{ oldText: "two", newText: "TWO", startLineNo: 2, endLineNo: 2 },
				],
			},
			undefined,
		);

		assert.equal(
			readFileSync(join(root, "src", "example.txt"), "utf8"),
			["one", "TWO", "three", "five", "inserted", "six", ""].join("\n"),
		);
		assert.equal(result.details.operation, "apply_patch");
		assert.equal(result.details.path, "src/example.txt");
		assert.equal(result.details.edits, 2);
		assert.ok(typeof result.details.diff === "string");
		assert.ok(typeof result.details.patch === "string");
	});

	it("reports matched lines when text replacement is ambiguous", async () => {
		const root = tempRepo();
		writeFileSync(join(root, "src", "example.txt"), "same same\nother\nsame\n");

		await expectApplyPatchError(
			root,
			{
				path: "src/example.txt",
				replaces: [{ oldText: "same", newText: "changed" }],
			},
			[
				[
					"replaces[0] oldText matched multiple locations.",
					"Specify allowedReplacementLineRanges with the smallest line ranges that contain only intended replacements.",
					"Matched lines: [1, 3].",
					"Warning: oldText matched multiple times on the same line.",
					"Use a wider oldText, such as the full line or surrounding phrase, so the intended replacement is unambiguous.",
					"Lines with multiple matches:",
					"- line 1: 2 matches",
				].join("\n"),
			],
		);
	});

	it("replaces all matching text within the allowed replacement line ranges", async () => {
		const root = tempRepo();
		const path = join(root, "src", "example.txt");
		writeFileSync(
			path,
			["same", "keep", "same", "keep", "same", ""].join("\n"),
		);

		const result = await executeApplyPatch(
			root,
			{
				path: "src/example.txt",
				replaces: [
					{
						oldText: "same",
						newText: "changed",
						allowedReplacementLineRanges: [{ start: 1, end: 3 }],
					},
				],
			},
			undefined,
		);

		assert.equal(
			readFileSync(path, "utf8"),
			["changed", "keep", "changed", "keep", "same", ""].join("\n"),
		);
		assert.equal(result.details.edits, 2);
	});

	it("uses allowed replacement line ranges to disambiguate globally ambiguous text", async () => {
		const root = tempRepo();
		const path = join(root, "src", "example.txt");
		writeFileSync(
			path,
			["same", "keep", "same", "keep", "same", ""].join("\n"),
		);

		await executeApplyPatch(
			root,
			{
				path: "src/example.txt",
				replaces: [
					{
						oldText: "same",
						newText: "changed",
						allowedReplacementLineRanges: [{ start: 3, end: 3 }],
					},
				],
			},
			undefined,
		);

		assert.equal(
			readFileSync(path, "utf8"),
			["same", "keep", "changed", "keep", "same", ""].join("\n"),
		);
	});

	it("applies replace operations sequentially on a temporary copy", async () => {
		const root = tempRepo();
		const path = join(root, "src", "example.txt");
		writeFileSync(path, "one two\n");

		const result = await executeApplyPatch(
			root,
			{
				path: "src/example.txt",
				replaces: [
					{
						oldText: "one",
						newText: "two",
						allowedReplacementLineRanges: [{ start: 1, end: 1 }],
					},
					{
						oldText: "two two",
						newText: "done",
						allowedReplacementLineRanges: [{ start: 1, end: 1 }],
					},
				],
			},
			undefined,
		);

		assert.equal(readFileSync(path, "utf8"), "done\n");
		assert.equal(result.details.edits, 2);
	});

	it("does not mutate the file when a later sequential replace fails", async () => {
		const root = tempRepo();
		const path = join(root, "src", "example.txt");
		writeFileSync(path, "one\n");

		await expectApplyPatchError(
			root,
			{
				path: "src/example.txt",
				replaces: [
					{ oldText: "one", newText: "two" },
					{ oldText: "missing", newText: "done" },
				],
			},
			["replaces[1] oldText was not found."],
		);
		assert.equal(readFileSync(path, "utf8"), "one\n");
	});

	it("rejects multiple matches on the same line within an allowed replacement line range", async () => {
		const root = tempRepo();
		const path = join(root, "src", "example.txt");
		writeFileSync(path, "same same\n");

		await expectApplyPatchError(
			root,
			{
				path: "src/example.txt",
				replaces: [
					{
						oldText: "same",
						newText: "changed",
						allowedReplacementLineRanges: [{ start: 1, end: 1 }],
					},
				],
			},
			[
				[
					"replaces[0].allowedReplacementLineRanges[0] oldText matched multiple locations on line 1.",
					"Line ranges cannot disambiguate multiple matches on the same line.",
					"Use a wider oldText, such as the full line or surrounding phrase, so the intended replacement is unambiguous.",
				].join("\n"),
			],
		);
		assert.equal(readFileSync(path, "utf8"), "same same\n");
	});

	it("rejects an allowed replacement line range that contains no match", async () => {
		const root = tempRepo();
		const path = join(root, "src", "example.txt");
		writeFileSync(path, "same\nother\nsame\n");

		await expectApplyPatchError(
			root,
			{
				path: "src/example.txt",
				replaces: [
					{
						oldText: "same",
						newText: "changed",
						allowedReplacementLineRanges: [{ start: 2, end: 2 }],
					},
				],
			},
			[
				"replaces[0].allowedReplacementLineRanges[0] oldText did not match within the allowed replacement line range",
			],
		);
		assert.equal(readFileSync(path, "utf8"), "same\nother\nsame\n");
	});

	it("rejects allowed replacement line ranges with start after end", async () => {
		const root = tempRepo();
		const path = join(root, "src", "example.txt");
		writeFileSync(path, "same\nother\n");

		await expectApplyPatchError(
			root,
			{
				path: "src/example.txt",
				replaces: [
					{
						oldText: "same",
						newText: "changed",
						allowedReplacementLineRanges: [{ start: 2, end: 1 }],
					},
				],
			},
			["replaces[0].allowedReplacementLineRanges[0] start must be <= end"],
		);
		assert.equal(readFileSync(path, "utf8"), "same\nother\n");
	});

	it("uses sed append scripts", async () => {
		const root = tempRepo();
		const path = join(root, "src", "example.txt");
		writeFileSync(path, "line 1\nline 2\n");

		await executeApplyPatch(
			root,
			{
				path: "src/example.txt",
				sedScripts: ["2a\\line 3"],
			},
			undefined,
		);

		assert.equal(readFileSync(path, "utf8"), "line 1\nline 2\nline 3\n");
	});

	it("applies semicolon-separated sed commands sequentially", async () => {
		const root = tempRepo();
		const path = join(root, "src", "example.txt");
		writeFileSync(path, "alpha\nremove-me\nanchor\nomega\n");

		await executeApplyPatch(
			root,
			{
				path: "src/example.txt",
				sedScripts: ["2d;2a\\inserted"],
			},
			undefined,
		);

		assert.equal(
			readFileSync(path, "utf8"),
			"alpha\nanchor\ninserted\nomega\n",
		);
	});

	it("edits an existing untracked file created by write", async () => {
		const root = tempRepo();
		const path = join(root, "src", "created.txt");
		writeFileSync(path, "line 1\nline 2\n");

		const result = await executeApplyPatch(
			root,
			{
				path: "src/created.txt",
				replaces: [{ oldText: "line 2", newText: "changed" }],
			},
			undefined,
		);

		assert.equal(readFileSync(path, "utf8"), "line 1\nchanged\n");
		assert.equal(result.details.operation, "apply_patch");
		assert.equal(result.details.path, "src/created.txt");
		assert.equal(result.details.edits, 1);
		assert.ok(typeof result.details.diff === "string");
		assert.ok(typeof result.details.patch === "string");
	});

	it("does not create a missing file", async () => {
		const root = tempRepo();

		await assert.rejects(
			executeApplyPatch(
				root,
				{
					path: "src/missing.txt",
					sedScripts: ["1a\\line 1"],
				},
				undefined,
			),
			/ENOENT|No such file or directory/u,
		);
	});

	it("does not mutate the file when a sed script fails", async () => {
		const root = tempRepo();
		const path = join(root, "src", "example.txt");
		writeFileSync(path, "one\ntwo\nthree\n");

		await assert.rejects(
			executeApplyPatch(
				root,
				{
					path: "src/example.txt",
					sedScripts: ["s/one/changed/", "s/[//"],
				},
				undefined,
			),
			/sedScripts\[1\]/u,
		);
		assert.equal(readFileSync(path, "utf8"), "one\ntwo\nthree\n");
	});

	it("applies sed scripts in order", async () => {
		const root = tempRepo();
		const path = join(root, "src", "example.txt");
		writeFileSync(path, "one\n");

		await executeApplyPatch(
			root,
			{
				path: "src/example.txt",
				sedScripts: ["s/one/two/", "s/two/done/"],
			},
			undefined,
		);

		assert.equal(readFileSync(path, "utf8"), "done\n");
	});
});
