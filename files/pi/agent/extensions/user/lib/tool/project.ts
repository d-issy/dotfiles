import {
	appendFileSync,
	existsSync,
	mkdtempSync,
	readFileSync,
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
	keyHint,
} from "@earendil-works/pi-coding-agent";
import { type Component, Text } from "@earendil-works/pi-tui";
import { type TSchema, Type } from "typebox";
import { type ModeName, policyRegistry } from "../policy";

const PROJECT_TOOL_SETTINGS_RELATIVE_PATH = ".pi/settings.user.json";
const TOOL_NAME_RE = /^[a-z][a-z0-9_-]*$/u;
const MODE_NAMES = [
	"read",
	"write",
	"yolo",
] as const satisfies readonly ModeName[];
const RUNNING_TAIL_LINES = 3;
const EXPANDED_TAIL_LINES = 200;
const UPDATE_THROTTLE_MS = 100;

const PARAMETER_NAME_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/u;
const PARAMETER_PLACEHOLDER_RE = /^\{\{([A-Za-z_][A-Za-z0-9_-]*)\}\}$/u;

type ProjectToolSettings = {
	tools?: unknown;
};

type ProjectParameterType = "string" | "number" | "boolean";
type ProjectToolExecutionMode = "sequential" | "parallel";

type ProjectParameterConfig = {
	readonly type: ProjectParameterType;
	readonly description?: string;
	readonly required: boolean;
};

type ProjectToolInput = Record<string, string | number | boolean | undefined>;

type ProjectToolCommandArgument =
	| { readonly kind: "literal"; readonly value: string }
	| { readonly kind: "param"; readonly name: string }
	| { readonly kind: "flag"; readonly flag: string; readonly when: string }
	| { readonly kind: "option"; readonly option: string; readonly name: string };

type ProjectToolCommandConfig = {
	readonly label?: string;
	readonly command: string;
	readonly arguments: readonly ProjectToolCommandArgument[];
	readonly cwd?: string;
	readonly timeoutSeconds?: number;
};

type ProjectToolConfig = {
	readonly name: string;
	readonly description: string;
	readonly allowedModes: readonly ModeName[];
	readonly parameters: Readonly<Record<string, ProjectParameterConfig>>;
	readonly executionMode?: ProjectToolExecutionMode;
	readonly cwd?: string;
	readonly timeoutSeconds?: number;
	readonly promptSnippet?: string;
	readonly promptGuidelines?: readonly string[];
	readonly commands: readonly ProjectToolCommandConfig[];
};

type ResolvedProjectToolCommand = ProjectToolCommandConfig & {
	readonly index: number;
	readonly displayLabel: string;
	readonly displayCommand: string;
	readonly absoluteCwd: string;
	readonly displayCwd: string;
	readonly timeoutSeconds?: number;
};

