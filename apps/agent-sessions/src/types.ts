export type Agent = "claude" | "codex";

export type SessionStatus =
	| "running"
	| "waiting"
	| "idle"
	| "ended"
	| "unknown";

export interface Session {
	key: string;
	agent: Agent;
	id: string;
	title: string;
	cwd: string;
	status: SessionStatus;
	updatedAt: number;
	startedAt?: number;
	logPath: string;
	parentKey?: string;
	model?: string;
	last?: string;
}

export type EntryKind =
	| "user"
	| "assistant"
	| "thinking"
	| "tool"
	| "result"
	| "error"
	| "status";

export interface LogEntry {
	time?: number;
	kind: EntryKind;
	title?: string;
	text: string;
}

export type JsonObject = Record<string, unknown>;
