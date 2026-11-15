import { describe, expect, it } from "vitest";
import {
	claudeModel,
	claudeStatus,
	claudeTitle,
	encodeProjectDir,
	parseClaudeRecord,
	procStartTime,
	summarizeToolInput,
} from "../../apps/agent-sessions/src/claude";
import {
	codexModel,
	codexStatus,
	parseCodexRecord,
} from "../../apps/agent-sessions/src/codex";
import {
	filterSessions,
	sessionRows,
	sessionRuntime,
	toRows,
} from "../../apps/agent-sessions/src/sessions";
import type { Session } from "../../apps/agent-sessions/src/types";

const timestamp = "2026-11-15T13:13:06.042Z";
const time = Date.parse(timestamp);

describe("parseClaudeRecord", () => {
	it("parses user prompts and skips meta messages", () => {
		expect(
			parseClaudeRecord({
				type: "user",
				timestamp,
				message: { role: "user", content: "hello\u001B[31m" },
			}),
		).toEqual([{ time, kind: "user", text: "hello" }]);
		expect(
			parseClaudeRecord({
				type: "user",
				isMeta: true,
				message: { content: "hidden" },
			}),
		).toEqual([]);
	});

	it("parses assistant text, thinking, and tool calls", () => {
		expect(
			parseClaudeRecord({
				type: "assistant",
				timestamp,
				message: {
					content: [
						{ type: "thinking", thinking: "" },
						{ type: "thinking", thinking: "plan" },
						{ type: "text", text: "done" },
						{
							type: "tool_use",
							name: "Bash",
							input: { command: "ls", description: "List" },
						},
					],
				},
			}),
		).toEqual([
			{ time, kind: "thinking", text: "plan" },
			{ time, kind: "assistant", text: "done" },
			{ time, kind: "tool", title: "Bash", text: "$ ls\nList" },
		]);
	});

	it("marks failed tool results as errors", () => {
		expect(
			parseClaudeRecord({
				type: "user",
				timestamp,
				message: {
					content: [
						{
							type: "tool_result",
							is_error: true,
							content: [{ type: "text", text: "boom" }],
						},
						{ type: "tool_result", content: "ok" },
					],
				},
			}),
		).toEqual([
			{ time, kind: "error", text: "boom" },
			{ time, kind: "result", text: "ok" },
		]);
	});

	it("ignores bookkeeping records", () => {
		expect(parseClaudeRecord({ type: "attachment" })).toEqual([]);
		expect(parseClaudeRecord({ type: "api-request-blob" })).toEqual([]);
	});
});

describe("Claude helpers", () => {
	it("uses the latest title", () => {
		expect(
			claudeTitle([
				{ type: "ai-title", aiTitle: "old" },
				{ type: "ai-title", aiTitle: "new" },
			]),
		).toBe("new");
	});

	it("maps registry status", () => {
		expect(claudeStatus("busy")).toBe("running");
		expect(claudeStatus("shell")).toBe("running");
		expect(claudeStatus("idle")).toBe("idle");
		expect(claudeStatus("other")).toBe("unknown");
	});

	it("encodes project directories like Claude Code", () => {
		expect(encodeProjectDir("/home/u/code/github.com/a/b.c")).toBe(
			"-home-u-code-github-com-a-b-c",
		);
	});

	it("reads the process start time even when the command has spaces", () => {
		const fields = Array.from({ length: 30 }, (_, index) => String(index + 3));
		expect(procStartTime(`123 (a b) ${fields.join(" ")}`)).toBe("22");
	});

	it("falls back to JSON for unknown tool input", () => {
		expect(summarizeToolInput({ a: 1 })).toBe('{"a":1}');
		expect(summarizeToolInput({})).toBe("");
	});
});

const event = (payload: Record<string, unknown>): Record<string, unknown> => ({
	type: "event_msg",
	timestamp,
	payload,
});

const item = (value: Record<string, unknown>): Record<string, unknown> =>
	event({ type: "item_completed", item: value });

describe("parseCodexRecord", () => {
	it("parses completed items", () => {
		expect(
			[
				item({ type: "UserMessage", content: [{ type: "text", text: "hi" }] }),
				item({ type: "AgentMessage", content: [{ type: "Text", text: "yo" }] }),
				item({
					type: "CommandExecution",
					command: ["/bin/zsh", "-lc", "git status"],
					aggregated_output: "clean\n",
					exit_code: 0,
				}),
				item({
					type: "CommandExecution",
					command: ["false"],
					aggregated_output: "",
					exit_code: 1,
				}),
				item({
					type: "FileChange",
					changes: { "/a.ts": { type: "update" } },
				}),
				item({ type: "Reasoning", summary_text: [] }),
			].flatMap(parseCodexRecord),
		).toEqual([
			{ time, kind: "user", text: "hi" },
			{ time, kind: "assistant", text: "yo" },
			{ time, kind: "tool", title: "exec", text: "$ git status" },
			{ time, kind: "result", text: "clean" },
			{ time, kind: "tool", title: "exec", text: "$ false" },
			{ time, kind: "error", text: "exit 1" },
			{ time, kind: "tool", title: "edit", text: "update /a.ts" },
		]);
	});

	it("derives the turn status from lifecycle events", () => {
		expect(codexStatus([event({ type: "task_started" })])).toBe("running");
		expect(
			codexStatus([
				event({ type: "task_started" }),
				event({ type: "token_count" }),
				event({ type: "task_complete" }),
			]),
		).toBe("idle");
		expect(codexStatus([])).toBeUndefined();
	});
});

