import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { SummaryTracker, listDir, mtime, readFirstRecord } from "./files";
import { arr, obj, parseJsonLine, parseTime, str } from "./json";
import { lastSummary, oneLine, sanitize } from "./text";
import type { JsonObject, LogEntry, Session, SessionStatus } from "./types";

export function claudeHome(): string {
	return process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
}

function contentText(content: unknown): string {
	if (typeof content === "string") return content;
	return arr(content)
		.map((block) => str(obj(block).text) ?? "")
		.filter((text) => text !== "")
		.join("\n");
}

const INPUT_KEYS = [
	"command",
	"file_path",
	"notebook_path",
	"path",
	"pattern",
	"url",
	"query",
	"skill",
	"description",
	"prompt",
];

export function summarizeToolInput(input: unknown): string {
	const fields = obj(input);
	const parts: string[] = [];
	for (const key of INPUT_KEYS) {
		const value = fields[key];
		if (typeof value !== "string" || value === "") continue;
		parts.push(key === "command" ? `$ ${value}` : value);
		if (parts.length === 2) break;
	}
	if (parts.length > 0) return parts.join("\n");
	const json = JSON.stringify(input);
	return json === undefined || json === "{}" ? "" : json;
}

/** Convert one Claude Code transcript record into log entries. */
export function parseClaudeRecord(record: JsonObject): LogEntry[] {
	const time = parseTime(record.timestamp);
	const type = str(record.type);
	if (type === "user") {
		if (record.isMeta === true) return [];
		const content = obj(record.message).content;
		if (typeof content === "string") {
			return [{ time, kind: "user", text: sanitize(content) }];
		}
		const entries: LogEntry[] = [];
		for (const block of arr(content)) {
			const item = obj(block);
			if (item.type === "text") {
				entries.push({
					time,
					kind: "user",
					text: sanitize(str(item.text) ?? ""),
				});
			} else if (item.type === "tool_result") {
				entries.push({
					time,
					kind: item.is_error === true ? "error" : "result",
					text: sanitize(contentText(item.content)),
				});
			}
		}
		return entries;
	}
	if (type === "assistant") {
		const entries: LogEntry[] = [];
		for (const block of arr(obj(record.message).content)) {
			const item = obj(block);
			if (item.type === "text") {
				entries.push({
					time,
					kind: "assistant",
					text: sanitize(str(item.text) ?? ""),
				});
			} else if (item.type === "thinking") {
				const thinking = str(item.thinking) ?? "";
				if (thinking !== "") {
					entries.push({ time, kind: "thinking", text: sanitize(thinking) });
				}
			} else if (item.type === "tool_use") {
				entries.push({
					time,
					kind: "tool",
					title: sanitize(str(item.name) ?? "tool"),
					text: sanitize(summarizeToolInput(item.input)),
				});
			}
		}
		return entries;
	}
	if (type === "system") {
		const subtype = str(record.subtype);
		if (subtype === "compact_boundary") {
			return [{ time, kind: "status", text: "context compacted" }];
		}
		if (subtype === "api_error") {
			return [{ time, kind: "error", text: "API error (retrying)" }];
		}
	}
	return [];
}

export function claudeTitle(records: JsonObject[]): string | undefined {
	for (let index = records.length - 1; index >= 0; index -= 1) {
		const record = records[index];
		if (record?.type === "ai-title" || record?.type === "custom-title") {
			const title = str(record.customTitle) ?? str(record.aiTitle);
			if (title) return oneLine(title);
		}
	}
	return undefined;
}

export function claudeModel(records: JsonObject[]): string | undefined {
	for (let index = records.length - 1; index >= 0; index -= 1) {
		const record = records[index];
		if (record?.type !== "assistant") continue;
		const model = str(obj(record.message).model);
		if (model && model !== "<synthetic>") return model;
	}
	return undefined;
}

export function claudeStatus(status: unknown): SessionStatus {
	switch (status) {
		case "busy":
		case "shell":
			return "running";
		case "idle":
			return "idle";
		case "waiting":
		case "needs_input":
		case "needs-input":
		case "blocked":
			return "waiting";
		default:
			return "unknown";
	}
}

/** Read a process start time from /proc (Linux only). */
export function procStartTime(stat: string): string | undefined {
	// Fields after the parenthesized command; starttime is field 22 overall.
	const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
	return fields[19];
}

