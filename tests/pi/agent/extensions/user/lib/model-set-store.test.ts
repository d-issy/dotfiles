import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
	readModelSets,
	updateModelSets,
	writeModelSets,
} from "#pi-user/lib/model-set-store";

const directories: string[] = [];
function location(): string {
	const directory = mkdtempSync(join(tmpdir(), "pi-model-store-"));
	directories.push(directory);
	return join(directory, "model-sets.json");
}
afterEach(() => {
	for (const directory of directories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});

describe("model set storage", () => {
	it("serializes saves and deletes across independent Pi processes", async () => {
		const path = location();
		writeModelSets(path, [
			{ provider: "test", model: "remove", thinking: "off", fast: false },
		]);
		const module = pathToFileURL(
			resolve("files/pi/agent/extensions/user/lib/model-set-store.ts"),
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
});
