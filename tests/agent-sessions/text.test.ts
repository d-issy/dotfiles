import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonlTail } from "../../apps/agent-sessions/src/files";
import { splitKeys } from "../../apps/agent-sessions/src/tui";
import {
	formatDuration,
	parseDuration,
	sanitize,
	truncate,
	width,
	wrap,
} from "../../apps/agent-sessions/src/text";

describe("text helpers", () => {
	it("measures wide characters", () => {
		expect(width("abc")).toBe(3);
		expect(width("日本語")).toBe(6);
	});

	it("truncates and wraps by display width", () => {
		expect(truncate("日本語テキスト", 7)).toBe("日本語…");
		expect(wrap("日本語abc", 4)).toEqual(["日本", "語ab", "c"]);
	});

	it("strips terminal escapes and control characters", () => {
		expect(sanitize("\u001B]0;title\u0007a\u001B[2Jb\r\nc\u0000")).toBe(
			"ab\nc",
		);
	});

	it("parses durations", () => {
		expect(parseDuration("30")).toBe(1_800_000);
		expect(parseDuration("2h")).toBe(7_200_000);
		expect(parseDuration("1d")).toBe(86_400_000);
		expect(parseDuration("soon")).toBeUndefined();
	});
});

describe("JsonlTail", () => {
	let dir: string | undefined;

	afterEach(() => {
		if (dir) rmSync(dir, { recursive: true, force: true });
	});

	it("follows appended records and buffers partial lines", () => {
		dir = mkdtempSync(join(tmpdir(), "agent-sessions-"));
		const path = join(dir, "log.jsonl");
		writeFileSync(path, '{"n":1}\n{"n":');
		const tail = new JsonlTail(path, 1024);
		expect(tail.poll()).toEqual([{ n: 1 }]);
		expect(tail.poll()).toEqual([]);
		appendFileSync(path, '2}\n{"n":3}\n');
		expect(tail.poll()).toEqual([{ n: 2 }, { n: 3 }]);
	});

	it("does not retain the read buffer for a pending partial line", () => {
		dir = mkdtempSync(join(tmpdir(), "agent-sessions-"));
		const path = join(dir, "log.jsonl");
		writeFileSync(path, `${'{"n":1}\n'.repeat(100_000)}{"n":`);
		const tail = new JsonlTail(path, Number.MAX_SAFE_INTEGER);
		expect(tail.poll()).toHaveLength(100_000);
		const { partial } = tail as unknown as { partial: Buffer };
		expect(partial.toString()).toBe('{"n":');
		// The file is ~800 KB; a copied remainder lives in a small pool slab.
		expect(partial.buffer.byteLength).toBeLessThan(256 * 1024);
	});

	it("skips the record cut by the initial window", () => {
		dir = mkdtempSync(join(tmpdir(), "agent-sessions-"));
		const path = join(dir, "log.jsonl");
		writeFileSync(path, '{"long":"xxxxxxxxxxxxxxxx"}\n{"n":1}\n');
		expect(new JsonlTail(path, 12).poll()).toEqual([{ n: 1 }]);
	});

	it("keeps multi-byte characters split across reads", () => {
		dir = mkdtempSync(join(tmpdir(), "agent-sessions-"));
		const path = join(dir, "log.jsonl");
		const bytes = Buffer.from('{"t":"日"}\n');
		writeFileSync(path, bytes.subarray(0, 7));
		const tail = new JsonlTail(path, 1024);
		expect(tail.poll()).toEqual([]);
		appendFileSync(path, bytes.subarray(7));
		expect(tail.poll()).toEqual([{ t: "日" }]);
	});
});

describe("splitKeys", () => {
	it("splits batched keys and escape sequences", () => {
		expect(splitKeys("kk\u001B[A\u001B[5~\r")).toEqual({
			keys: ["k", "k", "\u001B[A", "\u001B[5~", "\r"],
			pending: "",
		});
	});

	it("holds back an escape sequence split across chunks", () => {
		const first = splitKeys("j\u001B");
		expect(first).toEqual({ keys: ["j"], pending: "\u001B" });
		expect(splitKeys(`${first.pending}[A`)).toEqual({
			keys: ["\u001B[A"],
			pending: "",
		});
		expect(splitKeys("\u001B[5")).toEqual({ keys: [], pending: "\u001B[5" });
	});

	it("treats a flushed lone escape as the Esc key", () => {
		expect(splitKeys("\u001B", true)).toEqual({
			keys: ["\u001B"],
			pending: "",
		});
	});
});

describe("formatDuration", () => {
	it.each([
		[45_000, "45s"],
		[725_000, "12m05s"],
		[3_900_000, "1h05m"],
		[180_000_000, "2d02h"],
	])("formats %i ms as %s", (ms, text) => {
		expect(formatDuration(ms)).toBe(text);
	});
});
