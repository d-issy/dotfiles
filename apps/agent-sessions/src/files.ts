import { closeSync, openSync, readSync, readdirSync, statSync } from "node:fs";
import { parseJsonLine } from "./json";
import type { JsonObject, SessionStatus } from "./types";

export function mtime(path: string): number | undefined {
	try {
		return statSync(path).mtimeMs;
	} catch {
		return undefined;
	}
}

export function listDir(path: string): string[] {
	try {
		return readdirSync(path);
	} catch {
		return [];
	}
}

function readRange(path: string, start: number, length: number): Buffer {
	const fd = openSync(path, "r");
	try {
		const buffer = Buffer.alloc(length);
		const read = readSync(fd, buffer, 0, length, start);
		return buffer.subarray(0, read);
	} finally {
		closeSync(fd);
	}
}

/** Parse the first JSONL record, reading at most `limit` bytes. */
export function readFirstRecord(
	path: string,
	limit = 4 * 1024 * 1024,
): JsonObject | undefined {
	try {
		const buffer = readRange(path, 0, limit);
		const end = buffer.indexOf(0x0a);
		return parseJsonLine(
			buffer.subarray(0, end === -1 ? buffer.length : end).toString("utf8"),
		);
	} catch {
		return undefined;
	}
}

function splitRecords(text: string): JsonObject[] {
	const records: JsonObject[] = [];
	for (const line of text.split("\n")) {
		const record = parseJsonLine(line);
		if (record) records.push(record);
	}
	return records;
}

/** Incrementally follows a JSONL file that is appended to. */
export class JsonlTail {
	private offset = -1;
	private partial = Buffer.alloc(0);

	constructor(
		readonly path: string,
		private readonly initialBytes: number,
	) {}

	poll(): JsonObject[] {
		let size: number;
		try {
			size = statSync(this.path).size;
		} catch {
			return [];
		}
		if (this.offset < 0 || size < this.offset) {
			this.offset = Math.max(0, size - this.initialBytes);
			this.partial = Buffer.alloc(0);
			if (this.offset > 0) {
				// Drop the record cut by the initial window.
				const text = this.read(size);
				return splitRecords(text.slice(text.indexOf("\n") + 1));
			}
		}
		if (size === this.offset) return [];
		return splitRecords(this.read(size));
	}

	private read(size: number): string {
		const chunk = readRange(this.path, this.offset, size - this.offset);
		this.offset += chunk.length;
		// Keep bytes after the last newline so split multi-byte characters survive.
		const buffer = Buffer.concat([this.partial, chunk]);
		const end = buffer.lastIndexOf(0x0a);
		// Copy so the leftover bytes do not keep the whole read buffer alive.
		this.partial = Buffer.from(buffer.subarray(end + 1));
		return buffer.subarray(0, end + 1).toString("utf8");
	}
}

export interface LogSummary {
	title?: string;
	model?: string;
	status?: SessionStatus;
	last?: string;
}

/**
 * Keeps per-file summaries current by folding every appended record, so a
 * large burst of output can never hide a status or model change.
 */
export class SummaryTracker {
	private readonly entries = new Map<
		string,
		{ tail: JsonlTail; summary: LogSummary }
	>();
	private seen = new Set<string>();

	constructor(
		private readonly reduce: (summary: LogSummary, record: JsonObject) => void,
	) {}

	summarize(path: string): LogSummary {
		this.seen.add(path);
		let entry = this.entries.get(path);
		if (!entry) {
			entry = {
				tail: new JsonlTail(path, Number.MAX_SAFE_INTEGER),
				summary: {},
			};
			this.entries.set(path, entry);
		}
		for (const record of entry.tail.poll()) this.reduce(entry.summary, record);
		return entry.summary;
	}

	/** Drop state for files not summarized since the previous call. */
	prune(): void {
		for (const path of this.entries.keys()) {
			if (!this.seen.has(path)) this.entries.delete(path);
		}
		this.seen = new Set();
	}
}
