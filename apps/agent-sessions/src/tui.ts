import { JsonlTail } from "./files";
import {
	renderColumnHeader,
	renderEmpty,
	renderEntries,
	renderProjectRow,
	renderSessionHeader,
	renderSessionRow,
	style,
} from "./render";
import {
	type Row,
	type SessionRow,
	discoverSessions,
	filterSessions,
	parseRecord,
	sessionRows,
	toRows,
} from "./sessions";
import { formatAge, truncate } from "./text";
import type { LogEntry, Session } from "./types";

const MAX_ENTRIES = 3000;
const INITIAL_LOG_BYTES = 2 * 1024 * 1024;

interface LogView {
	session: Session;
	tail: JsonlTail;
	entries: LogEntry[];
	lines: string[];
	linesWidth: number;
	dirty: boolean;
	/** Lines scrolled up from the bottom; 0 follows new output. */
	scroll: number;
}

// oxlint-disable-next-line no-control-regex
const KEY_PATTERN = /\u001B\[[0-9;]*[~A-Za-z]|\u001BO[A-Za-z]|[\s\S]/gu;
// oxlint-disable-next-line no-control-regex
const INCOMPLETE_ESCAPE = /\u001B(?:\[[0-9;]*|O)?$/u;
/** How long to wait for the rest of a split escape sequence. */
const ESCAPE_TIMEOUT_MS = 30;

/**
 * Split raw input into keys. A trailing escape prefix is returned as `pending`
 * because terminals may deliver one sequence across several chunks.
 */
export function splitKeys(
	input: string,
	flush = false,
): { keys: string[]; pending: string } {
	const incomplete = flush ? null : INCOMPLETE_ESCAPE.exec(input);
	const complete = incomplete ? input.slice(0, incomplete.index) : input;
	const keys = [...complete.matchAll(KEY_PATTERN)].map((match) => match[0]);
	return { keys, pending: incomplete ? incomplete[0] : "" };
}

export class Tui {
	private rows: Row[] = [];
	/** Selectable rows; `selected` indexes into this list. */
	private sessions: SessionRow[] = [];
	private selected = 0;
	private hiddenIdle = 0;
	private log: LogView | undefined;
	private timers: NodeJS.Timeout[] = [];
	private pendingInput = "";
	private escapeTimer: NodeJS.Timeout | undefined;
	private closed = false;

	constructor(
		private readonly windowMs: number,
		private showIdle = false,
		private readonly out: NodeJS.WriteStream = process.stdout,
		private readonly input: NodeJS.ReadStream = process.stdin,
	) {}

	start(): void {
		// Alternate screen, hidden cursor, no autowrap so long lines are clipped.
		this.out.write("\u001B[?1049h\u001B[?25l\u001B[?7l");
		this.input.setRawMode(true);
		this.input.resume();
		this.input.on("data", (data: Buffer) =>
			this.onInput(this.pendingInput + data.toString("utf8"), false),
		);
		this.out.on("resize", () => this.draw());
		for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
			process.on(signal, () => this.stop());
		}
		process.on("uncaughtException", (error) => {
			this.restore();
			console.error(error);
			process.exit(1);
		});
		this.refresh();
		this.timers.push(
			setInterval(() => this.refresh(), 2000),
			setInterval(() => this.pollLog(), 300),
		);
	}

	private onInput(input: string, flush: boolean): void {
		clearTimeout(this.escapeTimer);
		const { keys, pending } = splitKeys(input, flush);
		this.pendingInput = pending;
		for (const key of keys) this.onKey(key);
		// A lone ESC is the Esc key unless the rest of a sequence follows soon.
		if (pending !== "") {
			this.escapeTimer = setTimeout(
				() => this.onInput(this.pendingInput, true),
				ESCAPE_TIMEOUT_MS,
			);
		}
	}

	stop(): void {
		this.restore();
		process.exit();
	}

	private restore(): void {
		if (this.closed) return;
		this.closed = true;
		for (const timer of this.timers) clearInterval(timer);
		clearTimeout(this.escapeTimer);
		this.input.setRawMode(false);
		this.input.pause();
		this.out.write("\u001B[?7h\u001B[?25h\u001B[?1049l");
	}

	private get width(): number {
		return this.out.columns || 100;
	}

	private get height(): number {
		return this.out.rows || 30;
	}

	private refresh(): void {
		const current = this.sessions[this.selected]?.session.key;
		const discovered = discoverSessions(this.windowMs);
		const visible = filterSessions(discovered, this.showIdle);
		this.hiddenIdle = discovered.length - visible.length;
		this.rows = toRows(visible);
		this.sessions = sessionRows(this.rows);
		const index = this.sessions.findIndex((row) => row.session.key === current);
		this.selected = Math.max(
			0,
			Math.min(index === -1 ? this.selected : index, this.sessions.length - 1),
		);
		if (this.log) {
			const key = this.log.session.key;
			const latest = discovered.find((session) => session.key === key);
			if (latest) this.log.session = latest;
		}
		this.draw();
	}

	private openLog(): void {
		const row = this.sessions[this.selected];
		if (!row || row.session.logPath === "") return;
		this.log = {
			session: row.session,
			tail: new JsonlTail(row.session.logPath, INITIAL_LOG_BYTES),
			entries: [],
			lines: [],
			linesWidth: 0,
			dirty: true,
			scroll: 0,
		};
		this.pollLog();
		this.draw();
	}

	private pollLog(): void {
		const log = this.log;
		if (!log) return;
		const records = log.tail.poll();
		if (records.length === 0) return;
		const added = records.flatMap((record) => parseRecord(log.session, record));
		if (added.length === 0) return;
		log.entries.push(...added);
		if (log.entries.length > MAX_ENTRIES) {
			log.entries.splice(0, log.entries.length - MAX_ENTRIES);
		}
		// Keep a paused viewport anchored: shift it by exactly the appended lines.
		// Evicted entries only remove lines above the viewport.
		const appended =
			log.scroll > 0
				? renderEntries(added, this.width, log.lines.length > 0).length
				: 0;
		log.dirty = true;
		this.layoutLog(log);
		if (log.scroll > 0) {
			log.scroll += appended;
			this.clampScroll(log);
		}
		this.draw();
	}

	private layoutLog(log: LogView): void {
		if (!log.dirty && log.linesWidth === this.width) return;
		log.lines = renderEntries(log.entries, this.width);
		log.linesWidth = this.width;
		log.dirty = false;
		// Reflow can shrink the log; never scroll past its top.
		this.clampScroll(log);
	}

	private clampScroll(log: LogView): void {
		const max = Math.max(0, log.lines.length - this.bodyHeight());
		log.scroll = Math.min(log.scroll, max);
	}

	private bodyHeight(): number {
		return Math.max(1, this.height - 3);
	}

	private scrollBy(delta: number): void {
		const log = this.log;
		if (!log) return;
		log.scroll = Math.max(0, log.scroll + delta);
		this.clampScroll(log);
	}

	private onKey(key: string): void {
		if (key === "\u0003") {
			this.stop();
			return;
		}
		if (this.log) {
			this.onLogKey(key);
		} else {
			this.onListKey(key);
		}
		this.draw();
	}

	private onListKey(key: string): void {
		switch (key) {
			case "q":
			case "\u001B":
				this.stop();
				return;
			case "j":
			case "\u001B[B":
				this.selected = Math.max(
					0,
					Math.min(this.sessions.length - 1, this.selected + 1),
				);
				return;
			case "k":
			case "\u001B[A":
				this.selected = Math.max(0, this.selected - 1);
				return;
			case "g":
				this.selected = 0;
				return;
			case "G":
				this.selected = Math.max(0, this.sessions.length - 1);
				return;
			case "r":
				this.refresh();
				return;
			case "i":
				this.showIdle = !this.showIdle;
				this.refresh();
				return;
			case "\r":
			case "l":
			case "\u001B[C":
				this.openLog();
				return;
			default:
		}
	}

	private onLogKey(key: string): void {
		const page = Math.max(1, Math.floor(this.bodyHeight() / 2));
		switch (key) {
			case "q":
			case "h":
			case "\u001B":
			case "\u001B[D":
			case "\u007F":
				this.log = undefined;
				return;
			case "k":
			case "\u001B[A":
				this.scrollBy(1);
				return;
			case "j":
			case "\u001B[B":
				this.scrollBy(-1);
				return;
			case "\u0015":
			case "\u001B[5~":
				this.scrollBy(page);
				return;
			case "\u0004":
			case "\u001B[6~":
				this.scrollBy(-page);
				return;
			case "g":
				this.scrollBy(Number.MAX_SAFE_INTEGER);
				return;
			case "G":
				if (this.log) this.log.scroll = 0;
				return;
			default:
		}
	}

	private draw(): void {
		if (this.closed) return;
		const width = this.width;
		const height = this.height;
		const now = Date.now();
		const lines = this.log
			? this.drawLog(this.log, width, height, now)
			: this.drawList(width, height, now);
		const screen = lines
			.slice(0, height)
			.map((line) => `${line}\u001B[0m\u001B[K`)
			.join("\r\n");
		this.out.write(`\u001B[H${screen}\u001B[J`);
	}

	private drawList(width: number, height: number, now: number): string[] {
		const count = (status: Session["status"]): number =>
			this.sessions.filter((row) => row.session.status === status).length;
		const header = style.bold(
			truncate(
				`Agent sessions · ${this.sessions.length} shown · ${count("running")} running · ${count("waiting") + count("idle")} awaiting input${this.hiddenIdle > 0 ? ` · ${this.hiddenIdle} idle hidden` : ""}`,
				width,
			),
		);
		const body = height - 3;
		const selectedRow = this.sessions[this.selected];
		const cursor = selectedRow ? this.rows.indexOf(selectedRow) : 0;
		const start = Math.max(
			0,
			Math.min(cursor - Math.floor(body / 2), this.rows.length - body),
		);
		const rows =
			this.rows.length === 0
				? renderEmpty(this.windowMs, this.hiddenIdle)
				: this.rows
						.slice(start, start + body)
						.map((row) =>
							row.kind === "project"
								? renderProjectRow(row, width)
								: renderSessionRow(row, row === selectedRow, width, now),
						);
		const footer = style.dim(
			truncate(
				`↑↓/jk select · enter log · i idle: ${this.showIdle ? "shown" : "hidden"} · r refresh · q quit · window ${formatAge(this.windowMs)}`,
				width,
			),
		);
		return [
			header,
			renderColumnHeader(width),
			...rows,
			...Array(Math.max(0, body - rows.length)).fill(""),
			footer,
		];
	}

	private drawLog(
		log: LogView,
		width: number,
		height: number,
		now: number,
	): string[] {
		this.layoutLog(log);
		// The height may have changed without a reflow, so re-clamp every frame.
		this.clampScroll(log);
		const body = Math.max(1, height - 3);
		const end = Math.max(0, log.lines.length - log.scroll);
		const visible = log.lines.slice(Math.max(0, end - body), end);
		const mode =
			log.scroll === 0
				? style.color([163, 190, 140], "FOLLOW")
				: style.color([235, 203, 139], `PAUSED +${log.scroll}`);
		const footer = `${mode} ${style.dim(
			truncate(
				"· jk scroll · ^u/^d page · g top · G follow · q/esc back",
				width - 12,
			),
		)}`;
		return [
			renderSessionHeader(log.session, now),
			style.dim("─".repeat(width)),
			...visible,
			...Array(Math.max(0, body - visible.length)).fill(""),
			footer,
		];
	}
}
