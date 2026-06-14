import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
} from "@earendil-works/pi-coding-agent";
import type { StreamingOutput } from "./output";
import type {
	ProjectCommandDetails,
	ProjectCommandStatus,
	ProjectToolDetails,
	ResolvedProjectToolCommand,
} from "./types";
import { isObject } from "./utils";

export type MutableCommandState = {
	readonly config: ResolvedProjectToolCommand;
	readonly output: StreamingOutput;
	status: ProjectCommandStatus;
	executedCommand?: string;
	exitCode?: number | null;
	error?: string;
	startedAt?: number;
	endedAt?: number;
};

function commandDetailsFromState(
	state: MutableCommandState,
): ProjectCommandDetails {
	const snapshot = state.output.snapshot();
	return {
		label: state.config.displayLabel,
		command: state.executedCommand ?? state.config.displayCommand,
		cwd: state.config.displayCwd,
		timeoutSeconds: state.config.timeoutSeconds,
		status: state.status,
		exitCode: state.exitCode,
		error: state.error,
		output: snapshot.content,
		fullOutputPath: snapshot.fullOutputPath,
		truncated: snapshot.truncated,
		durationMs: state.startedAt
			? (state.endedAt ?? Date.now()) - state.startedAt
			: undefined,
	};
}

export function buildDetails(
	toolName: string,
	states: readonly MutableCommandState[],
	status: ProjectToolDetails["status"],
): ProjectToolDetails {
	const commands = states.map(commandDetailsFromState);
	return {
		kind: "project-tool",
		toolName,
		status,
		commandCount: states.length,
		failed: commands.some((command) => command.status === "failed"),
		commands,
	};
}

export function statusLine(command: ProjectCommandDetails): string {
	if (command.status === "succeeded") return "exit 0";
	if (command.exitCode !== undefined && command.exitCode !== null)
		return `exit ${command.exitCode}`;
	return command.error ?? command.status;
}

export function formatDuration(ms: number | undefined): string | undefined {
	if (ms === undefined) return undefined;
	return `${(ms / 1000).toFixed(1)}s`;
}

export function formatLlmOutput(details: ProjectToolDetails): string {
	const failed = details.commands.filter(
		(command) => command.status === "failed",
	);
	const lines: string[] = [];
	if (failed.length === 0) {
		lines.push(`Project tool "${details.toolName}" succeeded.`);
	} else {
		lines.push(
			`Project tool "${details.toolName}" failed: ${failed.length} of ${details.commandCount} commands failed.`,
		);
	}

	for (const command of details.commands) {
		lines.push("");
		lines.push(
			`[${command.label}] ${command.status.toUpperCase()} ${statusLine(command)}`,
		);
		lines.push(`command: ${command.command}`);
		lines.push(`cwd: ${command.cwd}`);
		if (command.timeoutSeconds !== undefined)
			lines.push(`timeout: ${command.timeoutSeconds}s`);
		const duration = formatDuration(command.durationMs);
		if (duration) lines.push(`duration: ${duration}`);
		lines.push("output (combined stdout/stderr tail):");
		lines.push(command.output.trimEnd() || "(no output)");
		if (command.truncated && command.fullOutputPath) {
			lines.push("");
			lines.push(
				`[Output truncated to the last ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}. Full output: ${command.fullOutputPath}]`,
			);
		}
	}
	return lines.join("\n");
}

export function isProjectToolDetails(
	value: unknown,
): value is ProjectToolDetails {
	return (
		isObject(value) &&
		value.kind === "project-tool" &&
		Array.isArray(value.commands)
	);
}
