import { appendFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
} from "@earendil-works/pi-coding-agent";

function safeFileName(value: string): string {
	return (
		value.replace(/[^a-z0-9_.-]+/giu, "_").replace(/^_+|_+$/gu, "") || "command"
	);
}

export function truncateLines(text: string, maxLines: number): string {
	const lines = text.split("\n");
	if (lines.length <= maxLines) return text;
	return lines.slice(-maxLines).join("\n");
}

function byteLength(text: string): number {
	return Buffer.byteLength(text, "utf8");
}

export class StreamingOutput {
	private readonly decoder = new StringDecoder("utf8");
	private readonly maxLines: number;
	private readonly maxBytes: number;
	private readonly tempFileName: string;
	private tail = "";
	private fullText: string | undefined = "";
	private tempFilePath: string | undefined;
	private completedLines = 0;
	private hasOpenLine = false;
	private totalBytes = 0;

	constructor(
		label: string,
		options?: { maxLines?: number; maxBytes?: number },
	) {
		this.maxLines = options?.maxLines ?? DEFAULT_MAX_LINES;
		this.maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
		this.tempFileName = `${safeFileName(label)}.log`;
	}

	append(data: Buffer): void {
		const text = this.decoder.write(data);
		this.appendText(text);
	}

	finish(): void {
		this.appendText(this.decoder.end());
	}

	snapshot(): {
		content: string;
		truncated: boolean;
		fullOutputPath?: string;
		totalLines: number;
		totalBytes: number;
	} {
		return {
			content: this.tail,
			truncated: this.tempFilePath !== undefined,
			fullOutputPath: this.tempFilePath,
			totalLines: this.totalLines,
			totalBytes: this.totalBytes,
		};
	}

	private get totalLines(): number {
		return this.completedLines + (this.hasOpenLine ? 1 : 0);
	}

	private appendText(text: string): void {
		if (!text) return;
		this.totalBytes += byteLength(text);
		this.completedLines += text.match(/\n/gu)?.length ?? 0;
		this.hasOpenLine = !text.endsWith("\n");

		if (this.tempFilePath) {
			appendFileSync(this.tempFilePath, text, "utf8");
		} else {
			this.fullText = `${this.fullText ?? ""}${text}`;
		}

		this.tail += text;
		this.trimTail();

		if (
			!this.tempFilePath &&
			(this.totalLines > this.maxLines || this.totalBytes > this.maxBytes)
		) {
			const dir = mkdtempSync(join(tmpdir(), "pi-project-tool-"));
			this.tempFilePath = join(dir, this.tempFileName);
			writeFileSync(this.tempFilePath, this.fullText ?? "", "utf8");
			this.fullText = undefined;
		}
	}

	private trimTail(): void {
		this.tail = truncateLines(this.tail, this.maxLines);
		while (byteLength(this.tail) > this.maxBytes) {
			const newline = this.tail.indexOf("\n");
			if (newline === -1) {
				this.tail = this.tail.slice(
					Math.max(0, this.tail.length - this.maxBytes),
				);
				break;
			}
			this.tail = this.tail.slice(newline + 1);
		}
	}
}
