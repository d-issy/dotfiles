import type { LogEntry } from "./types";

// Strip terminal escape sequences and control characters from untrusted log text.
const ESCAPE_PATTERN =
	// oxlint-disable-next-line no-control-regex
	/\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001B]*(?:\u0007|\u001B\\)|[@-Z\\-_])/gu;
// oxlint-disable-next-line no-control-regex
const CONTROL_PATTERN = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/gu;

export function sanitize(text: string): string {
	return text
		.replace(ESCAPE_PATTERN, "")
		.replace(/\r\n?/gu, "\n")
		.replace(/\t/gu, "  ")
		.replace(CONTROL_PATTERN, "");
}

export function oneLine(text: string): string {
	return sanitize(text).replace(/\s+/gu, " ").trim();
}

function isWide(code: number): boolean {
	return (
		(code >= 0x1100 && code <= 0x115f) ||
		(code >= 0x2e80 && code <= 0x303e) ||
		(code >= 0x3041 && code <= 0x33ff) ||
		(code >= 0x3400 && code <= 0x4dbf) ||
		(code >= 0x4e00 && code <= 0x9fff) ||
		(code >= 0xa000 && code <= 0xa4cf) ||
		(code >= 0xac00 && code <= 0xd7a3) ||
		(code >= 0xf900 && code <= 0xfaff) ||
		(code >= 0xfe30 && code <= 0xfe4f) ||
		(code >= 0xff00 && code <= 0xff60) ||
		(code >= 0xffe0 && code <= 0xffe6) ||
		(code >= 0x1f300 && code <= 0x1f64f) ||
		(code >= 0x1f900 && code <= 0x1f9ff) ||
		(code >= 0x20000 && code <= 0x3fffd)
	);
}

function isZeroWidth(code: number): boolean {
	return (
		(code >= 0x0300 && code <= 0x036f) ||
		(code >= 0x200b && code <= 0x200f) ||
		(code >= 0xfe00 && code <= 0xfe0f) ||
		code === 0x20e3
	);
}

export function charWidth(char: string): number {
	const code = char.codePointAt(0) ?? 0;
	if (isZeroWidth(code)) return 0;
	return isWide(code) ? 2 : 1;
}

export function width(text: string): number {
	let total = 0;
	for (const char of text) total += charWidth(char);
	return total;
}

/** Truncate plain text to a display width, appending an ellipsis when cut. */
export function truncate(text: string, max: number): string {
	if (max <= 0) return "";
	if (width(text) <= max) return text;
	let out = "";
	let used = 0;
	for (const char of text) {
		const w = charWidth(char);
		if (used + w > max - 1) break;
		out += char;
		used += w;
	}
	return `${out}…`;
}

export function pad(text: string, size: number): string {
	const cut = truncate(text, size);
	return cut + " ".repeat(Math.max(0, size - width(cut)));
}

/** Wrap plain text into lines that fit a display width. */
export function wrap(text: string, max: number): string[] {
	if (max <= 0) return [];
	const lines: string[] = [];
	for (const raw of text.split("\n")) {
		let line = "";
		let used = 0;
		for (const char of raw) {
			const w = charWidth(char);
			if (used + w > max) {
				lines.push(line);
				line = "";
				used = 0;
			}
			line += char;
			used += w;
		}
		lines.push(line);
	}
	return lines;
}

export function formatAge(ms: number): string {
	const seconds = Math.max(0, Math.floor(ms / 1000));
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 48) return `${hours}h`;
	return `${Math.floor(hours / 24)}d`;
}

export function formatClock(time: number): string {
	const date = new Date(time);
	return [date.getHours(), date.getMinutes(), date.getSeconds()]
		.map((part) => String(part).padStart(2, "0"))
		.join(":");
}

export function lastSummary(entries: LogEntry[]): string | undefined {
	const entry = entries.at(-1);
	if (!entry) return undefined;
	return oneLine(entry.title ? `${entry.title} ${entry.text}` : entry.text);
}

/** Parse durations like `30m`, `2h`, or `1d`; bare numbers are minutes. */
export function parseDuration(value: string): number | undefined {
	const match = /^(\d+)(s|m|h|d)?$/u.exec(value.trim());
	if (!match) return undefined;
	const units: Record<string, number> = {
		s: 1000,
		m: 60_000,
		h: 3_600_000,
		d: 86_400_000,
	};
	return Number(match[1]) * (units[match[2] ?? "m"] ?? 60_000);
}

const two = (value: number): string => String(value).padStart(2, "0");

/** Compact duration such as `45s`, `12m05s`, or `1h05m`. */
export function formatDuration(ms: number): string {
	const seconds = Math.max(0, Math.floor(ms / 1000));
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m${two(seconds % 60)}s`;
	const hours = Math.floor(minutes / 60);
	if (hours < 48) return `${hours}h${two(minutes % 60)}m`;
	return `${Math.floor(hours / 24)}d${two(hours % 24)}h`;
}
