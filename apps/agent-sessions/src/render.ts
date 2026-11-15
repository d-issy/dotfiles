import { homedir } from "node:os";
import { basename } from "node:path";
import { type ProjectRow, type SessionRow, sessionRuntime } from "./sessions";
import {
	width as displayWidth,
	formatAge,
	formatClock,
	formatDuration,
	pad,
	truncate,
	wrap,
} from "./text";
import type {
	Agent,
	EntryKind,
	LogEntry,
	Session,
	SessionStatus,
} from "./types";

const RESET = "\u001B[0m";

export const style = {
	bold: (text: string): string => `\u001B[1m${text}${RESET}`,
	dim: (text: string): string => `\u001B[2m${text}${RESET}`,
	color: (rgb: [number, number, number], text: string): string =>
		`\u001B[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${text}${RESET}`,
	invert: (text: string): string => `\u001B[7m${text}${RESET}`,
};

const COLORS = {
	claude: [208, 135, 112],
	codex: [136, 192, 208],
	green: [163, 190, 140],
	yellow: [235, 203, 139],
	blue: [129, 161, 193],
	red: [191, 97, 106],
	magenta: [180, 142, 173],
	gray: [128, 128, 128],
} satisfies Record<string, [number, number, number]>;

const AGENTS: Record<Agent, [number, number, number]> = {
	claude: COLORS.claude,
	codex: COLORS.codex,
};

const STATUSES: Record<SessionStatus, [number, number, number]> = {
	running: COLORS.green,
	waiting: COLORS.yellow,
	idle: COLORS.blue,
	ended: COLORS.gray,
	unknown: COLORS.gray,
};

const KINDS: Record<
	EntryKind,
	{ label: string; maxLines: number; paint: (text: string) => string }
> = {
	user: {
		label: "USER",
		maxLines: 10,
		paint: (text) => style.bold(style.color(COLORS.green, text)),
	},
	assistant: { label: "AI", maxLines: 16, paint: (text) => text },
	thinking: { label: "THINK", maxLines: 4, paint: style.dim },
	tool: {
		label: "TOOL",
		maxLines: 4,
		paint: (text) => style.color(COLORS.yellow, text),
	},
	result: { label: "OUT", maxLines: 3, paint: style.dim },
	error: {
		label: "ERROR",
		maxLines: 6,
		paint: (text) => style.color(COLORS.red, text),
	},
	status: {
		label: "──",
		maxLines: 1,
		paint: (text) => style.color(COLORS.magenta, text),
	},
};

export function projectName(cwd: string): string {
	return basename(cwd) || cwd;
}

export function agentTag(agent: Agent): string {
	return style.color(AGENTS[agent], pad(agent, 6));
}

export function statusTag(status: SessionStatus): string {
	return style.color(STATUSES[status], pad(status, 7));
}

/** Drop the vendor prefix so model names fit a narrow column. */
export function shortModel(model: string | undefined): string {
	return (model ?? "-").replace(/^claude-/u, "");
}

const AGENT_WIDTH = 6;
const STATUS_WIDTH = 7;
const MODEL_WIDTH = 14;
const TIME_WIDTH = 6;
const AGE_WIDTH = 7;

/** Width of the tree column holding guides plus the session title. */
function treeWidth(width: number): number {
	return Math.max(24, Math.min(64, Math.floor(width * 0.38)));
}

function lastWidth(width: number): number {
	return (
		width -
		(2 + treeWidth(width) + 1 + AGENT_WIDTH + 1 + STATUS_WIDTH + 1) -
		(MODEL_WIDTH + 1 + TIME_WIDTH + 1 + AGE_WIDTH + 1)
	);
}

function homeRelative(path: string): string {
	const home = homedir();
	return path === home || path.startsWith(`${home}/`)
		? `~${path.slice(home.length)}`
		: path;
}

/** Column labels aligned with `renderSessionRow`. */
export function renderColumnHeader(width: number): string {
	const rest = lastWidth(width);
	return style.dim(
		[
			"  ",
			pad("PROJECT / SESSION", treeWidth(width)),
			" ",
			pad("AGENT", AGENT_WIDTH),
			" ",
			pad("STATUS", STATUS_WIDTH),
			" ",
			pad("MODEL", MODEL_WIDTH),
			" ",
			"TIME".padStart(TIME_WIDTH),
			" ",
			"UPDATED".padStart(AGE_WIDTH),
			" ",
			rest > 8 ? "LAST" : "",
		].join(""),
	);
}

