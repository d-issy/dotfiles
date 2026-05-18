import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { ToolError, isErrnoCode } from "./errors.js";

type GitignoreRule = {
	baseDir: string;
	pattern: string;
	negated: boolean;
	directoryOnly: boolean;
	anchored: boolean;
};

type RulesCache = Map<string, GitignoreRule[]>;

export type FsGuardContext = {
	cwd: string;
	repoRoot: string;
	rulesCache: RulesCache;
};

const REGEX_CACHE = new Map<string, RegExp>();

export async function createFsGuardContext(
	cwd: string,
): Promise<FsGuardContext> {
	return {
		cwd,
		repoRoot: await findRepositoryRoot(cwd),
		rulesCache: new Map(),
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

export async function assertRepoPathAllowed(
	ctx: FsGuardContext,
	absolutePath: string,
	operation: string,
): Promise<void> {
	await assertRepoPathAllowedInRoot(
		ctx.repoRoot,
		ctx.cwd,
		absolutePath,
		operation,
		ctx.rulesCache,
	);
}

export async function assertNoIgnoredDescendants(
	ctx: FsGuardContext,
	absolutePath: string,
	operation: string,
): Promise<void> {
	await walkAllowedDescendants(
		ctx.repoRoot,
		ctx.cwd,
		absolutePath,
		operation,
		ctx.rulesCache,
	);
}

async function assertRepoPathAllowedInRoot(
	repoRoot: string,
	cwd: string,
	absolutePath: string,
	operation: string,
	cache: RulesCache,
): Promise<void> {
	const displayPath = displayRepoPath(cwd, absolutePath);

	if (!isInside(repoRoot, absolutePath)) {
		throw new ToolError("outside_repo", operation, absolutePath);
	}

	const relPath = toPosix(relative(repoRoot, absolutePath));
	if (relPath === ".git" || relPath.startsWith(".git/")) {
		throw new ToolError("inside_git", operation, relPath);
	}

	if (await isIgnoredByGitignore(repoRoot, absolutePath, cache)) {
		throw new ToolError("ignored", operation, displayPath);
	}
}

async function walkAllowedDescendants(
	repoRoot: string,
	cwd: string,
	absolutePath: string,
	operation: string,
	cache: RulesCache,
): Promise<void> {
	await assertRepoPathAllowedInRoot(
		repoRoot,
		cwd,
		absolutePath,
		operation,
		cache,
	);
	let stat;
	try {
		stat = await lstat(absolutePath);
	} catch (error) {
		if (isErrnoCode(error, "ENOENT")) {
			throw new ToolError(
				"not_found",
				operation,
				displayRepoPath(cwd, absolutePath),
			);
		}
		throw error;
	}
	if (!stat.isDirectory()) return;

	const entries = await readdir(absolutePath);
	await Promise.all(
		entries.map((entry) =>
			walkAllowedDescendants(
				repoRoot,
				cwd,
				resolve(absolutePath, entry),
				operation,
				cache,
			),
		),
	);
}

async function findRepositoryRoot(cwd: string): Promise<string> {
	let dir = resolve(cwd);
	while (true) {
		try {
			await lstat(resolve(dir, ".git"));
			return dir;
		} catch {
			const parent = dirname(dir);
			if (parent === dir) return resolve(cwd);
			dir = parent;
		}
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

async function isIgnoredByGitignore(
	repoRoot: string,
	absolutePath: string,
	cache: RulesCache,
): Promise<boolean> {
	const relPath = toPosix(relative(repoRoot, absolutePath));
	if (!relPath || isRelativeOutside(relPath)) return false;

	const rules = await collectRulesForPath(repoRoot, absolutePath, cache);
	let ignored = false;
	for (const rule of rules) {
		if (!matchesRule(repoRoot, relPath, rule)) continue;
		ignored = !rule.negated;
	}
	return ignored;
}

async function collectRulesForPath(
	repoRoot: string,
	absolutePath: string,
	cache: RulesCache,
): Promise<GitignoreRule[]> {
	const relPath = toPosix(relative(repoRoot, absolutePath));
	const parts = relPath.split("/").filter(Boolean);
	const dirs = [""];
	for (let i = 0; i < parts.length - 1; i++) {
		dirs.push(parts.slice(0, i + 1).join("/"));
	}

	const rules: GitignoreRule[] = [];
	for (const dir of dirs) {
		rules.push(...(await loadGitignoreInDir(repoRoot, dir, cache)));
	}
	return rules;
}

async function loadGitignoreInDir(
	repoRoot: string,
	baseDir: string,
	cache: RulesCache,
): Promise<GitignoreRule[]> {
	const cached = cache.get(baseDir);
	if (cached) return cached;
	let rules: GitignoreRule[] = [];
	try {
		const content = await readFile(
			resolve(repoRoot, baseDir, ".gitignore"),
			"utf8",
		);
		rules = parseGitignore(content, baseDir);
	} catch {
		// Missing .gitignore at this level is normal; treat as no rules.
	}
	cache.set(baseDir, rules);
	return rules;
}

function parseGitignore(content: string, baseDir: string): GitignoreRule[] {
	const rules: GitignoreRule[] = [];
	for (const rawLine of content.split(/\r?\n/)) {
		let line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		let negated = false;
		if (line.startsWith("!")) {
			negated = true;
			line = line.slice(1);
		}
		line = line.replace(/^\\#/, "#").replace(/^\\!/, "!");
		if (!line) continue;

		const anchored = line.startsWith("/") || line.includes("/");
		line = line.replace(/^\/+/, "");
		const directoryOnly = line.endsWith("/");
		line = line.replace(/\/+$/, "");
		if (!line) continue;

		rules.push({ baseDir, pattern: line, negated, directoryOnly, anchored });
	}
	return rules;
}

function matchesRule(
	repoRoot: string,
	relPath: string,
	rule: GitignoreRule,
): boolean {
	const baseRel = toPosix(relative(repoRoot, resolve(repoRoot, rule.baseDir)));
	if (baseRel && relPath !== baseRel && !relPath.startsWith(`${baseRel}/`)) {
		return false;
	}

	const relFromBase = baseRel ? relPath.slice(baseRel.length + 1) : relPath;
	if (!relFromBase) return false;

	if (rule.anchored) {
		return matchesPattern(relFromBase, rule.pattern, rule.directoryOnly);
	}

	return relFromBase
		.split("/")
		.some((_, index, parts) =>
			matchesPattern(
				parts.slice(index).join("/"),
				rule.pattern,
				rule.directoryOnly,
			),
		);
}

function matchesPattern(
	path: string,
	pattern: string,
	directoryOnly: boolean,
): boolean {
	if (directoryOnly && (path === pattern || path.startsWith(`${pattern}/`))) {
		return true;
	}
	const regex = globToRegExp(pattern);
	return (
		regex.test(path) ||
		(!pattern.includes("/") && regex.test(path.split("/")[0]))
	);
}

function globToRegExp(pattern: string): RegExp {
	const cached = REGEX_CACHE.get(pattern);
	if (cached) return cached;

	let source = "^";
	for (let i = 0; i < pattern.length; i++) {
		const char = pattern[i];
		const next = pattern[i + 1];
		if (char === "*" && next === "*") {
			source += ".*";
			i++;
		} else if (char === "*") {
			source += "[^/]*";
		} else if (char === "?") {
			source += "[^/]";
		} else {
			source += escapeRegExp(char);
		}
	}
	source += "(?:/.*)?$";
	const regex = new RegExp(source);
	REGEX_CACHE.set(pattern, regex);
	return regex;
}

function escapeRegExp(value: string): string {
	return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}
