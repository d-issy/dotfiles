import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { SummaryTracker, listDir, mtime, readFirstRecord } from "./files";
import { arr, obj, parseJsonLine, parseTime, str } from "./json";
import { lastSummary, oneLine, sanitize } from "./text";
import type { JsonObject, LogEntry, Session, SessionStatus } from "./types";

export function codexHome(): string {
	return process.env.CODEX_HOME ?? join(homedir(), ".codex");
}

function textBlocks(content: unknown): string {
	if (typeof content === "string") return content;
	return arr(content)
		.map((block) => str(obj(block).text) ?? "")
		.filter((text) => text !== "")
		.join("");
}

function commandText(command: unknown): string {
	const parts = arr(command).filter((part) => typeof part === "string");
	// Unwrap `zsh -lc '<script>'` style invocations.
	if (parts.length === 3 && /^-\w*c$/u.test(parts[1] ?? "")) {
		return parts[2] ?? "";
	}
	return parts.join(" ");
}

function lastLines(text: string, count: number): string {
	return text.trimEnd().split("\n").slice(-count).join("\n");
}

function parseItem(item: JsonObject, time: number | undefined): LogEntry[] {
	switch (item.type) {
		case "UserMessage":
			return [{ time, kind: "user", text: sanitize(textBlocks(item.content)) }];
		case "AgentMessage":
			return [
				{ time, kind: "assistant", text: sanitize(textBlocks(item.content)) },
			];
		case "Reasoning": {
			const summary = arr(item.summary_text)
				.filter((part) => typeof part === "string")
				.join("\n");
			return summary === ""
				? []
				: [{ time, kind: "thinking", text: sanitize(summary) }];
		}
		case "CommandExecution": {
			const entries: LogEntry[] = [
				{
					time,
					kind: "tool",
					title: "exec",
					text: sanitize(`$ ${commandText(item.command)}`),
				},
			];
			const exitCode = item.exit_code;
			const output = lastLines(str(item.aggregated_output) ?? "", 20);
			const failed = typeof exitCode === "number" && exitCode !== 0;
			if (output !== "" || failed) {
				entries.push({
					time,
					kind: failed ? "error" : "result",
					text: sanitize(
						failed
							? [`exit ${exitCode}`, output].filter(Boolean).join("\n")
							: output,
					),
				});
			}
			return entries;
		}
		case "FileChange": {
			const changes = Object.entries(obj(item.changes)).map(
				([path, change]) => `${str(obj(change).type) ?? "change"} ${path}`,
			);
			return [
				{
					time,
					kind: item.status === "failed" ? "error" : "tool",
					title: "edit",
					text: sanitize(changes.join("\n")),
				},
			];
		}
		case "McpToolCall":
			return [
				{
					time,
					kind: item.status === "failed" ? "error" : "tool",
					title: sanitize(
						`${str(item.server) ?? "mcp"}.${str(item.tool) ?? ""}`,
					),
					text: sanitize(JSON.stringify(item.arguments ?? {})),
				},
			];
		case "Extension":
			return [
				{
					time,
					kind: "tool",
					title: sanitize(str(item.kind) ?? "extension"),
					text: sanitize(str(item.query) ?? ""),
				},
			];
		case "SubAgentActivity":
			return [
				{
					time,
					kind: "status",
					text: sanitize(
						`subagent ${str(item.kind) ?? ""} ${str(item.agent_path) ?? ""}`,
					),
				},
			];
		default:
			return [];
	}
}

/** Convert one Codex rollout record into log entries. */
export function parseCodexRecord(record: JsonObject): LogEntry[] {
	const time = parseTime(record.timestamp);
	if (record.type === "compacted") {
		return [{ time, kind: "status", text: "context compacted" }];
	}
	if (record.type !== "event_msg") return [];
	const payload = obj(record.payload);
	switch (payload.type) {
		case "item_completed":
			return parseItem(obj(payload.item), time);
		case "task_started":
			return [{ time, kind: "status", text: "turn started" }];
		case "task_complete":
			return [{ time, kind: "status", text: "turn complete" }];
		case "turn_aborted":
			return [
				{
					time,
					kind: "status",
					text: `turn aborted (${str(payload.reason) ?? "unknown"})`,
				},
			];
		case "error":
		case "stream_error":
			return [
				{
					time,
					kind: "error",
					text: sanitize(str(payload.message) ?? "error"),
				},
			];
		default:
			return [];
	}
}