export function renderProjectRow(row: ProjectRow, width: number): string {
	const name = projectName(row.cwd);
	const detail = `${homeRelative(row.cwd)} · ${row.sessions} session${row.sessions === 1 ? "" : "s"}`;
	return `  ${style.bold(name)}  ${style.dim(truncate(detail, Math.max(0, width - displayWidth(name) - 4)))}`;
}

export function renderSessionRow(
	row: SessionRow,
	selected: boolean,
	width: number,
	now: number,
): string {
	const { session, depth, tree } = row;
	const isChild = depth > 0;
	const muted = (text: string): string =>
		session.status === "ended" ? style.dim(text) : text;
	const runtime = sessionRuntime(session, now);
	const rest = lastWidth(width);
	// The tree column is guides followed by the title; agent is just an attribute.
	const guide = truncate(tree, treeWidth(width));
	const title = pad(
		session.title,
		Math.max(0, treeWidth(width) - displayWidth(guide)),
	);
	const parts = [
		selected ? style.bold("▶ ") : "  ",
		style.dim(guide),
		selected || !isChild ? style.bold(title) : muted(title),
		" ",
		// Subagents inherit the parent's agent, so leave it blank.
		style.color(
			AGENTS[session.agent],
			pad(isChild ? "" : session.agent, AGENT_WIDTH),
		),
		" ",
		statusTag(session.status),
		" ",
		muted(pad(shortModel(session.model), MODEL_WIDTH)),
		" ",
		muted(
			(runtime === undefined ? "-" : formatDuration(runtime)).padStart(
				TIME_WIDTH,
			),
		),
		" ",
		style.dim(`${formatAge(now - session.updatedAt)} ago`.padStart(AGE_WIDTH)),
		" ",
		rest > 8 ? style.dim(truncate(session.last ?? "", rest)) : "",
	];
	return parts.join("");
}

export function renderEmpty(windowMs: number): string[] {
	return [
		"",
		style.dim(
			`  No live Claude sessions or Codex sessions active in the last ${formatAge(windowMs)}.`,
		),
	];
}

export function renderSessionHeader(session: Session, now: number): string {
	const runtime = sessionRuntime(session, now);
	return [
		agentTag(session.agent),
		" ",
		statusTag(session.status),
		" ",
		shortModel(session.model),
		"  ",
		style.bold(session.title),
		"  ",
		style.dim(
			[
				session.cwd,
				...(runtime === undefined ? [] : [`time ${formatDuration(runtime)}`]),
				`updated ${formatAge(now - session.updatedAt)} ago`,
			].join(" · "),
		),
	].join("");
}

const PREFIX_WIDTH = 16;

/**
 * Render log entries into terminal lines that fit `width`. `continued` marks
 * entries appended after existing lines, which only affects the blank line
 * separating user prompts, so appended output renders exactly as in a full
 * re-render.
 */
export function renderEntries(
	entries: LogEntry[],
	width: number,
	continued = false,
): string[] {
	const bodyWidth = Math.max(10, width - PREFIX_WIDTH);
	const lines: string[] = [];
	for (const entry of entries) {
		const kind = KINDS[entry.kind];
		const text = entry.title
			? `${entry.title}${entry.text === "" ? "" : ` ${entry.text}`}`
			: entry.text;
		const body = text.replace(/\n{3,}/gu, "\n\n").trim();
		if (body === "") continue;
		if (entry.kind === "user" && (continued || lines.length > 0)) {
			lines.push("");
		}
		const wrapped = wrap(body, bodyWidth);
		const shown = wrapped.slice(0, kind.maxLines);
		const clock =
			entry.time === undefined ? "        " : formatClock(entry.time);
		shown.forEach((line, index) => {
			const prefix =
				index === 0
					? `${style.dim(clock)} ${kind.paint(pad(kind.label, 6))} `
					: " ".repeat(PREFIX_WIDTH);
			lines.push(prefix + kind.paint(line));
		});
		if (wrapped.length > shown.length) {
			lines.push(
				" ".repeat(PREFIX_WIDTH) +
					style.dim(`… +${wrapped.length - shown.length} lines`),
			);
		}
	}
	return lines;
}
