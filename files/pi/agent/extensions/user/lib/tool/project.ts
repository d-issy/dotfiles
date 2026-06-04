import {
	appendFileSync,
	mkdtempSync,
	realpathSync,
	writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { StringDecoder } from "node:string_decoder";
import {
	type AgentToolResult,
	type AgentToolUpdateCallback,
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	type ExtensionAPI,
	type ExtensionContext,
	SettingsManager,
	type Theme,
	type ToolDefinition,
	type ToolResultEvent,
	createLocalBashOperations,
	formatSize,
} from "@earendil-works/pi-coding-agent";
import { type Component, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { type ModeName, policyRegistry } from "../policy";

const TOOL_NAME_RE = /^[a-z][a-z0-9_.-]*$/u;
const MODE_NAMES = [
	"read",
	"write",
	"yolo",
] as const satisfies readonly ModeName[];
const RUNNING_TAIL_LINES = 3;
const EXPANDED_TAIL_LINES = 200;
const UPDATE_THROTTLE_MS = 100;

const emptyParams = Type.Object({}, { additionalProperties: false });

type ProjectToolSettings = {
	tools?: unknown;
};

type ProjectToolCommandConfig = {
	readonly label?: string;
	readonly command: string;
	readonly cwd?: string;
	readonly timeoutSeconds?: number;
};

type ProjectToolConfig = {
	readonly name: string;
	readonly description: string;
	readonly allowedModes: readonly ModeName[];
	readonly cwd?: string;
	readonly timeoutSeconds?: number;
	readonly promptSnippet?: string;
	readonly promptGuidelines?: readonly string[];
	readonly commands: readonly ProjectToolCommandConfig[];
};

type ResolvedProjectToolCommand = ProjectToolCommandConfig & {
	readonly index: number;
	readonly displayLabel: string;
	readonly absoluteCwd: string;
	readonly displayCwd: string;
	readonly timeoutSeconds?: number;
};

type ResolvedProjectTool = Omit<ProjectToolConfig, "commands"> & {
	readonly commands: readonly ResolvedProjectToolCommand[];
};

export type ProjectToolSummary = {
	readonly name: string;
	readonly allowedModes: readonly ModeName[];
	readonly commandCount: number;
};

type ProjectCommandStatus = "pending" | "running" | "succeeded" | "failed";

type ProjectCommandDetails = {
	readonly label: string;
	readonly command: string;
	readonly cwd: string;
	readonly timeoutSeconds?: number;
	readonly status: ProjectCommandStatus;
	readonly exitCode?: number | null;
	readonly error?: string;
	readonly output: string;
	readonly fullOutputPath?: string;
	readonly truncated: boolean;
	readonly durationMs?: number;
};

type ProjectToolDetails = {
	readonly kind: "project-tool";
	readonly toolName: string;
	readonly status: "running" | "finished";
	readonly commandCount: number;
	readonly failed: boolean;
	readonly commands: readonly ProjectCommandDetails[];
};

type MutableCommandState = {
	readonly config: ResolvedProjectToolCommand;
	readonly output: StreamingOutput;
	status: ProjectCommandStatus;
	exitCode?: number | null;
	error?: string;
	startedAt?: number;
	endedAt?: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isModeName(value: unknown): value is ModeName {
	return typeof value === "string" && MODE_NAMES.includes(value as ModeName);
}

function notifyWarning(ctx: ExtensionContext, message: string): void {
	ctx.ui.notify(message, "warning");
}

function normalizeTimeout(value: unknown, path: string): number | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		throw new Error(`${path} must be a positive number of seconds.`);
	}
	return value;
}

function normalizeOptionalString(
	value: unknown,
	path: string,
): string | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error(`${path} must be a non-empty string.`);
	}
	return value;
}

function resolveProjectCwd(
	root: string,
	cwd: string | undefined,
	path: string,
): { absolute: string; display: string } {
	if (cwd === undefined || cwd === "") return { absolute: root, display: "." };
	if (isAbsolute(cwd))
		throw new Error(`${path} must be relative to the project root.`);

	const absolute = resolve(root, cwd);
	const rel = relative(root, absolute);
	if (rel === "" || rel === ".") return { absolute: root, display: "." };
	if (rel.startsWith("..") || isAbsolute(rel)) {
		throw new Error(`${path} must stay inside the project root.`);
	}

	const realRoot = realpathSync(root);
	const realAbsolute = realpathSync(absolute);
	const realRel = relative(realRoot, realAbsolute);
	if (realRel.startsWith("..") || isAbsolute(realRel)) {
		throw new Error(`${path} must stay inside the project root.`);
	}
	return { absolute, display: rel };
}

function normalizeCommand(
	value: unknown,
	path: string,
): ProjectToolCommandConfig {
	if (!isObject(value)) throw new Error(`${path} must be an object.`);
	const command = normalizeOptionalString(value.command, `${path}.command`);
	if (!command) throw new Error(`${path}.command is required.`);
	return {
		command,
		label: normalizeOptionalString(value.label, `${path}.label`),
		cwd: normalizeOptionalString(value.cwd, `${path}.cwd`),
		timeoutSeconds: normalizeTimeout(
			value.timeoutSeconds,
			`${path}.timeoutSeconds`,
		),
	};
}