const session = (
	key: string,
	updatedAt: number,
	parentKey?: string,
): Session => ({
	key,
	agent: "codex",
	id: key,
	title: key,
	cwd: "/tmp",
	status: "idle",
	updatedAt,
	logPath: "",
	parentKey,
});

describe("filterSessions", () => {
	it("hides idle sessions by default and can show them", () => {
		const sessions: Session[] = [
			session("idle-main", 1),
			{ ...session("running-main", 2), status: "running" },
			{ ...session("waiting-main", 3), status: "waiting" },
			{ ...session("unknown-main", 4), status: "unknown" },
			{ ...session("ended-main", 5), status: "ended" },
			session("idle-child", 6, "idle-main"),
			{ ...session("ended-child", 7, "missing"), status: "ended" },
			{ ...session("waiting-child", 8, "idle-main"), status: "waiting" },
		];
		expect(filterSessions(sessions).map(({ key }) => key)).toEqual([
			"running-main",
			"waiting-main",
			"unknown-main",
			"ended-main",
			"ended-child",
			"waiting-child",
		]);
		expect(filterSessions(sessions, true)).toEqual(sessions);
	});

	it("keeps descendants in the tree when their idle main session is hidden", () => {
		const sessions = [
			session("main", 1),
			{ ...session("child", 2, "main"), status: "running" as const },
			{ ...session("grandchild", 3, "child"), status: "waiting" as const },
		];
		const rows = sessionRows(toRows(filterSessions(sessions)));
		expect(
			rows.map(({ session: rowSession, depth }) => [rowSession.key, depth]),
		).toEqual([
			["child", 0],
			["grandchild", 1],
		]);
	});

	it("leaves no rows for an idle main session and its idle child", () => {
		const sessions = [session("main", 1), session("child", 2, "main")];
		expect(toRows(filterSessions(sessions))).toEqual([]);
	});
});

describe("toRows", () => {
	it("groups by project and orders sessions by start time", () => {
		const rows = toRows([
			{ ...session("b2", 9), cwd: "/w/beta", startedAt: 2 },
			{ ...session("b1", 1), cwd: "/w/beta", startedAt: 1 },
			{ ...session("a1", 5), cwd: "/w/alpha" },
			{ ...session("child", 5, "b1"), cwd: "/w/other" },
			{ ...session("orphan", 2, "missing"), cwd: "/w/alpha" },
		]);
		expect(
			rows.map((row) =>
				row.kind === "project"
					? `${row.cwd} (${row.sessions})`
					: `${row.tree}${row.session.key}`,
			),
		).toEqual([
			"/w/alpha (2)",
			"├─ orphan",
			"└─ a1",
			"/w/beta (2)",
			"├─ b1",
			"│  └─ child",
			"└─ b2",
		]);
		expect(sessionRows(rows).map((row) => row.depth)).toEqual([0, 0, 0, 1, 0]);
	});
});

describe("model detection", () => {
	it("uses the latest real Claude model", () => {
		expect(
			claudeModel([
				{ type: "assistant", message: { model: "claude-fable-5-2" } },
				{ type: "assistant", message: { model: "claude-opus-5-5" } },
				{ type: "assistant", message: { model: "<synthetic>" } },
				{ type: "user", message: { content: "hi" } },
			]),
		).toBe("claude-opus-5-5");
		expect(claudeModel([])).toBeUndefined();
	});

	it("uses the latest Codex turn context or thread settings", () => {
		expect(
			codexModel([
				event({
					type: "thread_settings_applied",
					thread_settings: { model: "gpt-6.1-sol" },
				}),
				{ type: "turn_context", payload: { model: "gpt-6.1-luna" } },
				event({ type: "token_count" }),
			]),
		).toBe("gpt-6.1-luna");
		expect(
			codexModel([
				event({
					type: "thread_settings_applied",
					thread_settings: { model: "gpt-6.1-sol" },
				}),
			]),
		).toBe("gpt-6.1-sol");
	});
});

describe("sessionRuntime", () => {
	it("counts active sessions to now and finished ones to the last write", () => {
		const base = session("s", 5_000);
		expect(sessionRuntime({ ...base, startedAt: 1_000 }, 9_000)).toBe(4_000);
		expect(
			sessionRuntime({ ...base, status: "running", startedAt: 1_000 }, 9_000),
		).toBe(8_000);
		expect(sessionRuntime(base, 9_000)).toBeUndefined();
	});
});
