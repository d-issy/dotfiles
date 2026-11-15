import {
	appendFileSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverCodex } from "../../apps/agent-sessions/src/codex";
import { renderEntries } from "../../apps/agent-sessions/src/render";
import type { LogEntry } from "../../apps/agent-sessions/src/types";

const line = (record: unknown): string => `${JSON.stringify(record)}\n`;
const event = (type: string): string =>
	line({ type: "event_msg", payload: { type } });
const noise = (bytes: number): string =>
	line({
		type: "event_msg",
		payload: { type: "token_count", pad: "x".repeat(bytes) },
	});

const find = (): ReturnType<typeof discoverCodex>[number] | undefined =>
	discoverCodex(Date.now(), 3_600_000).find((session) => session.id === "abc");

const ids = (): string[] =>
	discoverCodex(Date.now(), 3_600_000).map((session) => session.id);

describe("discoverCodex", () => {
	let home: string;
	let rollout: string;
	const previous = process.env.CODEX_HOME;

	beforeEach(() => {
		home = mkdtempSync(join(tmpdir(), "agent-sessions-codex-"));
		process.env.CODEX_HOME = home;
		// A resumed session keeps writing to its original (old) day directory.
		const dir = join(home, "sessions", "2025", "01", "02");
		mkdirSync(dir, { recursive: true });
		rollout = join(dir, "rollout-2025-01-02T00-00-00-abc.jsonl");
		writeFileSync(
			rollout,
			line({
				type: "session_meta",
				payload: { id: "abc", cwd: "/w/p", timestamp: "2025-01-02T00:00:00Z" },
			}) +
				line({ type: "turn_context", payload: { model: "gpt-a" } }) +
				event("task_started"),
		);
	});

	afterEach(() => {
		if (previous === undefined) delete process.env.CODEX_HOME;
		else process.env.CODEX_HOME = previous;
		rmSync(home, { recursive: true, force: true });
	});

	it("finds resumed sessions stored in old date directories", () => {
		expect(find()).toMatchObject({ status: "running", model: "gpt-a" });
	});

	it("retries a rollout whose first line was still being written", () => {
		const dir = join(home, "sessions", "2025", "01", "03");
		mkdirSync(dir, { recursive: true });
		const path = join(dir, "rollout-2025-01-03T00-00-00-new.jsonl");
		const meta = line({
			type: "session_meta",
			payload: { id: "new", cwd: "/w/p" },
		});
		writeFileSync(path, meta.slice(0, 20));
		expect(ids()).not.toContain("new");
		appendFileSync(path, meta.slice(20));
		expect(ids()).toContain("new");
	});

	it("keeps status and model current across large output bursts", () => {
		expect(find()?.status).toBe("running");
		appendFileSync(rollout, event("task_complete") + noise(300 * 1024));
		expect(find()?.status).toBe("idle");
		appendFileSync(
			rollout,
			line({ type: "turn_context", payload: { model: "gpt-b" } }) +
				event("task_started") +
				noise(300 * 1024),
		);
		expect(find()).toMatchObject({ status: "running", model: "gpt-b" });
	});
});

describe("renderEntries", () => {
	it("renders appended entries exactly as a full re-render", () => {
		const entries: LogEntry[] = [
			{ kind: "user", text: "first" },
			{ kind: "assistant", text: "answer" },
			{ kind: "user", text: "second" },
			{ kind: "tool", title: "Bash", text: "$ ls" },
		];
		const head = entries.slice(0, 2);
		const tail = entries.slice(2);
		expect([
			...renderEntries(head, 80),
			...renderEntries(tail, 80, true),
		]).toEqual(renderEntries(entries, 80));
	});
});
