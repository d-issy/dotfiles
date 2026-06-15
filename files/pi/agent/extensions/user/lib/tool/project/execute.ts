import {
	type AgentToolResult,
	type AgentToolUpdateCallback,
	type ExtensionContext,
	SettingsManager,
	createLocalBashOperations,
} from "@earendil-works/pi-coding-agent";
import { buildShellCommand } from "./arguments";
import {
	type MutableCommandState,
	buildDetails,
	formatLlmOutput,
} from "./details";
import { StreamingOutput } from "./output";
import type {
	ProjectToolDetails,
	ProjectToolInput,
	ResolvedProjectTool,
} from "./types";
import { UPDATE_THROTTLE_MS } from "./types";

async function runCommand(
	state: MutableCommandState,
	params: ProjectToolInput,
	ops: ReturnType<typeof createLocalBashOperations>,
	commandPrefix: string | undefined,
	signal: AbortSignal | undefined,
	onChange: () => void,
): Promise<void> {
	state.status = "running";
	state.startedAt = Date.now();
	onChange();

	state.executedCommand = buildShellCommand(state.config, params);
	const executedCommand = commandPrefix
		? `${commandPrefix}\n${state.executedCommand}`
		: state.executedCommand;
	try {
		const result = await ops.exec(executedCommand, state.config.absoluteCwd, {
			onData: (data) => {
				state.output.append(data);
				onChange();
			},
			signal,
			timeout: state.config.timeoutSeconds,
		});
		state.exitCode = result.exitCode;
		state.status = result.exitCode === 0 ? "succeeded" : "failed";
	} catch (error) {
		state.status = "failed";
		state.exitCode = null;
		if (error instanceof Error && error.message.startsWith("timeout:")) {
			const timeout =
				error.message.split(":")[1] ??
				String(state.config.timeoutSeconds ?? "");
			state.error = `timed out after ${timeout}s`;
		} else if (error instanceof Error && error.message === "aborted") {
			state.error = "aborted";
		} else {
			state.error = error instanceof Error ? error.message : String(error);
		}
	} finally {
		state.output.finish();
		state.endedAt = Date.now();
		onChange();
	}
}

export async function executeProjectTool(
	tool: ResolvedProjectTool,
	params: ProjectToolInput,
	ctx: ExtensionContext,
	signal: AbortSignal | undefined,
	onUpdate: AgentToolUpdateCallback<ProjectToolDetails> | undefined,
): Promise<AgentToolResult<ProjectToolDetails>> {
	const states: MutableCommandState[] = tool.commands.map((command) => ({
		config: command,
		output: new StreamingOutput(command.displayLabel),
		status: "pending",
	}));

	const settings = SettingsManager.create(ctx.cwd);
	const ops = createLocalBashOperations({ shellPath: settings.getShellPath() });
	const commandPrefix = settings.getShellCommandPrefix();
	let updateTimer: ReturnType<typeof setTimeout> | undefined;
	let updateDirty = false;
	let lastUpdateAt = 0;

	const emitUpdate = (): void => {
		if (!onUpdate || !updateDirty) return;
		updateDirty = false;
		lastUpdateAt = Date.now();
		onUpdate({
			content: [],
			details: buildDetails(tool.name, states, "running"),
		});
	};
	const scheduleUpdate = (): void => {
		if (!onUpdate) return;
		updateDirty = true;
		const delay = UPDATE_THROTTLE_MS - (Date.now() - lastUpdateAt);
		if (delay <= 0) {
			if (updateTimer) clearTimeout(updateTimer);
			updateTimer = undefined;
			emitUpdate();
			return;
		}
		updateTimer ??= setTimeout(() => {
			updateTimer = undefined;
			emitUpdate();
		}, delay);
	};

	try {
		scheduleUpdate();
		if (tool.executionMode === "sequential") {
			for (const state of states) {
				// oxlint-disable-next-line no-await-in-loop -- commands are intentionally serialized by project tool configuration.
				await runCommand(
					state,
					params,
					ops,
					commandPrefix,
					signal,
					scheduleUpdate,
				);
			}
		} else {
			await Promise.all(
				states.map((state) =>
					runCommand(state, params, ops, commandPrefix, signal, scheduleUpdate),
				),
			);
		}
	} finally {
		if (updateTimer) clearTimeout(updateTimer);
	}

	const details = buildDetails(tool.name, states, "finished");
	return {
		content: [{ type: "text", text: formatLlmOutput(details) }],
		details,
	};
}
