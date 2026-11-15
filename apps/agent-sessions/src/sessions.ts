import { basename } from "node:path";
import { discoverClaude, parseClaudeRecord } from "./claude";
import { discoverCodex, parseCodexRecord } from "./codex";
import type { JsonObject, LogEntry, Session } from "./types";

export interface ProjectRow {
	kind: "project";
	cwd: string;
	sessions: number;
}

export interface SessionRow {
	kind: "session";
	session: Session;
	depth: number;
	/** Tree guide drawn before the row, e.g. "├─ " or "│  └─ ". */
	tree: string;
}

export type Row = ProjectRow | SessionRow;

/** Stable order: oldest start first so rows do not jump on every update. */
const byStart = (a: Session, b: Session): number =>
	(a.startedAt ?? a.updatedAt) - (b.startedAt ?? b.updatedAt) ||
	a.key.localeCompare(b.key);

const byProject = (a: string, b: string): number =>
	basename(a).localeCompare(basename(b)) || a.localeCompare(b);

/** Group sessions by project, each project followed by its session tree. */
export function toRows(sessions: Session[]): Row[] {
	const byKey = new Map(sessions.map((session) => [session.key, session]));
	const children = new Map<string, Session[]>();
	const projects = new Map<string, Session[]>();
	for (const session of sessions) {
		const parent = session.parentKey;
		if (parent && byKey.has(parent) && parent !== session.key) {
			children.set(parent, [...(children.get(parent) ?? []), session]);
		} else {
			projects.set(session.cwd, [
				...(projects.get(session.cwd) ?? []),
				session,
			]);
		}
	}
	const rows: Row[] = [];
	const seen = new Set<string>();
	const visitAll = (list: Session[], depth: number, guide: string): void => {
		const pending = list.filter((session) => !seen.has(session.key));
		pending.toSorted(byStart).forEach((session, index) => {
			if (seen.has(session.key)) return;
			seen.add(session.key);
			const last = index === pending.length - 1;
			rows.push({
				kind: "session",
				session,
				depth,
				tree: `${guide}${last ? "└─ " : "├─ "}`,
			});
			visitAll(
				children.get(session.key) ?? [],
				depth + 1,
				`${guide}${last ? "   " : "│  "}`,
			);
		});
	};
	for (const cwd of [...projects.keys()].toSorted(byProject)) {
		const roots = projects.get(cwd) ?? [];
		rows.push({ kind: "project", cwd, sessions: roots.length });
		visitAll(roots, 0, "");
	}
	return rows;
}

export function sessionRows(rows: Row[]): SessionRow[] {
	return rows.filter((row): row is SessionRow => row.kind === "session");
}

/** Hide idle sessions, including subagents whose main session is hidden. */
export function filterSessions(
	sessions: Session[],
	showIdle = false,
): Session[] {
	return sessions.filter((session) => showIdle || session.status !== "idle");
}

export function discoverSessions(
	windowMs: number,
	now = Date.now(),
): Session[] {
	return [...discoverClaude(now), ...discoverCodex(now, windowMs)];
}

export function parseRecord(session: Session, record: JsonObject): LogEntry[] {
	return session.agent === "claude"
		? parseClaudeRecord(record)
		: parseCodexRecord(record);
}

/**
 * Elapsed run time: active sessions count up to now, finished ones stop at
 * their last log write.
 */
export function sessionRuntime(
	session: Session,
	now: number,
): number | undefined {
	if (session.startedAt === undefined) return undefined;
	const active = session.status === "running" || session.status === "waiting";
	return Math.max(0, (active ? now : session.updatedAt) - session.startedAt);
}
