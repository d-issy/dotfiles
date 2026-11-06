import {
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
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
	const value: unknown = JSON.parse(text);
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
	const temporary = `${path}.${process.pid}.tmp`;
	try {
		writeFileSync(temporary, `${JSON.stringify(sets, null, 2)}\n`, {
			mode: 0o600,
		});
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
