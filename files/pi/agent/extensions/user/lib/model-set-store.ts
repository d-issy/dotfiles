import { randomUUID } from "node:crypto";
import {
	closeSync,
	fsyncSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export interface ModelSet {
	provider: string;
	model: string;
	thinking: string;
	fast: boolean;
	ultrafast?: boolean;
}

export function readModelSets(path: string): ModelSet[] {
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch (error) {
		throw new Error(`Invalid model sets file: ${path}`, { cause: error });
	}
	if (
		!Array.isArray(value) ||
		!value.every((item: unknown) => {
			if (!item || typeof item !== "object") return false;
			const p = item as Record<string, unknown>;
			return (
				typeof p.provider === "string" &&
				p.provider.length > 0 &&
				typeof p.model === "string" &&
				p.model.length > 0 &&
				typeof p.thinking === "string" &&
				p.thinking.length > 0 &&
				typeof p.fast === "boolean" &&
				(p.ultrafast === undefined || typeof p.ultrafast === "boolean") &&
				!(p.fast && p.ultrafast)
			);
		})
	)
		throw new Error(`Invalid model sets file: ${path}`);
	return value as ModelSet[];
}

const STALE_LOCK_MS = 30_000;

function processAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code !== "ESRCH";
	}
}

interface LockIdentity {
	dev: number;
	ino: number;
	mtimeMs: number;
	owner: string | undefined;
}

function lockIdentity(lock: string): LockIdentity | undefined {
	try {
		const stat = statSync(lock);
		let owner: string | undefined;
		try {
			owner = readFileSync(join(lock, "owner"), "utf8");
		} catch {}
		return { dev: stat.dev, ino: stat.ino, mtimeMs: stat.mtimeMs, owner };
	} catch {
		return undefined;
	}
}

function sameLock(identity: LockIdentity, lock: string): boolean {
	const current = lockIdentity(lock);
	return (
		current !== undefined &&
		current.dev === identity.dev &&
		current.ino === identity.ino &&
		current.mtimeMs === identity.mtimeMs &&
		current.owner === identity.owner
	);
}

function identityIsStale(identity: LockIdentity): boolean {
	if (Date.now() - identity.mtimeMs > STALE_LOCK_MS) return true;
	const pid = Number(identity.owner);
	return Number.isInteger(pid) && pid > 0 && !processAlive(pid);
}

// Hold one cross-process lock around read/modify/write, including the rename.
function withModelSetsLock<T>(path: string, action: () => T): T {
	mkdirSync(dirname(path), { recursive: true });
	const lock = `${path}.lock`;
	const deadline = Date.now() + 5000;
	const wait = new Int32Array(new SharedArrayBuffer(4));
	for (;;) {
		try {
			mkdirSync(lock, { mode: 0o700 });
			break;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		}
		const stale = lockIdentity(lock);
		if (stale && identityIsStale(stale)) {
			const claimed = `${lock}.stale.${process.pid}.${randomUUID()}`;
			try {
				renameSync(lock, claimed);
			} catch (renameError) {
				if (Date.now() >= deadline) throw renameError;
				Atomics.wait(wait, 0, 0, 10);
				continue;
			}
			if (sameLock(stale, claimed)) {
				rmSync(claimed, { recursive: true, force: true });
				continue;
			}
			// The stale lock was replaced after it was checked. Restore the
			// replacement and retry instead of deleting another owner's lock.
			try {
				renameSync(claimed, lock);
			} catch (restoreError) {
				throw new Error(
					`Could not restore replaced model-sets lock (${lock})`,
					{
						cause: restoreError,
					},
				);
			}
		}
		if (Date.now() >= deadline)
			throw new Error(
				`Model sets are busy (${lock}). Retry shortly; if no Pi process is saving presets, remove this lock directory.`,
			);
		Atomics.wait(wait, 0, 0, 10);
	}
	try {
		writeFileSync(join(lock, "owner"), String(process.pid), { mode: 0o600 });
		return action();
	} finally {
		rmSync(lock, { recursive: true, force: true });
	}
}

function writeUnlocked(path: string, sets: ModelSet[]): void {
	const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
	const file = openSync(temporary, "wx", 0o600);
	try {
		try {
			writeFileSync(file, `${JSON.stringify(sets, null, 2)}\n`);
			fsyncSync(file);
		} finally {
			closeSync(file);
		}
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
}

export function writeModelSets(path: string, sets: ModelSet[]): void {
	withModelSetsLock(path, () => writeUnlocked(path, sets));
}

export function updateModelSets(
	path: string,
	update: (latest: ModelSet[]) => ModelSet[],
): ModelSet[] {
	return withModelSetsLock(path, () => {
		const next = update(readModelSets(path));
		writeUnlocked(path, next);
		return next;
	});
}
