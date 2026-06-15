import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	type TruncationResult,
	formatSize,
	keyHint,
	truncateHead,
} from "@earendil-works/pi-coding-agent";
import { type Component, Text } from "@earendil-works/pi-tui";

const COLLAPSED_OUTPUT_LINES = 20;
const EXPANDED_OUTPUT_LINES = 200;

export type LimitedToolOutput = {
	readonly text: string;
	readonly output: string;
	readonly truncated: boolean;
	readonly truncation?: TruncationResult;
	readonly fullOutputPath?: string;
};

export type RenderableTextDetails = {
	readonly output?: string;
	readonly durationMs?: number;
	readonly truncated?: boolean;
	readonly truncation?: TruncationResult;
	readonly fullOutputPath?: string;
};

function safeFileName(value: string): string {
	return (
		value.replace(/[^a-z0-9_.-]+/giu, "_").replace(/^_+|_+$/gu, "") || "output"
	);
}

function formatDuration(ms: number | undefined): string | undefined {
	return ms === undefined ? undefined : `${(ms / 1000).toFixed(1)}s`;
}

function truncationNotice(output: LimitedToolOutput, hint?: string): string {
	const parts: string[] = [];
	if (output.truncation?.truncated) {
		if (output.truncation.truncatedBy === "lines") {
			parts.push(
				`Truncated: showing ${output.truncation.outputLines} of ${output.truncation.totalLines} lines`,
			);
		} else {
			parts.push(
				`Truncated: ${output.truncation.outputLines} lines shown (${formatSize(output.truncation.maxBytes ?? DEFAULT_MAX_BYTES)} limit)`,
			);
		}
	} else {
		parts.push("Truncated");
	}
	if (output.fullOutputPath) {
		parts.push(`Full output saved to: ${output.fullOutputPath}`);
		parts.push("Use read with offset/limit to inspect it");
	}
	if (hint) parts.push(hint);
	return `[${parts.join(". ")}]`;
}

export async function limitToolOutput(
	text: string,
	options: {
		readonly tempPrefix: string;
		readonly fileName: string;
		readonly lineLimit?: number;
		readonly emptyMessage?: string;
		readonly hint?: string;
	},
): Promise<LimitedToolOutput> {
	const lineLimit = options.lineLimit ?? DEFAULT_MAX_LINES;
	const output = text || options.emptyMessage || "(no output)";
	const truncation = truncateHead(output, {
		maxLines: lineLimit,
		maxBytes: DEFAULT_MAX_BYTES,
	});
	if (!truncation.truncated) {
		return { text: output, output, truncated: false };
	}

	const dir = await mkdtemp(join(tmpdir(), `${options.tempPrefix}-`));
	const fullOutputPath = join(dir, safeFileName(options.fileName));
	await writeFile(fullOutputPath, output, "utf8");

	const limited: LimitedToolOutput = {
		text: truncation.content,
		output: truncation.content,
		truncated: true,
		truncation,
		fullOutputPath,
	};
	const notice = truncationNotice(limited, options.hint);
	return {
		...limited,
		text: `${truncation.content}${truncation.content ? "\n\n" : ""}${notice}`,
	};
}

function outputPreview(
	output: string,
	expanded: boolean,
	theme: Theme,
): string[] {
	const trimmed = output.trimEnd();
	if (!trimmed) return [];
	const lines = trimmed.split("\n");
	const maxLines = expanded ? EXPANDED_OUTPUT_LINES : COLLAPSED_OUTPUT_LINES;
	const visible = lines.slice(0, maxLines);
	const remaining = Math.max(0, lines.length - visible.length);
	const result = visible.map((line) => theme.fg("toolOutput", line));
	if (remaining > 0) {
		result.push(
			theme.fg(
				"muted",
				`... (${remaining} more lines, ${keyHint("app.tools.expand", "to expand")})`,
			),
		);
	}
	return result;
}

export function renderLimitedTextResult(
	result: AgentToolResult<RenderableTextDetails>,
	options: { expanded: boolean; isPartial: boolean },
	theme: Theme,
): Component {
	const details = result.details;
	const textOutput =
		details?.output ??
		result.content
			.filter((content) => content.type === "text")
			.map((content) => content.text)
			.join("\n");
	const lines = outputPreview(textOutput, options.expanded, theme);
	if (lines.length === 0) lines.push(theme.fg("muted", "(no output)"));

	if (details?.truncated || details?.fullOutputPath) {
		const warnings: string[] = [];
		if (details.fullOutputPath)
			warnings.push(`full output: ${details.fullOutputPath}`);
		if (details.truncation?.truncated) {
			warnings.push(
				`truncated: showing ${details.truncation.outputLines} of ${details.truncation.totalLines} lines`,
			);
		} else if (details.truncated) {
			warnings.push("truncated");
		}
		lines.push(theme.fg("warning", `[${warnings.join(". ")}]`));
	}

	const duration = formatDuration(details?.durationMs);
	if (duration) lines.push(theme.fg("dim", `Took ${duration}`));
	return new Text(lines.join("\n"), 0, 0);
}
