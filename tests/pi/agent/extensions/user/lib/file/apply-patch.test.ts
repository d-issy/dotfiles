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

describe("apply_patch", () => {
	it("applies multiple operation kinds using pre-edit line numbers", async () => {
		const root = tempRepo();
		writeFileSync(
			join(root, "src", "example.txt"),
			["one", "two", "three", "four", "five", "six", ""].join("\n"),
		);

		const result = await executeApplyPatch(
			root,
			{
				path: "src/example.txt",
				replaces: [
					{ oldText: "two", newText: "TWO", startLineNo: 2, endLineNo: 2 },
				],
				removeLineRanges: [{ startLineNo: 4, endLineNo: 4 }],
				insertLines: [{ insertAfterLineNo: 5, contentLines: ["inserted"] }],
				replaceLineRanges: [
					{ startLineNo: 6, endLineNo: 6, contentLines: ["SIX"] },
				],
			},
			undefined,
		);

		assert.equal(
			readFileSync(join(root, "src", "example.txt"), "utf8"),
			["one", "TWO", "three", "five", "inserted", "SIX", ""].join("\n"),
		);
		assert.equal(result.details.operation, "apply_patch");
		assert.equal(result.details.path, "src/example.txt");
		assert.equal(result.details.edits, 4);
		assert.ok(typeof result.details.diff === "string");
		assert.ok(typeof result.details.patch === "string");
	});

	it("reports candidate ranges when text replacement is ambiguous", async () => {
		const root = tempRepo();
		writeFileSync(join(root, "src", "example.txt"), "same\nother\nsame\n");

		await assert.rejects(
			executeApplyPatch(
				root,
				{
					path: "src/example.txt",
					replaces: [{ oldText: "same", newText: "changed" }],
				},
				undefined,
			),
			/Candidate ranges: 1-1, 3-3/u,
		);
	});

	it("inserts after the last line when the file ends with a newline", async () => {
		const root = tempRepo();
		const path = join(root, "src", "example.txt");
		writeFileSync(path, "line 1\nline 2\n");

		await executeApplyPatch(
			root,
			{
				path: "src/example.txt",
				insertLines: [{ insertAfterLineNo: 2, contentLines: ["line 3"] }],
			},
			undefined,
		);

		assert.equal(readFileSync(path, "utf8"), "line 1\nline 2\nline 3\n");
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
					insertLines: [{ insertAfterLineNo: 1, contentLines: ["line 1"] }],
				},
				undefined,
			),
			/ENOENT|No such file or directory/u,
		);
	});

	it("rejects invalid line usage before mutating the file", async () => {
		const root = tempRepo();
		const path = join(root, "src", "example.txt");
		writeFileSync(path, "one\ntwo\nthree\n");

		await assert.rejects(
			executeApplyPatch(
				root,
				{
					path: "src/example.txt",
					removeLineRanges: [{ startLineNo: 2, endLineNo: 2 }],
					replaceLineRanges: [
						{ startLineNo: 2, endLineNo: 3, contentLines: ["changed"] },
					],
				},
				undefined,
			),
			/Line 2 is used by multiple apply_patch operations/u,
		);
		assert.equal(readFileSync(path, "utf8"), "one\ntwo\nthree\n");
	});

	it("requires exactly one insert position", async () => {
		const root = tempRepo();
		writeFileSync(join(root, "src", "example.txt"), "one\n");

		await assert.rejects(
			executeApplyPatch(
				root,
				{
					path: "src/example.txt",
					insertLines: [
						{
							insertAfterLineNo: 1,
							insertBeforeLineNo: 1,
							contentLines: ["bad"],
						},
					],
				},
				undefined,
			),
			/requires exactly one of insertAfterLineNo or insertBeforeLineNo/u,
		);
	});
});