type ResolvedProjectTool = Omit<ProjectToolConfig, "commands"> & {
	readonly parametersSchema: TSchema;
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
	executedCommand?: string;
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

function normalizeExecutionMode(
	value: unknown,
	path: string,
): ProjectToolExecutionMode | undefined {
	if (value === undefined) return undefined;
	if (value === "sequential" || value === "parallel") return value;
	throw new Error(`${path} must be sequential or parallel.`);
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

function normalizeParameter(
	name: string,
	value: unknown,
	path: string,
): ProjectParameterConfig {
	if (!PARAMETER_NAME_RE.test(name)) {
		throw new Error(
			`${path} has invalid parameter name '${name}'. Use letters, numbers, '_' and '-'.`,
		);
	}
	if (!isObject(value)) throw new Error(`${path}.${name} must be an object.`);
	if (
		value.type !== "string" &&
		value.type !== "number" &&
		value.type !== "boolean"
	) {
		throw new Error(`${path}.${name}.type must be string, number, or boolean.`);
	}
	if (value.required !== undefined && typeof value.required !== "boolean") {
		throw new Error(`${path}.${name}.required must be a boolean.`);
	}
	return {
		type: value.type,
		description: normalizeOptionalString(
			value.description,
			`${path}.${name}.description`,
		),
		required: value.required ?? false,
	};
}

function normalizeParameters(
	value: unknown,
	path: string,
): Record<string, ProjectParameterConfig> {
	if (value === undefined) return {};
	if (!isObject(value)) throw new Error(`${path} must be an object.`);

	const parameters: Record<string, ProjectParameterConfig> = {};
	for (const [name, config] of Object.entries(value)) {
		parameters[name] = normalizeParameter(name, config, path);
	}
	return parameters;
}

function getParameter(
	parameters: Readonly<Record<string, ProjectParameterConfig>>,
	name: string,
	path: string,
): ProjectParameterConfig {
	const parameter = parameters[name];
	if (!parameter)
		throw new Error(`${path} references unknown parameter '${name}'.`);
	return parameter;
}

function parseOptionalParameterPlaceholder(
	value: string,
	path: string,
): string | undefined {
	const match = PARAMETER_PLACEHOLDER_RE.exec(value);
	if (match) return match[1];
	if (value.includes("{{") || value.includes("}}")) {
		throw new Error(
			`${path} parameter references must be the whole argument, like "{{name}}".`,
		);
	}
	return undefined;
}

function parseRequiredParameterPlaceholder(
	value: string,
	path: string,
): string {
	const name = parseOptionalParameterPlaceholder(value, path);
	if (!name)
		throw new Error(`${path} must be a parameter reference like "{{name}}".`);
	return name;
}

function normalizeArgument(
	value: unknown,
	path: string,
	parameters: Readonly<Record<string, ProjectParameterConfig>>,
): ProjectToolCommandArgument {
	if (typeof value === "string") {
		const name = parseOptionalParameterPlaceholder(value, path);
		if (!name) return { kind: "literal", value };
		getParameter(parameters, name, path);
		return { kind: "param", name };
	}

	if (!isObject(value)) {
		throw new Error(
			`${path} must be a string, a flag object, or an option object.`,
		);
	}

	const hasFlag = "flag" in value;
	const hasOption = "option" in value;
	if (hasFlag && hasOption) {
		throw new Error(`${path} cannot contain both flag and option.`);
	}

	if (hasFlag) {
		const flag = normalizeOptionalString(value.flag, `${path}.flag`);
		if (!flag) throw new Error(`${path}.flag is required.`);
		const when = normalizeOptionalString(value.when, `${path}.when`);
		if (!when) throw new Error(`${path}.when is required.`);
		const parameter = getParameter(parameters, when, `${path}.when`);
		if (parameter.type !== "boolean") {
			throw new Error(`${path}.when must reference a boolean parameter.`);
		}
		return { kind: "flag", flag, when };
	}

	if (hasOption) {
		const option = normalizeOptionalString(value.option, `${path}.option`);
		if (!option) throw new Error(`${path}.option is required.`);
		const valueReference = normalizeOptionalString(
			value.value,
			`${path}.value`,
		);
		if (!valueReference) throw new Error(`${path}.value is required.`);
		const name = parseRequiredParameterPlaceholder(
			valueReference,
			`${path}.value`,
		);
		const parameter = getParameter(parameters, name, `${path}.value`);
		if (parameter.type === "boolean") {
			throw new Error(
				`${path}.value must reference a string or number parameter.`,
			);
		}
		return { kind: "option", option, name };
	}

	throw new Error(`${path} must contain either flag or option.`);
}

function normalizeCommand(
	value: unknown,
	path: string,
	parameters: Readonly<Record<string, ProjectParameterConfig>>,
): ProjectToolCommandConfig {
	if (!isObject(value)) throw new Error(`${path} must be an object.`);
	const command = normalizeOptionalString(value.command, `${path}.command`);
	if (!command) throw new Error(`${path}.command is required.`);
	if (/\s/u.test(command)) {
		throw new Error(
			`${path}.command must be a single executable token. Put subcommands and flags in arguments.`,
		);
	}
	if (value.arguments !== undefined && !Array.isArray(value.arguments)) {
		throw new Error(`${path}.arguments must be an array.`);
	}
	return {
		command,
		arguments: (value.arguments ?? []).map((argument, index) =>
			normalizeArgument(argument, `${path}.arguments[${index}]`, parameters),
		),
		label: normalizeOptionalString(value.label, `${path}.label`),
		cwd: normalizeOptionalString(value.cwd, `${path}.cwd`),
		timeoutSeconds: normalizeTimeout(
			value.timeoutSeconds,
			`${path}.timeoutSeconds`,
		),
	};
}

function createParameterSchema(parameter: ProjectParameterConfig): TSchema {
	const options = parameter.description
		? { description: parameter.description }
		: undefined;
	if (parameter.type === "string") return Type.String(options);
	if (parameter.type === "number") return Type.Number(options);
	return Type.Boolean(options);
}

function buildParameterSchema(
	parameters: Readonly<Record<string, ProjectParameterConfig>>,
): TSchema {
	const properties: Record<string, TSchema> = {};
	for (const [name, parameter] of Object.entries(parameters)) {
		const schema = createParameterSchema(parameter);
		properties[name] = parameter.required ? schema : Type.Optional(schema);
	}
	return Type.Object(properties, { additionalProperties: false });
}

function formatArgumentForDisplay(
	argument: ProjectToolCommandArgument,
): string {
	if (argument.kind === "literal") return argument.value;
	if (argument.kind === "param") return `{{${argument.name}}}`;
	if (argument.kind === "flag") return `${argument.flag} when ${argument.when}`;
	return `${argument.option} {{${argument.name}}}`;
}

function formatConfiguredCommand(command: ProjectToolCommandConfig): string {
	return [
		command.command,
		...command.arguments.map(formatArgumentForDisplay),
	].join(" ");
}

function normalizeTool(name: string, value: unknown): ProjectToolConfig {
	if (!TOOL_NAME_RE.test(name)) {
		throw new Error(
			`Invalid tool name: ${name}. Use lowercase letters, numbers, '_' and '-'.`,
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

	const parameters = normalizeParameters(
		value.parameters,
		`${name}.parameters`,
	);

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
		parameters,
		executionMode: normalizeExecutionMode(
			value.executionMode,
			`${name}.executionMode`,
		),
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
			normalizeCommand(command, `${name}.commands[${index}]`, parameters),
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
		parametersSchema: buildParameterSchema(config.parameters),
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
				displayCommand: formatConfiguredCommand(command),
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

function shellQuote(value: string): string {
	if (value === "") return "''";
	return `'${value.replace(/'/gu, `'\\''`)}'`;
}

function hasParameterValue(
	value: string | number | boolean | undefined,
): value is string | number | boolean {
	return value !== undefined;
}

function stringifyParameterValue(value: string | number | boolean): string {
	if (typeof value === "number" && !Number.isFinite(value)) {
		throw new Error("Parameter values must be finite numbers.");
	}
	return String(value);
}

function renderCommandArguments(
	argumentsConfig: readonly ProjectToolCommandArgument[],
	params: ProjectToolInput,
): string[] {
	const args: string[] = [];
	for (const argument of argumentsConfig) {
		if (argument.kind === "literal") {
			args.push(argument.value);
			continue;
		}
		if (argument.kind === "param") {
			const value = params[argument.name];
			if (hasParameterValue(value)) args.push(stringifyParameterValue(value));
			continue;
		}
		if (argument.kind === "flag") {
			if (params[argument.when] === true) args.push(argument.flag);
			continue;
		}

		const value = params[argument.name];
		if (hasParameterValue(value)) {
			args.push(argument.option, stringifyParameterValue(value));
		}
	}
	return args;
}

function buildShellCommand(
	command: ResolvedProjectToolCommand,
	params: ProjectToolInput,
): string {
	return [command.command, ...renderCommandArguments(command.arguments, params)]
		.map(shellQuote)
		.join(" ");
}

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

async function executeProjectTool(
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
		await Promise.all(
			states.map((state) =>
				runCommand(state, params, ops, commandPrefix, signal, scheduleUpdate),
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

function formatParameterValueForDisplay(
	value: string | number | boolean,
): string {
	let text: string;
	if (typeof value === "string") {
		text = value === "" ? '""' : value.replace(/[\r\n\t]/gu, " ");
	} else {
		text = String(value);
	}
	return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function formatParameterRecordForDisplay(
	parameters: Readonly<Record<string, string | number | boolean>>,
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
	const parameters: Record<string, string | number | boolean> = {};
	for (const name of Object.keys(tool.parameters)) {
		const value = params[name];
		if (hasParameterValue(value)) parameters[name] = value;
	}
	return formatParameterRecordForDisplay(parameters, theme);
}

function renderCallTitle(
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

function renderResult(
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

function createProjectToolDefinition(
	tool: ResolvedProjectTool,
): ToolDefinition<TSchema, ProjectToolDetails> {
	return {
		name: tool.name,
		label: tool.name,
		description: tool.description,
		promptSnippet: tool.promptSnippet,
		promptGuidelines: tool.promptGuidelines
			? [...tool.promptGuidelines]
			: undefined,
		parameters: tool.parametersSchema,
		executionMode: tool.executionMode ?? "sequential",
		renderCall: (args, theme) =>
			renderCallTitle(tool, args as ProjectToolInput, theme),
		renderResult,
		execute: (
			_toolCallId: string,
			params,
			signal: AbortSignal | undefined,
			onUpdate: AgentToolUpdateCallback<ProjectToolDetails> | undefined,
			ctx: ExtensionContext,
		) =>
			executeProjectTool(
				tool,
				params as ProjectToolInput,
				ctx,
				signal,
				onUpdate,
			),
	};
}

function loadProjectToolSettings(cwd: string): ProjectToolSettings {
	const path = join(cwd, PROJECT_TOOL_SETTINGS_RELATIVE_PATH);
	if (!existsSync(path)) return {};

	const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
	if (!isObject(parsed)) {
		throw new Error(
			`${PROJECT_TOOL_SETTINGS_RELATIVE_PATH} must contain a JSON object.`,
		);
	}
	return parsed as ProjectToolSettings;
}

export function registerProjectTools(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	registeredNames: Set<string>,
): readonly ProjectToolSummary[] {
	registeredNames.clear();
	let projectSettings: ProjectToolSettings;
	try {
		projectSettings = loadProjectToolSettings(ctx.cwd);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		notifyWarning(
			ctx,
			`Failed to read ${PROJECT_TOOL_SETTINGS_RELATIVE_PATH} project tools: ${message}`,
		);
		return [];
	}

	if (projectSettings.tools === undefined) return [];
	if (!isObject(projectSettings.tools)) {
		notifyWarning(ctx, "Project tools ignored: tools must be an object.");
		return [];
	}

	const existingToolNames = new Set(pi.getAllTools().map((tool) => tool.name));
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
