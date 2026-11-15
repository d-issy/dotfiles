import { spawn, spawnSync } from "node:child_process";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	readModelSets,
	updateModelSets,
	writeModelSets,
} from "#pi-user/lib/model-set-store";

const fixedUuid = vi.hoisted(() => ({
	value: undefined as string | undefined,
}));
vi.mock("node:crypto", async (original) => {
	const actual = await original<typeof import("node:crypto")>();
	return {
		...actual,
		randomUUID: (): `${string}-${string}-${string}-${string}-${string}` =>
			(fixedUuid.value ??
				actual.randomUUID()) as `${string}-${string}-${string}-${string}-${string}`,
	};
});

const directories: string[] = [];
function location(): string {
	const directory = mkdtempSync(join(tmpdir(), "pi-model-store-"));
	directories.push(directory);
	return join(directory, "model-sets.json");
}
afterEach(() => {
	fixedUuid.value = undefined;
	for (const directory of directories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});

describe("model set storage", () => {
	it("saves a private regular file", () => {
		const path = location();
		writeModelSets(path, []);
		expect(readModelSets(path)).toEqual([]);
		expect(lstatSync(path).isFile()).toBe(true);
		expect(lstatSync(path).mode & 0o777).toBe(0o600);
	});

	it("refuses to follow a preexisting temporary symlink", () => {
		const path = location();
		const unrelated = join(path, "..", "unrelated-file");
		fixedUuid.value = "fixed-uuid";
		const temporary = `${path}.${process.pid}.fixed-uuid.tmp`;
		writeFileSync(unrelated, "keep this");
		symlinkSync(unrelated, temporary);

		expect(() => writeModelSets(path, [])).toThrow(/EEXIST/u);

		expect(readFileSync(unrelated, "utf8")).toBe("keep this");
		expect(existsSync(path)).toBe(false);
		expect(lstatSync(temporary).isSymbolicLink()).toBe(true);
		expect(existsSync(`${path}.lock`)).toBe(false);
	});

	it("serializes saves and deletes across independent Pi processes", async () => {
		const path = location();
		writeModelSets(path, [
			{ provider: "test", model: "remove", thinking: "off", fast: false },
		]);
		const module = new URL(
			"../../../../../../files/pi/agent/extensions/user/lib/model-set-store.ts",
			import.meta.url,
		).href;
		const script = `
import { updateModelSets } from ${JSON.stringify(module)};
process.stdout.write('ready');
await new Promise(resolve => process.stdin.once('data', resolve));
const wait = new Int32Array(new SharedArrayBuffer(4));
for (let index = 0; index < 8; index++) {
  updateModelSets(process.argv[1], latest => {
    Atomics.wait(wait, 0, 0, 10);
    const next = process.argv[2] === '0' ? latest.filter(p => p.model !== 'remove') : latest;
    return [...next, { provider: 'test', model: process.argv[2] + '-' + index, thinking: 'off', fast: false }];
  });
}
process.stdin.destroy();
`;
		const workers = Array.from({ length: 4 }, (_, index) => {
			const child = spawn(
				process.execPath,
				["--input-type=module", "--eval", script, path, String(index)],
				{
					stdio: ["pipe", "pipe", "pipe"],
				},
			);
			let errors = "";
			child.stderr.on("data", (data: Buffer) => {
				errors += data.toString();
			});
			const ready = new Promise<void>((resolveReady, reject) => {
				child.stdout.once("data", () => resolveReady());
				child.once("error", reject);
			});
			const finished = new Promise<void>((resolveFinished, reject) => {
				child.once("error", reject);
				child.once("close", (code) =>
					code === 0 ? resolveFinished() : reject(new Error(errors)),
				);
			});
			return { child, ready, finished };
		});
		try {
			await Promise.all(workers.map((worker) => worker.ready));
			for (const worker of workers) worker.child.stdin.end("go");
			await Promise.all(workers.map((worker) => worker.finished));
		} finally {
			for (const worker of workers) worker.child.kill();
		}
		const sets = readModelSets(path);
		expect(sets).toHaveLength(32);
		expect(new Set(sets.map((p) => p.model)).size).toBe(32);
		expect(sets.some((p) => p.model === "remove")).toBe(false);
		expect(existsSync(`${path}.lock`)).toBe(false);
	});

	it("releases the lock when parsing or updating fails", () => {
		const path = location();
		writeFileSync(path, "invalid json");
		expect(() => updateModelSets(path, (latest) => latest)).toThrow();
		expect(existsSync(`${path}.lock`)).toBe(false);
		writeModelSets(path, []);
		expect(() =>
			updateModelSets(path, () => {
				throw new Error("cancelled");
			}),
		).toThrow("cancelled");
		expect(existsSync(`${path}.lock`)).toBe(false);
		expect(updateModelSets(path, (latest) => latest)).toEqual([]);
	});

	it("recovers a lock whose owner process has died", () => {
		const path = location();
		const finished = spawnSync(process.execPath, ["-e", ""]);
		const lock = `${path}.lock`;
		mkdirSync(lock);
		writeFileSync(join(lock, "owner"), String(finished.pid));
		writeModelSets(path, []);
		expect(readModelSets(path)).toEqual([]);
		expect(existsSync(lock)).toBe(false);
	});

	it("recovers an old lock that has no readable owner", () => {
		const path = location();
		const lock = `${path}.lock`;
		mkdirSync(lock);
		const old = new Date(Date.now() - 120_000);
		utimesSync(lock, old, old);
		writeModelSets(path, []);
		expect(existsSync(lock)).toBe(false);
	});
});
