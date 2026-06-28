import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";
import {
	executeMove,
	executeRemove,
	normalizeStringOrArray,
} from "#pi-user/lib/file/operations";

const tempParents: string[] = [];

afterEach(() => {
	for (const root of tempParents.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

function tempParent(): string {
	const parent = mkdtempSync(join(tmpdir(), "pi-file-operations-suite-"));
	tempParents.push(parent);
	return parent;
}

function tempRepo(): string {
	const root = mkdtempSync(join(tempParent(), "repo-"));
	execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
	writeFileSync(join(root, ".gitignore"), "ignored.txt\nignored-dir/\n");
	mkdirSync(join(root, "src"), { recursive: true });
	writeFileSync(join(root, "src", "one.txt"), "one\n");
	writeFileSync(join(root, "src", "two.txt"), "two\n");
	writeFileSync(join(root, "ignored.txt"), "ignored\n");
	mkdirSync(join(root, "ignored-dir"), { recursive: true });
	writeFileSync(join(root, "ignored-dir", "ignored.txt"), "ignored\n");
	return root;
}

describe("file operations", () => {
	it("normalizes string and array inputs defensively", () => {
		assert.deepEqual(normalizeStringOrArray("a"), ["a"]);
		assert.deepEqual(normalizeStringOrArray(["a", 1, "b", null]), ["a", "b"]);
		assert.deepEqual(normalizeStringOrArray(undefined), []);
	});

	it("removes files after repository and ignore checks", async () => {
		const root = tempRepo();

		const result = await executeRemove(
			root,
			{ path: "src/one.txt" },
			undefined,
		);

		assert.equal(existsSync(join(root, "src", "one.txt")), false);
		assert.deepEqual(result.details, {
			operation: "rm",
			removed: ["src/one.txt"],
		});
		assert.match(resultText(result), /Removed src\/one\.txt/u);
	});

	it("rejects missing, ignored, outside, and aborted removes before mutation", async () => {
		const root = tempRepo();
		const aborted = new AbortController();
		aborted.abort();

		await assert.rejects(
			executeRemove(root, { path: [] }, undefined),
			/Removing requires at least one path/u,
		);
		await assert.rejects(
			executeRemove(root, { path: "missing.txt" }, undefined),
			/No such file or directory: missing\.txt/u,
		);
		await assert.rejects(
			executeRemove(root, { path: "ignored.txt" }, undefined),
			/Removing ignored files is not allowed: ignored\.txt/u,
		);
		await assert.rejects(
			executeRemove(root, { path: resolve(root, "..") }, undefined),
			/Removing outside the repository is not allowed/u,
		);
		await assert.rejects(
			executeRemove(root, { path: "src/one.txt" }, aborted.signal),
			/Tool execution was aborted/u,
		);
		assert.equal(existsSync(join(root, "src", "one.txt")), true);
	});

	it("moves one source to a file path and multiple sources into a directory", async () => {
		const root = tempRepo();
		mkdirSync(join(root, "dest"));

		const single = await executeMove(
			root,
			{ source: "src/one.txt", destination: "renamed.txt" },
			undefined,
		);
		const multiple = await executeMove(
			root,
			{ source: ["src/two.txt", "renamed.txt"], destination: "dest" },
			undefined,
		);

		assert.equal(readFileSync(join(root, "dest", "two.txt"), "utf8"), "two\n");
		assert.equal(
			readFileSync(join(root, "dest", "renamed.txt"), "utf8"),
			"one\n",
		);
		assert.deepEqual(single.details.moves, [
			{ source: "src/one.txt", destination: "renamed.txt" },
		]);
		assert.deepEqual(multiple.details.moves, [
			{ source: "src/two.txt", destination: "dest/two.txt" },
			{ source: "renamed.txt", destination: "dest/renamed.txt" },
		]);
	});

	it("rejects unsafe move inputs before renaming", async () => {
		const root = tempRepo();
		mkdirSync(join(root, "dest"));
		writeFileSync(join(root, "dest", "one.txt"), "already here\n");
		const aborted = new AbortController();
		aborted.abort();

		await assert.rejects(
			executeMove(root, { source: [], destination: "dest" }, undefined),
			/Moving requires at least one source/u,
		);
		await assert.rejects(
			executeMove(
				root,
				{ source: ["src/one.txt", "src/two.txt"], destination: "new-dir" },
				undefined,
			),
			/Destination must be an existing directory/u,
		);
		await assert.rejects(
			executeMove(
				root,
				{ source: "src/one.txt", destination: "ignored.txt" },
				undefined,
			),
			/Moving to ignored files is not allowed: ignored\.txt/u,
		);
		await assert.rejects(
			executeMove(
				root,
				{ source: "ignored.txt", destination: "dest/moved.txt" },
				undefined,
			),
			/Moving ignored files is not allowed: ignored\.txt/u,
		);
		await assert.rejects(
			executeMove(
				root,
				{ source: "src/one.txt", destination: "dest/one.txt" },
				undefined,
			),
			/Destination already exists: dest\/one\.txt/u,
		);
		await assert.rejects(
			executeMove(
				root,
				{ source: "src/one.txt", destination: "dest/new.txt" },
				aborted.signal,
			),
			/Tool execution was aborted/u,
		);
		assert.equal(existsSync(join(root, "src", "one.txt")), true);
	});
});

function resultText(result: Awaited<ReturnType<typeof executeRemove>>): string {
	const content = result.content[0];
	return content?.type === "text" ? content.text : "";
}
