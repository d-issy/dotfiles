import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
	assertNoIgnoredDescendants,
	assertRepoPathAllowed,
	createFsGuardContext,
	displayRepoPath,
	resolveRepoPath,
} from "#pi-user/lib/file/guard";

function tempRepo(): string {
	const root = mkdtempSync(join(tmpdir(), "pi-file-guard-"));
	execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
	writeFileSync(join(root, ".gitignore"), "ignored.txt\nignored-dir/\n");
	mkdirSync(join(root, "src", "nested"), { recursive: true });
	writeFileSync(join(root, "src", "nested", "keep.txt"), "keep\n");
	writeFileSync(join(root, "ignored.txt"), "ignored\n");
	mkdirSync(join(root, "ignored-dir"), { recursive: true });
	writeFileSync(join(root, "ignored-dir", "ignored.txt"), "ignored\n");
	return root;
}

describe("file guard", () => {
	it("resolves and displays repository paths safely", () => {
		const root = tempRepo();

		assert.equal(resolveRepoPath(root, "src", "Reading"), join(root, "src"));
		assert.equal(displayRepoPath(root, root), ".");
		assert.equal(
			displayRepoPath(root, join(root, "src", "nested")),
			"src/nested",
		);
		assert.equal(
			displayRepoPath(root, resolve(root, "..")),
			resolve(root, ".."),
		);
		assert.throws(
			() => resolveRepoPath(root, "  ", "Reading"),
			/Path must not be empty/u,
		);
	});

	it("rejects paths outside the repo, inside .git, or ignored by gitignore", async () => {
		const root = tempRepo();
		const ctx = await createFsGuardContext(join(root, "src"));

		assert.equal(ctx.repoRoot, root);
		assert.equal(ctx.cwd, join(root, "src"));
		await assertRepoPathAllowed(ctx, join(root, "src", "nested"), "Reading");
		await assert.rejects(
			assertRepoPathAllowed(ctx, resolve(root, ".."), "Reading"),
			/Reading outside the repository is not allowed/u,
		);
		await assert.rejects(
			assertRepoPathAllowed(ctx, join(root, ".git", "config"), "Reading"),
			/Reading inside \.git is not allowed/u,
		);
		await assert.rejects(
			assertRepoPathAllowed(ctx, join(root, "ignored.txt"), "Reading"),
			/Reading ignored files is not allowed/u,
		);
	});

	it("rejects missing paths and ignored descendants during recursive checks", async () => {
		const root = tempRepo();
		mkdirSync(join(root, "src", "with-ignored"), { recursive: true });
		writeFileSync(
			join(root, "src", "with-ignored", "ignored.txt"),
			"ignored\n",
		);
		writeFileSync(
			join(root, "src", "with-ignored", ".gitignore"),
			"ignored.txt\n",
		);
		const ctx = await createFsGuardContext(root);

		await assertNoIgnoredDescendants(
			ctx,
			join(root, "src", "nested"),
			"Removing",
		);
		await assert.rejects(
			assertNoIgnoredDescendants(ctx, join(root, "missing"), "Removing"),
			/No such file or directory: missing/u,
		);
		await assert.rejects(
			assertNoIgnoredDescendants(
				ctx,
				join(root, "src", "with-ignored"),
				"Removing",
			),
			/Removing ignored files is not allowed: src\/with-ignored\/ignored\.txt/u,
		);
	});

	it("allows non-git temp projects without running gitignore checks", async () => {
		const root = mkdtempSync(join(tmpdir(), "pi-file-guard-no-git-"));
		writeFileSync(join(root, "ignored.txt"), "not actually ignored\n");
		const ctx = await createFsGuardContext(root);

		assert.equal(ctx.isGitRepo, false);
		await assertRepoPathAllowed(ctx, join(root, "ignored.txt"), "Reading");

		rmSync(root, { recursive: true, force: true });
	});
});