function normalizeTool(name: string, value: unknown): ProjectToolConfig {
	if (!TOOL_NAME_RE.test(name)) {
		throw new Error(
			`Invalid tool name: ${name}. Use lowercase letters, numbers, '_', '-' and '.'.`,
		);
	}
	if (!isObject(value)) throw new Error(`${name} must be an object.`);

	const description = normalizeOptionalString(
		value.description,
		`${name}.description`,
	);
	if (!description) throw new Error(`${name}.description is required.`);

	if (!Array.isArray(value.allowedModes) || value.allowedModes.length === 0) {
		throw new Error(
			`${name}.allowedModes is required and must be a non-empty array.`,
		);
	}
	const allowedModes = value.allowedModes.map((mode, index) => {
		if (!isModeName(mode)) {
			throw new Error(
				`${name}.allowedModes[${index}] must be one of: ${MODE_NAMES.join(", ")}.`,
			);
		}
		return mode;
	});

	if (!Array.isArray(value.commands) || value.commands.length === 0) {
		throw new Error(
			`${name}.commands is required and must be a non-empty array.`,
		);
	}

	const promptGuidelines = value.promptGuidelines;
	if (promptGuidelines !== undefined) {
		if (
			!Array.isArray(promptGuidelines) ||
			!promptGuidelines.every(
				(item) => typeof item === "string" && item.trim() !== "",
			)
		) {
			throw new Error(
				`${name}.promptGuidelines must be an array of non-empty strings.`,
			);
		}
	}

	return {
		name,
		description,
		allowedModes,
		cwd: normalizeOptionalString(value.cwd, `${name}.cwd`),
		timeoutSeconds: normalizeTimeout(
			value.timeoutSeconds,
			`${name}.timeoutSeconds`,
		),
		promptSnippet: normalizeOptionalString(
			value.promptSnippet,
			`${name}.promptSnippet`,
		),
		promptGuidelines,
		commands: value.commands.map((command, index) =>
			normalizeCommand(command, `${name}.commands[${index}]`),
		),
	};
}

function resolveTool(
	root: string,
	config: ProjectToolConfig,
): ResolvedProjectTool {
	const toolCwd = resolveProjectCwd(root, config.cwd, `${config.name}.cwd`);
	return {
		...config,
		commands: config.commands.map((command, index) => {
			const cwd = resolveProjectCwd(
				root,
				command.cwd ?? config.cwd,
				`${config.name}.commands[${index}].cwd`,
			);
			return {
				...command,
				index,
				displayLabel: command.label ?? String(index + 1),
				absoluteCwd: cwd.absolute,
				displayCwd: cwd.display,
				timeoutSeconds: command.timeoutSeconds ?? config.timeoutSeconds,
			};
		}),
		cwd: toolCwd.display === "." ? undefined : toolCwd.display,
	};
}

function safeFileName(value: string): string {
	return (
		value.replace(/[^a-z0-9_.-]+/giu, "_").replace(/^_+|_+$/gu, "") || "command"
	);
}

function truncateLines(text: string, maxLines: number): string {
	const lines = text.split("\n");
	if (lines.length <= maxLines) return text;
	return lines.slice(-maxLines).join("\n");
}

function byteLength(text: string): number {
	return Buffer.byteLength(text, "utf8");
}

