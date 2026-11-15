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

// A lock is stale when its owner died, or when it outlived any real save
// (covers PID reuse and a crash before the owner file was written).
function lockIsStale(lock: string): boolean {
	try {
		if (Date.now() - statSync(lock).mtimeMs > STALE_LOCK_MS) return true;
		const pid = Number(readFileSync(join(lock, "owner"), "utf8"));
		return Number.isInteger(pid) && pid > 0 && !processAlive(pid);
	} catch {
		// Lock released, or owner not written yet: not provably stale.
		return false;
	}
}

function removeStaleLock(lock: string): void {
	// Rename first so only one waiter claims the stale directory.
	const claimed = `${lock}.stale.${process.pid}.${randomUUID()}`;
	try {
		renameSync(lock, claimed);
	} catch {
		return;
	}
	rmSync(claimed, { recursive: true, force: true });
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
		if (lockIsStale(lock)) {
			removeStaleLock(lock);
			continue;
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
