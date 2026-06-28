import { execFile } from "node:child_process";
import { lstat, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { ToolError, isErrnoCode } from "./errors";
type IgnoreCache = Map<string, boolean>;

export type FsGuardContext = {
	cwd: string;
	repoRoot: string;
	isGitRepo: boolean;
	ignoreCache: IgnoreCache;
};

const execFileAsync = promisify(execFile);

export async function createFsGuardContext(
	cwd: string,
): Promise<FsGuardContext> {
	const repoRoot = await findRepositoryRoot(cwd);
	return {
		cwd,
		repoRoot: repoRoot ?? resolve(cwd),
		isGitRepo: repoRoot !== undefined,
		ignoreCache: new Map(),
	};
}

export function resolveRepoPath(
	cwd: string,
	path: string,
	operation: string,
): string {
	if (path.trim() === "") {
		throw new ToolError("empty_path", operation, path);
	}
	return resolve(cwd, path);
}

export function displayRepoPath(cwd: string, absolutePath: string): string {
	const rel = relative(cwd, absolutePath);
	if (!rel) return ".";
	return isRelativeOutside(rel) ? absolutePath : rel;
}

export function isRepoPath(ctx: FsGuardContext, absolutePath: string): boolean {
	return isInside(ctx.repoRoot, absolutePath);
}

export type FsGuardOptions = {
	readonly allowIgnoredDependencies?: boolean;
};

export async function assertRepoPathAllowed(
	ctx: FsGuardContext,
	absolutePath: string,
	operation: string,
	options?: FsGuardOptions,
): Promise<void> {
	await assertRepoPathAllowedInRoot(ctx, absolutePath, operation, options);
}

export async function assertNoIgnoredDescendants(
	ctx: FsGuardContext,
	absolutePath: string,
	operation: string,
): Promise<void> {
	await walkAllowedDescendants(ctx, absolutePath, operation);
}

async function assertRepoPathAllowedInRoot(
	ctx: FsGuardContext,
	absolutePath: string,
	operation: string,
	options?: FsGuardOptions,
): Promise<void> {
	const displayPath = displayRepoPath(ctx.cwd, absolutePath);

	if (!isInside(ctx.repoRoot, absolutePath)) {
		throw new ToolError("outside_repo", operation, absolutePath);
	}

	const relPath = toPosix(relative(ctx.repoRoot, absolutePath));
	if (relPath === ".git" || relPath.startsWith(".git/")) {
		throw new ToolError("inside_git", operation, relPath);
	}

	if (
		!(options?.allowIgnoredDependencies && isDependencyPath(relPath)) &&
		(await isIgnoredByGitignore(ctx, absolutePath))
	) {
		throw new ToolError("ignored", operation, displayPath);
	}
}

async function walkAllowedDescendants(
	ctx: FsGuardContext,
	absolutePath: string,
	operation: string,
): Promise<void> {
	await assertRepoPathAllowedInRoot(ctx, absolutePath, operation);
	let stat;
	try {
		stat = await lstat(absolutePath);
	} catch (error) {
		if (isErrnoCode(error, "ENOENT")) {
			throw new ToolError(
				"not_found",
				operation,
				displayRepoPath(ctx.cwd, absolutePath),
			);
		}
		throw error;
	}
	if (!stat.isDirectory()) return;

	const entries = await readdir(absolutePath);
	await Promise.all(
		entries.map((entry) =>
			walkAllowedDescendants(ctx, resolve(absolutePath, entry), operation),
		),
	);
}

async function findRepositoryRoot(cwd: string): Promise<string | undefined> {
	try {
		const { stdout } = await execFileAsync(
			"git",
			["rev-parse", "--show-toplevel"],
			{ cwd },
		);
		return stdout.trim() || undefined;
	} catch {
		return undefined;
	}
}

function isInside(root: string, path: string): boolean {
	const rel = relative(root, path);
	return rel === "" || !isRelativeOutside(rel);
}

function isRelativeOutside(rel: string): boolean {
	return rel === ".." || rel.startsWith(`..${sep}`) || rel.startsWith("../");
}

function toPosix(path: string): string {
	return path.split(sep).join("/");
}
const DEPENDENCY_PATH_PREFIXES = [
	"node_modules",
	"bower_components",
	"Pods",
	"Carthage/Checkouts",
	"vendor/bundle",
	"vendor/ruby",
] as const;

function isDependencyPath(relPath: string): boolean {
	if (
		DEPENDENCY_PATH_PREFIXES.some(
			(p) => relPath === p || relPath.startsWith(`${p}/`),
		)
	) {
		return true;
	}
	return /^(?:\.venv|venv)\/lib\/python[^/]+\/site-packages(?:\/|$)/u.test(
		relPath,
	);
}

async function isIgnoredByGitignore(
	ctx: FsGuardContext,
	absolutePath: string,
): Promise<boolean> {
	if (!ctx.isGitRepo) return false;

	const relPath = toPosix(relative(ctx.repoRoot, absolutePath));
	if (!relPath || isRelativeOutside(relPath)) return false;

	const cached = ctx.ignoreCache.get(relPath);
	if (cached !== undefined) return cached;

	let ignored = false;
	try {
		await execFileAsync("git", ["check-ignore", "--quiet", "--", relPath], {
			cwd: ctx.repoRoot,
		});
		ignored = true;
	} catch (error) {
		if (!isErrnoCode(error, 1)) throw error;
	}
	ctx.ignoreCache.set(relPath, ignored);
	return ignored;
}