class StreamingOutput {
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

function commandDetailsFromState(
	state: MutableCommandState,
): ProjectCommandDetails {
	const snapshot = state.output.snapshot();
	return {
		label: state.config.displayLabel,
		command: state.config.command,
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

function buildDetails(
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

function statusLine(command: ProjectCommandDetails): string {
	if (command.status === "succeeded") return "exit 0";
	if (command.exitCode !== undefined && command.exitCode !== null)
		return `exit ${command.exitCode}`;
	return command.error ?? command.status;
}

function formatDuration(ms: number | undefined): string | undefined {
	if (ms === undefined) return undefined;
	return `${(ms / 1000).toFixed(1)}s`;
}

function formatLlmOutput(details: ProjectToolDetails): string {
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

async function runCommand(
	state: MutableCommandState,
	ops: ReturnType<typeof createLocalBashOperations>,
	commandPrefix: string | undefined,
	signal: AbortSignal | undefined,
	onChange: () => void,
): Promise<void> {
	state.status = "running";
	state.startedAt = Date.now();
	onChange();

	const executedCommand = commandPrefix
		? `${commandPrefix}\n${state.config.command}`
		: state.config.command;
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

async function executeProjectTool(
	tool: ResolvedProjectTool,
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
		await Promise.all(
			states.map((state) =>
				runCommand(state, ops, commandPrefix, signal, scheduleUpdate),
			),
		);
	} finally {
		if (updateTimer) clearTimeout(updateTimer);
	}

	const details = buildDetails(tool.name, states, "finished");
	return {
		content: [{ type: "text", text: formatLlmOutput(details) }],
		details,
	};
}

function isProjectToolDetails(value: unknown): value is ProjectToolDetails {
	return (
		isObject(value) &&
		value.kind === "project-tool" &&
		Array.isArray(value.commands)
	);
}

function renderCallTitle(tool: ResolvedProjectTool, theme: Theme): Component {
	let text = theme.fg("toolTitle", theme.bold(tool.name));
	if (tool.commands.length > 1) {
		text += theme.fg("dim", ` · ${tool.commands.length} parallel commands`);
	}
	return new Text(text, 0, 0);
}

function renderRunning(details: ProjectToolDetails, theme: Theme): Component {
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
		const output = truncateLines(command.output.trimEnd(), RUNNING_TAIL_LINES);
		if (output) {
			lines.push(
				...output.split("\n").map((line) => theme.fg("toolOutput", line)),
			);
		} else if (command.status === "running" || command.status === "pending") {
			lines.push(theme.fg("muted", "(running...)"));
		} else {
			lines.push(theme.fg("muted", "(no output)"));
		}
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
	const lines: string[] = [
		`${theme.fg("toolTitle", theme.bold(details.toolName))} ${success ? theme.fg("success", "✓") : theme.fg("error", "✗")}${duration ? theme.fg("dim", ` · ${duration}`) : ""}`,
	];
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
	}
	for (const command of failed) {
		lines.push(
			theme.fg(
				"error",
				details.commandCount > 1
					? `[${command.label}] ${statusLine(command)}`
					: statusLine(command),
			),
		);
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

function renderResult(
	result: AgentToolResult<ProjectToolDetails>,
	options: { expanded: boolean; isPartial: boolean },
	theme: Theme,
): Component {
	const details = result.details;
	if (!isProjectToolDetails(details)) {
		const text =
			result.content.find((content) => content.type === "text")?.text ?? "";
		return new Text(text, 0, 0);
	}
	if (options.isPartial || details.status === "running")
		return renderRunning(details, theme);
	return options.expanded
		? renderExpanded(details, theme)
		: renderSummary(details, theme);
}

function createProjectToolDefinition(
	tool: ResolvedProjectTool,
): ToolDefinition<typeof emptyParams, ProjectToolDetails> {
	return {
		name: tool.name,
		label: tool.name,
		description: tool.description,
		promptSnippet: tool.promptSnippet,
		promptGuidelines: tool.promptGuidelines
			? [...tool.promptGuidelines]
			: undefined,
		parameters: emptyParams,
		executionMode: "sequential" as const,
		renderCall: (_args, theme, context) =>
			context.isPartial ? renderCallTitle(tool, theme) : new Text("", 0, 0),
		renderResult,
		execute: (
			_toolCallId: string,
			_params: object,
			signal: AbortSignal | undefined,
			onUpdate: AgentToolUpdateCallback<ProjectToolDetails> | undefined,
			ctx: ExtensionContext,
		) => executeProjectTool(tool, ctx, signal, onUpdate),
	};
}

export function registerProjectTools(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	registeredNames: Set<string>,
): readonly ProjectToolSummary[] {
	registeredNames.clear();
	let projectSettings: ProjectToolSettings;
	try {
		projectSettings = SettingsManager.create(
			ctx.cwd,
		).getProjectSettings() as ProjectToolSettings;
	} catch (error) {
		notifyWarning(
			ctx,
			`Failed to read project tools: ${error instanceof Error ? error.message : String(error)}`,
		);
		return [];
	}

	if (projectSettings.tools === undefined) return [];
	if (!isObject(projectSettings.tools)) {
		notifyWarning(ctx, "Project tools ignored: tools must be an object.");
		return [];
	}

	const existingToolNames = new Set(pi.getAllTools().map((tool) => tool.name));
	const newlyRegistered: string[] = [];
	const summaries: ProjectToolSummary[] = [];
	for (const [name, rawConfig] of Object.entries(projectSettings.tools)) {
		try {
			if (existingToolNames.has(name) || registeredNames.has(name)) {
				notifyWarning(
					ctx,
					`Project tool '${name}' conflicts with an existing tool and was ignored.`,
				);
				continue;
			}
			const resolved = resolveTool(ctx.cwd, normalizeTool(name, rawConfig));
			pi.registerTool(createProjectToolDefinition(resolved));
			policyRegistry.register({ name, allowedModes: resolved.allowedModes });
			registeredNames.add(name);
			newlyRegistered.push(name);
			summaries.push({
				name,
				allowedModes: resolved.allowedModes,
				commandCount: resolved.commands.length,
			});
		} catch (error) {
			notifyWarning(
				ctx,
				`Project tool '${name}' ignored: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	if (newlyRegistered.length > 0) {
		pi.setActiveTools([
			...new Set([...pi.getActiveTools(), ...newlyRegistered]),
		]);
	}
	return summaries;
}

export function markFailedProjectToolResult(
	registeredNames: ReadonlySet<string>,
	event: ToolResultEvent,
): { isError: true } | undefined {
	if (!registeredNames.has(event.toolName)) return undefined;
	if (!isProjectToolDetails(event.details)) return undefined;
	return event.details.failed ? { isError: true } : undefined;
}
