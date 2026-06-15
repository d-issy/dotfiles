import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import { type Component, Text } from "@earendil-works/pi-tui";
import { hasParameterValue, isProjectArrayParameterValue } from "./arguments";
import { formatDuration, isProjectToolDetails, statusLine } from "./details";
import { truncateLines } from "./output";
import type {
	ProjectParameterValue,
	ProjectScalarParameterValue,
	ProjectToolDetails,
	ProjectToolInput,
	ResolvedProjectTool,
} from "./types";
import { EXPANDED_TAIL_LINES, RUNNING_TAIL_LINES } from "./types";
import { keyHint } from "@earendil-works/pi-coding-agent";

function formatScalarParameterValueForDisplay(
	value: ProjectScalarParameterValue,
): string {
	if (typeof value === "string") {
		return value === "" ? '""' : value.replace(/[\r\n\t]/gu, " ");
	}
	return String(value);
}

function formatParameterValueForDisplay(value: ProjectParameterValue): string {
	let text: string;
	if (isProjectArrayParameterValue(value)) {
		text =
			value.length === 1
				? formatScalarParameterValueForDisplay(value[0])
				: `[${value.map(formatScalarParameterValueForDisplay).join(", ")}]`;
	} else {
		text = formatScalarParameterValueForDisplay(value);
	}
	return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function formatParameterRecordForDisplay(
	parameters: Readonly<Record<string, ProjectParameterValue>>,
	theme: Theme,
): string {
	const parts = Object.entries(parameters).map(
		([name, value]) =>
			`${theme.fg("muted", name)} ${theme.fg(
				"accent",
				formatParameterValueForDisplay(value),
			)}`,
	);
	if (parts.length === 0) return "";
	return `${theme.fg("dim", " (")}${parts.join(theme.fg("dim", ", "))}${theme.fg("dim", ")")}`;
}

function formatParametersForDisplay(
	tool: ResolvedProjectTool,
	params: ProjectToolInput,
	theme: Theme,
): string {
	const parameters: Record<string, ProjectParameterValue> = {};
	for (const name of Object.keys(tool.parameters)) {
		const value = params[name];
		if (hasParameterValue(value)) parameters[name] = value;
	}
	return formatParameterRecordForDisplay(parameters, theme);
}

export function renderCallTitle(
	tool: ResolvedProjectTool,
	args: ProjectToolInput,
	theme: Theme,
): Component {
	let text = theme.fg("toolTitle", theme.bold(tool.name));
	text += formatParametersForDisplay(tool, args, theme);
	if (tool.commands.length > 1) {
		text += theme.fg("dim", ` · ${tool.commands.length} parallel commands`);
	}
	return new Text(text, 0, 0);
}

function renderRunningOutput(
	output: string,
	expanded: boolean,
	theme: Theme,
): string[] {
	const trimmed = output.trimEnd();
	if (!trimmed) return [];

	const outputLines = trimmed.split("\n");
	const maxLines = expanded ? EXPANDED_TAIL_LINES : RUNNING_TAIL_LINES;
	const skipped = Math.max(0, outputLines.length - maxLines);
	const visibleLines = skipped > 0 ? outputLines.slice(skipped) : outputLines;
	const lines: string[] = [];

	if (skipped > 0) {
		lines.push(
			theme.fg(
				"muted",
				`... (${skipped} earlier lines, ${keyHint("app.tools.expand", "to expand")})`,
			),
		);
	}
	lines.push(...visibleLines.map((line) => theme.fg("toolOutput", line)));
	return lines;
}

function renderRunning(
	details: ProjectToolDetails,
	theme: Theme,
	elapsedMs: number | undefined,
	expanded: boolean,
): Component {
	const lines: string[] = [];
	const showCommandHeaders = details.commandCount > 1;
	for (const command of details.commands) {
		if (lines.length > 0) lines.push("");
		if (showCommandHeaders) {
			let header = theme.fg("toolTitle", theme.bold(`[${command.label}]`));
			if (command.status === "succeeded")
				header += ` ${theme.fg("success", "✓")}`;
			if (command.status === "failed") header += ` ${theme.fg("error", "✗")}`;
			lines.push(header);
		}
		const output = renderRunningOutput(command.output, expanded, theme);
		if (output.length > 0) {
			lines.push(...output);
		} else if (command.status === "running" || command.status === "pending") {
			lines.push(theme.fg("muted", "(running...)"));
		} else {
			lines.push(theme.fg("muted", "(no output)"));
		}
	}
	if (elapsedMs !== undefined) {
		lines.push("", theme.fg("dim", `Elapsed ${formatDuration(elapsedMs)}`));
	}
	return new Text(lines.join("\n"), 0, 0);
}

function formatTotalDuration(details: ProjectToolDetails): string | undefined {
	const durations = details.commands
		.map((command) => command.durationMs)
		.filter((duration): duration is number => duration !== undefined);
	if (durations.length === 0) return undefined;
	return formatDuration(Math.max(...durations));
}

function renderSummary(details: ProjectToolDetails, theme: Theme): Component {
	const failed = details.commands.filter(
		(command) => command.status === "failed",
	);
	const success = failed.length === 0;
	const duration = formatTotalDuration(details);
	const status = `${success ? theme.fg("success", "✓") : theme.fg("error", "✗")}${duration ? theme.fg("dim", ` ${duration}`) : ""}`;
	const lines: string[] = [];
	if (details.commandCount > 1) {
		lines.push(
			success
				? theme.fg(
						"success",
						`${details.commandCount}/${details.commandCount} commands succeeded`,
					)
				: theme.fg(
						"error",
						`${failed.length}/${details.commandCount} commands failed`,
					),
		);
		for (const command of failed) {
			lines.push(theme.fg("dim", `[${command.label}] ${statusLine(command)}`));
		}
		lines.push(status);
		return new Text(lines.join("\n"), 0, 0);
	}

	lines.push(status);
	for (const command of failed) {
		lines.push(theme.fg("error", statusLine(command)));
	}
	return new Text(lines.join("\n"), 0, 0);
}

function renderExpanded(details: ProjectToolDetails, theme: Theme): Component {
	const lines: string[] = [];
	const showCommandHeaders = details.commandCount > 1;
	for (const command of details.commands) {
		if (lines.length > 0) lines.push("");
		const ok = command.status === "succeeded";
		if (showCommandHeaders) {
			lines.push(
				`${theme.fg("toolTitle", theme.bold(`[${command.label}]`))} ${ok ? theme.fg("success", "✓") : theme.fg("error", "✗")}`,
			);
		}
		lines.push(theme.fg("dim", statusLine(command)));
		const output = truncateLines(command.output.trimEnd(), EXPANDED_TAIL_LINES);
		lines.push(theme.fg("dim", "output:"));
		lines.push(
			output
				? output
						.split("\n")
						.map((line) => theme.fg("toolOutput", line))
						.join("\n")
				: theme.fg("muted", "(no output)"),
		);
		if (command.truncated && command.fullOutputPath) {
			lines.push(theme.fg("dim", `full output: ${command.fullOutputPath}`));
		}
	}
	return new Text(lines.join("\n"), 0, 0);
}

export function renderResult(
	result: AgentToolResult<ProjectToolDetails>,
	options: { expanded: boolean; isPartial: boolean },
	theme: Theme,
	context: {
		state: { startedAt?: number; interval?: ReturnType<typeof setInterval> };
		invalidate(): void;
	},
): Component {
	const details = result.details;
	if (!isProjectToolDetails(details)) {
		const text =
			result.content.find((content) => content.type === "text")?.text ?? "";
		return new Text(text, 0, 0);
	}
	const running = options.isPartial || details.status === "running";
	if (running) {
		context.state.startedAt ??= Date.now();
		context.state.interval ??= setInterval(() => context.invalidate(), 1000);
		return renderRunning(
			details,
			theme,
			Date.now() - context.state.startedAt,
			options.expanded,
		);
	}
	if (context.state.interval) {
		clearInterval(context.state.interval);
		context.state.interval = undefined;
	}
	context.state.startedAt = undefined;
	return options.expanded
		? renderExpanded(details, theme)
		: renderSummary(details, theme);
}