export function codexModel(records: JsonObject[]): string | undefined {
	for (let index = records.length - 1; index >= 0; index -= 1) {
		const record = records[index];
		const payload = obj(record?.payload);
		if (record?.type === "turn_context") {
			const model = str(payload.model);
			if (model) return model;
		}
		if (
			record?.type === "event_msg" &&
			payload.type === "thread_settings_applied"
		) {
			const model = str(obj(payload.thread_settings).model);
			if (model) return model;
		}
	}
	return undefined;
}

/** Derive the turn state from the latest task lifecycle event. */
export function codexStatus(records: JsonObject[]): SessionStatus | undefined {
	for (let index = records.length - 1; index >= 0; index -= 1) {
		const record = records[index];
		if (record?.type !== "event_msg") continue;
		const type = obj(record.payload).type;
		if (type === "task_started") return "running";
		if (type === "task_complete" || type === "turn_aborted") return "idle";
	}
	return undefined;
}

function threadNames(home: string): Map<string, string> {
	const names = new Map<string, string>();
	let text: string;
	try {
		text = readFileSync(join(home, "session_index.jsonl"), "utf8");
	} catch {
		return names;
	}
	for (const line of text.split("\n")) {
		const record = parseJsonLine(line);
		const id = str(record?.id);
		const name = str(record?.thread_name);
		if (id && name) names.set(id, name);
	}
	return names;
}

/** All rollout files; resumed sessions keep writing to their original day. */
function rolloutPaths(root: string): string[] {
	const paths: string[] = [];
	for (const year of listDir(root)) {
		for (const month of listDir(join(root, year))) {
			for (const day of listDir(join(root, year, month))) {
				const dir = join(root, year, month, day);
				for (const name of listDir(dir)) {
					if (name.startsWith("rollout-") && name.endsWith(".jsonl")) {
						paths.push(join(dir, name));
					}
				}
			}
		}
	}
	return paths;
}

const tracker = new SummaryTracker((summary, record) => {
	summary.status = codexStatus([record]) ?? summary.status;
	summary.model = codexModel([record]) ?? summary.model;
	summary.last = lastSummary(parseCodexRecord(record)) ?? summary.last;
});

// session_meta is written once at the top of a rollout, so cache it per path.
// Only successful reads are cached: the first line may still be mid-write.
const metaCache = new Map<string, JsonObject>();

function sessionMeta(path: string): JsonObject | undefined {
	const cached = metaCache.get(path);
	if (cached) return cached;
	const first = readFirstRecord(path);
	if (first?.type !== "session_meta") return undefined;
	const meta = obj(first.payload);
	metaCache.set(path, meta);
	return meta;
}

function isGuardian(meta: JsonObject): boolean {
	return (
		meta.thread_source === "guardian_review" ||
		obj(obj(meta.source).subagent).other === "guardian"
	);
}

/** Discover Codex sessions whose rollout was written within the window. */
export function discoverCodex(now: number, windowMs: number): Session[] {
	const home = codexHome();
	const since = now - windowMs;
	const names = threadNames(home);
	const sessions: Session[] = [];
	for (const path of rolloutPaths(join(home, "sessions"))) {
		const updatedAt = mtime(path);
		if (updatedAt === undefined || updatedAt < since) continue;
		const meta = sessionMeta(path);
		if (!meta) continue;
		if (isGuardian(meta)) continue;
		const id = str(meta.id);
		if (!id) continue;
		const summary = tracker.summarize(path);
		const parentId = str(meta.parent_thread_id);
		const nickname = str(meta.agent_nickname);
		const agentPath = str(meta.agent_path);
		const title =
			names.get(id) ??
			(nickname ? `${nickname}${agentPath ? ` (${agentPath})` : ""}` : id);
		sessions.push({
			key: `codex:${id}`,
			agent: "codex",
			id,
			title: oneLine(title),
			cwd: str(meta.cwd) ?? "",
			status: summary.status ?? "unknown",
			updatedAt,
			startedAt: parseTime(meta.timestamp),
			logPath: path,
			parentKey: parentId ? `codex:${parentId}` : undefined,
			model: summary.model,
			last: summary.last,
		});
	}
	tracker.prune();
	return sessions;
}