function isAlive(entry: JsonObject): boolean {
	const pid = entry.pid;
	if (typeof pid !== "number" || pid <= 0) return false;
	try {
		process.kill(pid, 0);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "EPERM") return false;
	}
	// Guard against PID reuse when the registry records the start time.
	const expected = str(entry.procStart);
	if (expected === undefined) return true;
	try {
		return (
			procStartTime(readFileSync(`/proc/${pid}/stat`, "utf8")) === expected
		);
	} catch {
		return true;
	}
}

export function encodeProjectDir(cwd: string): string {
	return cwd.replace(/[^a-zA-Z0-9]/gu, "-");
}

function findTranscript(
	home: string,
	cwd: string,
	id: string,
): string | undefined {
	const projects = join(home, "projects");
	const direct = join(projects, encodeProjectDir(cwd), `${id}.jsonl`);
	if (mtime(direct) !== undefined) return direct;
	for (const dir of listDir(projects)) {
		const candidate = join(projects, dir, `${id}.jsonl`);
		if (mtime(candidate) !== undefined) return candidate;
	}
	return undefined;
}

const tracker = new SummaryTracker((summary, record) => {
	summary.title = claudeTitle([record]) ?? summary.title;
	summary.model = claudeModel([record]) ?? summary.model;
	summary.last = lastSummary(parseClaudeRecord(record)) ?? summary.last;
});
const startCache = new Map<string, number>();

/**
 * Subagent transcripts start with the prompt, so its timestamp is the start.
 * Only successful reads are cached: the first line may still be mid-write.
 */
function firstTimestamp(path: string): number | undefined {
	const cached = startCache.get(path);
	if (cached !== undefined) return cached;
	const time = parseTime(readFirstRecord(path)?.timestamp);
	if (time !== undefined) startCache.set(path, time);
	return time;
}

function readJson(path: string): JsonObject | undefined {
	try {
		return parseJsonLine(readFileSync(path, "utf8"));
	} catch {
		return undefined;
	}
}

/** Finished subagents stay listed briefly so their final output is visible. */
const FINISHED_SUBAGENT_MS = 10 * 60_000;

function subagentSessions(
	transcript: string,
	parent: Session,
	now: number,
): Session[] {
	const dir = join(transcript.replace(/\.jsonl$/u, ""), "subagents");
	const sessions: Session[] = [];
	for (const name of listDir(dir)) {
		if (!name.endsWith(".jsonl")) continue;
		const path = join(dir, name);
		const updatedAt = mtime(path) ?? 0;
		const meta = readJson(path.replace(/\.jsonl$/u, ".meta.json")) ?? {};
		const finished = meta.finished === true;
		if (finished && now - updatedAt > FINISHED_SUBAGENT_MS) continue;
		const id = name.replace(/\.jsonl$/u, "");
		const kind = str(meta.agentType);
		const description = str(meta.description) ?? id;
		const summary = tracker.summarize(path);
		sessions.push({
			key: `claude:${parent.id}:${id}`,
			agent: "claude",
			id,
			title: oneLine(kind ? `${kind}: ${description}` : description),
			cwd: parent.cwd,
			status: finished ? "ended" : "running",
			updatedAt,
			startedAt: firstTimestamp(path),
			logPath: path,
			parentKey: parent.key,
			model: summary.model,
			last: summary.last,
		});
	}
	return sessions;
}

/** Discover live Claude Code sessions from the session registry. */
export function discoverClaude(now: number): Session[] {
	const home = claudeHome();
	const registry = join(home, "sessions");
	const sessions: Session[] = [];
	for (const name of listDir(registry)) {
		if (!name.endsWith(".json")) continue;
		const entry = readJson(join(registry, name));
		if (!entry || !isAlive(entry)) continue;
		const id = str(entry.sessionId);
		const cwd = str(entry.cwd) ?? "";
		if (!id) continue;
		const logPath = findTranscript(home, cwd, id);
		const summary = logPath ? tracker.summarize(logPath) : {};
		const session: Session = {
			key: `claude:${id}`,
			agent: "claude",
			id,
			title: summary.title ?? oneLine(str(entry.name) ?? id),
			cwd,
			status: claudeStatus(entry.status),
			startedAt: parseTime(entry.startedAt),
			updatedAt:
				(logPath ? mtime(logPath) : undefined) ??
				parseTime(entry.updatedAt) ??
				0,
			logPath: logPath ?? "",
			model: summary.model,
			last: summary.last,
		};
		sessions.push(session);
		if (logPath) {
			sessions.push(...subagentSessions(logPath, session, now));
		}
	}
	tracker.prune();
	return sessions;
}
