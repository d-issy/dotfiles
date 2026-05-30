import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	type ExtensionAPI,
	type ExtensionContext,
	SettingsManager,
	formatSize,
	keyHint,
	truncateTail,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { type TSchema, Type } from "typebox";
import { type ModeName, policyRegistry } from "./tools/lib/policy";

const SETTINGS_DIR = ".pi";
const SETTINGS_FILE = "settings.json";
const DEFAULT_MODES: readonly ModeName[] = ["yolo"];
const MODE_NAMES = new Set<ModeName>(["read", "write", "yolo"]);
const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/u;
const INTERPOLATION_PATTERN = /^\{\{([a-zA-Z0-9_-]+)\}\}$/u;
const EMBEDDED_INTERPOLATION_PATTERN = /\{\{([a-zA-Z0-9_-]+)\}\}/gu;
const PREVIEW_MAX_LINES = 5;
const FAILURE_MAX_LINES = 20;
const USER_MAX_BYTES = 8 * 1024;

type ParameterType =
	| "string"
	| "number"
	| "boolean"
	| "path"
	| "string[]"
	| "number[]"
	| "path[]";

type ParameterDefinition = {
	type?: unknown;
	description?: unknown;
	required?: unknown;
};

type CommandPart = string | { param?: unknown; args?: unknown };

type CommandDefinition = {
	name?: unknown;
	command?: unknown;
};

type NormalizedCommand = {
	name: string;
	command: CommandPart[];
};

type SettingsToolDefinition = {
	description?: unknown;
	promptSnippet?: unknown;
	promptGuidelines?: unknown;
	modes?: unknown;
	command?: unknown;
	commands?: unknown;
	parallel?: unknown;
	parameters?: unknown;
	cwd?: unknown;
	timeoutSeconds?: unknown;
};

type SettingsWithTools = {
	tools?: unknown;
};

type LoadedTool = {
	name: string;
	scope: "global" | "project";
	baseRoot: string;
	definition: SettingsToolDefinition;
};

type NormalizedParameter = {
	name: string;
	type: ParameterType;
	description?: string;
	required: boolean;
};

type NormalizedTool = {
	name: string;
	description: string;
	promptSnippet?: string;
	promptGuidelines?: string[];
	modes: ModeName[];
	commands: NormalizedCommand[];
	parallel: boolean;
	parameters: Map<string, NormalizedParameter>;
	baseRoot: string;
	cwd?: string;
	timeoutSeconds?: number;
};

type ToolInput = Record<string, unknown>;

type ValidationResult<T> =
	| { ok: true; value: T }
	| { ok: false; errors: string[] };

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isModeName(value: unknown): value is ModeName {
	return typeof value === "string" && MODE_NAMES.has(value as ModeName);
}

function isParameterType(value: unknown): value is ParameterType {
	return (
		value === "string" ||
		value === "number" ||
		value === "boolean" ||
		value === "path" ||
		value === "string[]" ||
		value === "number[]" ||
		value === "path[]"
	);
}

function isInside(root: string, path: string): boolean {
	const rel = relative(root, path);
	return (
		rel === "" ||
		!(rel === ".." || rel.startsWith(`..${sep}`) || rel.startsWith("../"))
	);
}

function stripAtPrefix(path: string): string {
	return path.startsWith("@") ? path.slice(1) : path;
}

function resolveInsideRoot(root: string, path: string, label: string): string {
	const normalized = stripAtPrefix(path);
	if (normalized.trim() === "") throw new Error(`${label} must not be empty.`);
	const absolute = resolve(root, normalized);
	if (!isInside(root, absolute)) {
		throw new Error(`${label} must stay inside ${root}: ${path}`);
	}
	return absolute;
}

function pathArg(
	root: string,
	cwd: string,
	path: string,
	label: string,
): string {
	const absolute = resolveInsideRoot(root, path, label);
	const rel = relative(cwd, absolute);
	return rel === "" ? "." : rel;
}

function renderWarning(ctx: ExtensionContext, message: string): void {
	ctx.ui.notify(`[settings-tools] ${message}`, "warning");
}

async function readJsonFile(path: string): Promise<unknown> {
	return JSON.parse(await readFile(path, "utf8"));
}

function findNearestProjectSettings(cwd: string): string | undefined {
	let dir = resolve(cwd);
	while (true) {
		const candidate = join(dir, SETTINGS_DIR, SETTINGS_FILE);
		if (existsSync(candidate)) return candidate;
		const parent = dirname(dir);
		if (parent === dir) return undefined;
		dir = parent;
	}
}

async function loadProjectSettings(cwd: string): Promise<
	| {
			settings: SettingsWithTools;
			baseRoot: string;
			path: string;
	  }
	| undefined
> {
	const settingsPath = findNearestProjectSettings(cwd);
	if (!settingsPath) return undefined;
	const parsed = await readJsonFile(settingsPath);
	return {
		settings: isObject(parsed) ? (parsed as SettingsWithTools) : {},
		baseRoot: dirname(dirname(settingsPath)),
		path: settingsPath,
	};
}

function collectTools(
	settings: SettingsWithTools,
	scope: "global" | "project",
	baseRoot: string,
	onWarning: (message: string) => void,
): LoadedTool[] {
	if (settings.tools === undefined) return [];
	if (!isObject(settings.tools)) {
		onWarning(`${scope} tools must be an object.`);
		return [];
	}

	return Object.entries(settings.tools).flatMap(
		([name, definition]): LoadedTool[] => {
			if (!TOOL_NAME_PATTERN.test(name)) {
				onWarning(
					`Invalid ${scope} tool name: ${name}. Use only letters, numbers, '_' and '-'.`,
				);
				return [];
			}
			if (!isObject(definition)) {
				onWarning(`${scope} tool ${name} must be an object.`);
				return [];
			}
			return [
				{
					name,
					scope,
					baseRoot,
					definition: definition as SettingsToolDefinition,
				},
			];
		},
	);
}

function normalizeTool(tool: LoadedTool): ValidationResult<NormalizedTool> {
	const errors: string[] = [];
	const definition = tool.definition;

	if (
		typeof definition.description !== "string" ||
		definition.description.trim() === ""
	) {
		errors.push("description must be a non-empty string.");
	}
	const modes = normalizeModes(definition.modes, errors);
	const parameters = normalizeParameters(definition.parameters, errors);
	const commands = normalizeCommands(tool.name, definition, errors);

	let parallel = false;
	if (definition.parallel !== undefined) {
		if (typeof definition.parallel !== "boolean")
			errors.push("parallel must be a boolean.");
		else parallel = definition.parallel;
	}

	let cwd: string | undefined;
	if (definition.cwd !== undefined) {
		if (typeof definition.cwd !== "string") {
			errors.push("cwd must be a string.");
		} else {
			try {
				cwd = resolveInsideRoot(tool.baseRoot, definition.cwd, "cwd");
			} catch (error) {
				errors.push(error instanceof Error ? error.message : String(error));
			}
		}
	}

	let timeoutSeconds: number | undefined;
	if (definition.timeoutSeconds !== undefined) {
		if (
			typeof definition.timeoutSeconds !== "number" ||
			!Number.isFinite(definition.timeoutSeconds) ||
			definition.timeoutSeconds <= 0
		) {
			errors.push("timeoutSeconds must be a positive number.");
		} else {
			timeoutSeconds = definition.timeoutSeconds;
		}
	}

	let promptSnippet: string | undefined;
	if (definition.promptSnippet !== undefined) {
		if (typeof definition.promptSnippet !== "string")
			errors.push("promptSnippet must be a string.");
		else promptSnippet = definition.promptSnippet;
	}

	let promptGuidelines: string[] | undefined;
	if (definition.promptGuidelines !== undefined) {
		if (
			!Array.isArray(definition.promptGuidelines) ||
			!definition.promptGuidelines.every(
				(value): boolean => typeof value === "string",
			)
		) {
			errors.push("promptGuidelines must be an array of strings.");
		} else {
			promptGuidelines = definition.promptGuidelines;
		}
	}

	for (const command of commands) {
		for (const part of command.command) {
			if (typeof part === "string")
				validateInterpolations(part, parameters, errors);
			else {
				const param = part.param;
				if (typeof param === "string" && !parameters.has(param)) {
					errors.push(`command references unknown parameter: ${param}.`);
				}
				for (const arg of part.args as string[])
					validateInterpolations(arg, parameters, errors);
			}
		}
	}

	if (errors.length > 0) return { ok: false, errors };

	return {
		ok: true,
		value: {
			name: tool.name,
			description: definition.description as string,
			promptSnippet,
			promptGuidelines,
			modes,
			commands,
			parallel,
			parameters,
			baseRoot: tool.baseRoot,
			cwd,
			timeoutSeconds,
		},
	};
}

function normalizeCommands(
	toolName: string,
	definition: SettingsToolDefinition,
	errors: string[],
): NormalizedCommand[] {
	const hasCommand = definition.command !== undefined;
	const hasCommands = definition.commands !== undefined;
	if (hasCommand === hasCommands) {
		errors.push("Specify exactly one of command or commands.");
		return [];
	}

	if (hasCommand) {
		const command = normalizeCommandParts(
			definition.command,
			"command",
			errors,
		);
		return command ? [{ name: toolName, command }] : [];
	}

	if (!Array.isArray(definition.commands) || definition.commands.length === 0) {
		errors.push("commands must be a non-empty array.");
		return [];
	}

	const commands: NormalizedCommand[] = [];
	for (const [index, rawCommand] of definition.commands.entries()) {
		if (!isObject(rawCommand)) {
			errors.push(`commands[${index}] must be an object.`);
			continue;
		}
		const commandDefinition = rawCommand as CommandDefinition;
		if (
			typeof commandDefinition.name !== "string" ||
			commandDefinition.name.trim() === ""
		) {
			errors.push(`commands[${index}].name must be a non-empty string.`);
			continue;
		}
		const command = normalizeCommandParts(
			commandDefinition.command,
			`commands[${index}].command`,
			errors,
		);
		if (command) commands.push({ name: commandDefinition.name, command });
	}
	return commands;
}

function normalizeCommandParts(
	value: unknown,
	label: string,
	errors: string[],
): CommandPart[] | undefined {
	if (!Array.isArray(value) || value.length === 0) {
		errors.push(`${label} must be a non-empty array.`);
		return undefined;
	}

	const command = value.filter((part): part is CommandPart => {
		if (typeof part === "string") return true;
		if (
			isObject(part) &&
			typeof part.param === "string" &&
			Array.isArray(part.args) &&
			part.args.every((arg): boolean => typeof arg === "string")
		) {
			return true;
		}
		errors.push(
			`${label} entries must be strings or { param: string, args: string[] }.`,
		);
		return false;
	});
	return command.length > 0 ? command : undefined;
}

function normalizeModes(value: unknown, errors: string[]): ModeName[] {
	if (value === undefined) return [...DEFAULT_MODES];
	if (!Array.isArray(value) || value.length === 0) {
		errors.push("modes must be a non-empty array of read/write/yolo.");
		return [...DEFAULT_MODES];
	}
	const modes: ModeName[] = [];
	for (const mode of value) {
		if (!isModeName(mode)) {
			errors.push(`Invalid mode: ${String(mode)}.`);
			continue;
		}
		if (!modes.includes(mode)) modes.push(mode);
	}
	return modes.length > 0 ? modes : [...DEFAULT_MODES];
}

function normalizeParameters(
	value: unknown,
	errors: string[],
): Map<string, NormalizedParameter> {
	const parameters = new Map<string, NormalizedParameter>();
	if (value === undefined) return parameters;
	if (!isObject(value)) {
		errors.push("parameters must be an object.");
		return parameters;
	}

	for (const [name, rawDefinition] of Object.entries(value)) {
		if (!TOOL_NAME_PATTERN.test(name)) {
			errors.push(`Invalid parameter name: ${name}.`);
			continue;
		}
		if (!isObject(rawDefinition)) {
			errors.push(`Parameter ${name} must be an object.`);
			continue;
		}
		const definition = rawDefinition as ParameterDefinition;
		if (!isParameterType(definition.type)) {
			errors.push(
				`Parameter ${name} has unsupported type: ${String(definition.type)}.`,
			);
			continue;
		}
		if (
			definition.description !== undefined &&
			typeof definition.description !== "string"
		) {
			errors.push(`Parameter ${name} description must be a string.`);
			continue;
		}
		if (
			definition.required !== undefined &&
			typeof definition.required !== "boolean"
		) {
			errors.push(`Parameter ${name} required must be a boolean.`);
			continue;
		}
		parameters.set(name, {
			name,
			type: definition.type,
			description: definition.description,
			required: definition.required === true,
		});
	}
	return parameters;
}

function validateInterpolations(
	arg: string,
	parameters: Map<string, NormalizedParameter>,
	errors: string[],
): void {
	for (const match of arg.matchAll(EMBEDDED_INTERPOLATION_PATTERN)) {
		const name = match[1];
		if (!parameters.has(name))
			errors.push(`command references unknown parameter: ${name}.`);
	}
}

function createParametersSchema(
	parameters: Map<string, NormalizedParameter>,
): TSchema {
	const properties: Record<string, TSchema> = {};
	for (const parameter of parameters.values()) {
		let schema: TSchema;
		switch (parameter.type) {
			case "number":
				schema = Type.Number({ description: parameter.description });
				break;
			case "boolean":
				schema = Type.Boolean({ description: parameter.description });
				break;
			case "string[]":
			case "path[]":
				schema = Type.Array(Type.String(), {
					description: parameter.description,
				});
				break;
			case "number[]":
				schema = Type.Array(Type.Number(), {
					description: parameter.description,
				});
				break;
			case "string":
			case "path":
				schema = Type.String({ description: parameter.description });
				break;
		}
		properties[parameter.name] = parameter.required
			? schema
			: Type.Optional(schema);
	}
	return Type.Object(properties);
}

function expandCommand(
	tool: NormalizedTool,
	command: NormalizedCommand,
	input: ToolInput,
	cwd: string,
): string[] {
	const args: string[] = [];
	for (const part of command.command) {
		if (typeof part === "string") {
			args.push(...expandArg(tool, part, input, cwd));
			continue;
		}

		const param = part.param as string;
		if (input[param] === undefined) continue;
		for (const arg of part.args as string[])
			args.push(...expandArg(tool, arg, input, cwd));
	}
	return args;
}

function expandArg(
	tool: NormalizedTool,
	arg: string,
	input: ToolInput,
	cwd: string,
): string[] {
	const exact = INTERPOLATION_PATTERN.exec(arg);
	if (exact) {
		const name = exact[1];
		const value = input[name];
		if (value === undefined) return [];
		return stringifyValue(tool, name, value, cwd);
	}

	return [
		arg.replace(
			EMBEDDED_INTERPOLATION_PATTERN,
			(_match, name: string): string => {
				const value = input[name];
				if (value === undefined) throw new Error(`Missing parameter: ${name}`);
				const expanded = stringifyValue(tool, name, value, cwd);
				if (expanded.length !== 1) {
					throw new Error(
						`Array parameter ${name} can only be used as a whole argv entry.`,
					);
				}
				return expanded[0];
			},
		),
	];
}

function stringifyValue(
	tool: NormalizedTool,
	name: string,
	value: unknown,
	cwd: string,
): string[] {
	const parameter = tool.parameters.get(name);
	if (!parameter) throw new Error(`Unknown parameter: ${name}`);

	switch (parameter.type) {
		case "string":
			if (typeof value !== "string")
				throw new Error(`${name} must be a string.`);
			return [value];
		case "number":
			if (typeof value !== "number")
				throw new Error(`${name} must be a number.`);
			return [String(value)];
		case "boolean":
			throw new Error(
				`${name} is boolean and cannot be interpolated; use { "param": "${name}", "args": [...] } instead.`,
			);
		case "path":
			if (typeof value !== "string")
				throw new Error(`${name} must be a path string.`);
			return [pathArg(tool.baseRoot, cwd, value, name)];
		case "string[]":
			if (
				!Array.isArray(value) ||
				!value.every((item): boolean => typeof item === "string")
			)
				throw new Error(`${name} must be a string array.`);
			return value;
		case "number[]":
			if (
				!Array.isArray(value) ||
				!value.every((item): boolean => typeof item === "number")
			)
				throw new Error(`${name} must be a number array.`);
			return value.map(String);
		case "path[]":
			if (
				!Array.isArray(value) ||
				!value.every((item): boolean => typeof item === "string")
			)
				throw new Error(`${name} must be a path array.`);
			return value.map((item): string =>
				pathArg(tool.baseRoot, cwd, item, name),
			);
	}
}

async function runSequential<T, TResult>(
	items: readonly T[],
	fn: (item: T) => Promise<TResult>,
): Promise<TResult[]> {
	const results: TResult[] = [];
	let sequence = Promise.resolve();
	for (const item of items) {
		sequence = sequence.then(async (): Promise<void> => {
			results.push(await fn(item));
			return undefined;
		});
	}
	await sequence;
	return results;
}

function formatExitStatus(result: { code: number; killed: boolean }): string {
	const status = result.code === 0 && !result.killed ? "succeeded" : "failed";
	return `Command ${status} (exit code ${result.code}${result.killed ? ", killed" : ""}).`;
}

function formatCommandLine(argv: string[]): string {
	return argv.map(formatShellArg).join(" ");
}

function formatShellArg(arg: string): string {
	if (/^[a-zA-Z0-9_@%+=:,./-]+$/u.test(arg)) return arg;
	return `'${arg.replaceAll("'", "'\\''")}'`;
}

function formatDuration(ms: number): string {
	return `${(ms / 1000).toFixed(1)}s`;
}

function getResultText(result: { content?: unknown }): string {
	if (!Array.isArray(result.content)) return "";
	return result.content
		.map((item): string => {
			if (
				!isObject(item) ||
				item.type !== "text" ||
				typeof item.text !== "string"
			)
				return "";
			return item.text;
		})
		.filter(Boolean)
		.join("\n");
}

function renderCollapsedText(text: string): string {
	const trimmed = text.trimEnd();
	if (!trimmed) return text;
	const lines = trimmed.split("\n");
	const sectionStarts = lines
		.map((line, index): number =>
			line.startsWith("$ ") && line.includes(" ─") ? index : -1,
		)
		.filter((index): boolean => index !== -1);
	if (sectionStarts.length <= 1) return collapseLines(lines);

	return sectionStarts
		.map((start, index): string => {
			const end = sectionStarts[index + 1] ?? lines.length;
			return collapseSection(lines.slice(start, end));
		})
		.join("\n\n");
}

function collapseLines(lines: string[]): string {
	if (lines.length <= PREVIEW_MAX_LINES) return lines.join("\n");
	const skipped = lines.length - PREVIEW_MAX_LINES;
	return [
		`... (${skipped} earlier lines, ${keyHint("app.tools.expand", "to expand")})`,
		...lines.slice(-PREVIEW_MAX_LINES),
	].join("\n");
}

function collapseSection(lines: string[]): string {
	if (lines.length <= PREVIEW_MAX_LINES + 1) return lines.join("\n");
	const header = lines[0];
	const body = lines.slice(1);
	const skipped = body.length - PREVIEW_MAX_LINES;
	return [
		header,
		`... (${skipped} earlier lines, ${keyHint("app.tools.expand", "to expand")})`,
		...body.slice(-PREVIEW_MAX_LINES),
	].join("\n");
}

type CommandState = {
	name: string;
	argv: string[];
	output: string;
	exitCode?: number;
	killed: boolean;
	status: "pending" | "running" | "succeeded" | "failed";
	startedAt?: number;
	endedAt?: number;
	fullOutputFile?: string;
	truncated?: boolean;
};

function createCommandState(name: string, argv: string[]): CommandState {
	return { name, argv, output: "", killed: false, status: "pending" };
}

async function executeCommand(
	state: CommandState,
	options: {
		cwd: string;
		timeout?: number;
		signal?: AbortSignal;
		onUpdate: () => void;
	},
): Promise<CommandState> {
	const [command, ...args] = state.argv;
	state.status = "running";
	state.startedAt = Date.now();
	options.onUpdate();

	const child = spawn(command, args, {
		cwd: options.cwd,
		detached: process.platform !== "win32",
		stdio: ["ignore", "pipe", "pipe"],
		windowsHide: true,
	});

	let timeoutHandle: NodeJS.Timeout | undefined;
	const kill = (): void => {
		state.killed = true;
		if (!child.pid) return;
		try {
			if (process.platform === "win32") child.kill();
			else process.kill(-child.pid, "SIGTERM");
		} catch {
			child.kill();
		}
	};

	try {
		if (options.timeout) timeoutHandle = setTimeout(kill, options.timeout);
		options.signal?.addEventListener("abort", kill, { once: true });
		const append = (chunk: Buffer): void => {
			state.output += chunk.toString("utf8");
			options.onUpdate();
		};
		child.stdout.on("data", append);
		child.stderr.on("data", append);
		const exitCode = await waitForExit(child);
		state.exitCode = exitCode ?? 0;
		state.status =
			state.exitCode === 0 && !state.killed ? "succeeded" : "failed";
		state.endedAt = Date.now();
		const persisted = await persistOutputIfNeeded(state);
		state.fullOutputFile = persisted.fullOutputFile;
		state.truncated = persisted.truncated;
		options.onUpdate();
		return state;
	} finally {
		if (timeoutHandle) clearTimeout(timeoutHandle);
		options.signal?.removeEventListener("abort", kill);
	}
}

function waitForExit(child: ReturnType<typeof spawn>): Promise<number | null> {
	return new Promise((resolveExit, reject): void => {
		child.once("error", reject);
		child.once("close", (code): void => resolveExit(code));
	});
}

async function persistOutputIfNeeded(
	state: CommandState,
): Promise<{ truncated: boolean; fullOutputFile?: string }> {
	const userTruncation = truncateTail(state.output, {
		maxLines: FAILURE_MAX_LINES,
		maxBytes: USER_MAX_BYTES,
	});
	const contextTruncation = truncateTail(state.output, {
		maxLines: DEFAULT_MAX_LINES,
		maxBytes: DEFAULT_MAX_BYTES,
	});
	const shouldPersist =
		userTruncation.truncated ||
		contextTruncation.truncated ||
		(state.status === "failed" && state.output.trim() !== "");
	if (!shouldPersist) return { truncated: false };
	const dir = await mkdtemp(join(tmpdir(), "pi-settings-tool-"));
	const fullOutputFile = join(dir, `${state.name}.txt`);
	await writeFile(fullOutputFile, state.output, "utf8");
	return {
		truncated: userTruncation.truncated || contextTruncation.truncated,
		fullOutputFile,
	};
}

function renderCommandStates(
	states: readonly CommandState[],
	options?: { final?: boolean },
): string {
	if (
		options?.final === true &&
		states.every((state): boolean => state.status === "succeeded")
	) {
		return states
			.map((state): string => `- [x] ${formatCommandLine(state.argv)}`)
			.join("\n");
	}

	const showNames = states.length > 1;
	return states
		.map((state): string =>
			renderCommandState(state, {
				showName: showNames,
				final: options?.final === true,
			}),
		)
		.join("\n\n");
}

function renderCommandState(
	state: CommandState,
	options: { showName: boolean; final: boolean },
): string {
	const maxLines =
		options.final && state.status === "failed"
			? FAILURE_MAX_LINES
			: PREVIEW_MAX_LINES;
	const truncation = truncateTail(state.output, {
		maxLines,
		maxBytes: USER_MAX_BYTES,
	});
	const commandLine = `$ ${formatCommandLine(state.argv)}`;
	const lines: string[] = [];
	if (state.status !== "succeeded" || !options.final) {
		lines.push(truncation.content || "(no output)", "");
	}
	lines.push(formatCommandStateStatus(state));
	if (truncation.truncated) {
		lines.push(
			`Showing last ${truncation.outputLines} of ${truncation.totalLines} lines (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`,
		);
	}
	if (state.fullOutputFile) lines.push(`Full output: ${state.fullOutputFile}`);
	const body = lines.join("\n");
	return options.showName
		? renderSection(commandLine, body)
		: [commandLine, "", body].join("\n");
}

function renderSection(title: string, text: string): string {
	const rule = "─".repeat(Math.max(8, 60 - visibleLength(title)));
	return [`${title} ${rule}`, text].join("\n");
}

function visibleLength(text: string): number {
	return [...text].length;
}

function formatCommandStateStatus(state: CommandState): string {
	if (state.status === "pending") return "Pending.";
	if (state.status === "running") return "Running...";
	return formatExitStatus({ code: state.exitCode ?? 0, killed: state.killed });
}

async function loadConfiguredTools(
	ctx: ExtensionContext,
	onWarning: (message: string) => void,
): Promise<LoadedTool[]> {
	const globalSettings = SettingsManager.create(
		ctx.cwd,
	).getGlobalSettings() as SettingsWithTools;
	const globalTools = collectTools(
		globalSettings,
		"global",
		resolve(ctx.cwd),
		onWarning,
	);

	let projectTools: LoadedTool[] = [];
	try {
		const project = await loadProjectSettings(ctx.cwd);
		if (project) {
			projectTools = collectTools(
				project.settings,
				"project",
				project.baseRoot,
				onWarning,
			);
		}
	} catch (error) {
		onWarning(
			`Failed to load nearest project settings: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	return [...globalTools, ...projectTools];
}

export default function settingsTools(pi: ExtensionAPI): void {
	const registered = new Set<string>();

	pi.on("session_start", async (_event, ctx): Promise<void> => {
		const loadedTools = await loadConfiguredTools(ctx, (message): void => {
			renderWarning(ctx, message);
		});
		const grouped = new Map<string, LoadedTool[]>();
		for (const tool of loadedTools)
			grouped.set(tool.name, [...(grouped.get(tool.name) ?? []), tool]);

		const existingTools = new Set(
			pi
				.getAllTools()
				.filter((tool): boolean => !registered.has(tool.name))
				.filter(
					(tool): boolean => !tool.sourceInfo.path.includes("settings-tools"),
				)
				.map((tool): string => tool.name),
		);

		for (const [name, tools] of grouped) {
			if (tools.length > 1) {
				renderWarning(
					ctx,
					`Tool ${name} is defined multiple times; disabling it.`,
				);
				continue;
			}
			if (existingTools.has(name)) {
				renderWarning(
					ctx,
					`Tool ${name} conflicts with an existing tool; disabling it.`,
				);
				continue;
			}
			if (registered.has(name)) continue;

			const normalized = normalizeTool(tools[0]);
			if (!normalized.ok) {
				renderWarning(
					ctx,
					`Tool ${name} is invalid: ${normalized.errors.join(" ")}`,
				);
				continue;
			}

			const tool = normalized.value;
			pi.registerTool({
				name: tool.name,
				label: tool.name,
				description: tool.description,
				promptSnippet: tool.promptSnippet ?? tool.description,
				promptGuidelines: tool.promptGuidelines,
				parameters: createParametersSchema(tool.parameters),
				renderCall(_args, theme, context) {
					if (
						context.executionStarted &&
						context.state.startedAt === undefined
					) {
						context.state.startedAt = Date.now();
						context.state.endedAt = undefined;
					}
					const text =
						context.lastComponent instanceof Text
							? context.lastComponent
							: new Text("", 0, 0);
					const suffix =
						tool.commands.length > 1
							? ` (${tool.commands.length} commands${tool.parallel ? ", parallel" : ""})`
							: "";
					text.setText(
						theme.fg("toolTitle", theme.bold(tool.name)) +
							theme.fg("muted", suffix),
					);
					return text;
				},
				renderResult(result, options, theme, context) {
					if (!options.isPartial || context.isError)
						context.state.endedAt ??= Date.now();
					const text =
						context.lastComponent instanceof Text
							? context.lastComponent
							: new Text("", 0, 0);
					const body = options.expanded
						? getResultText(result)
						: renderCollapsedText(getResultText(result));
					const startedAt =
						typeof context.state.startedAt === "number"
							? context.state.startedAt
							: undefined;
					const endedAt =
						typeof context.state.endedAt === "number"
							? context.state.endedAt
							: Date.now();
					const duration =
						startedAt === undefined
							? ""
							: `\n\n${theme.fg("muted", `${options.isPartial ? "Elapsed" : "Took"} ${formatDuration(endedAt - startedAt)}`)}`;
					text.setText(`${body}${duration}`);
					return text;
				},
				async execute(_toolCallId, params, signal, onUpdate) {
					const cwd = tool.cwd ?? tool.baseRoot;
					const timeout = tool.timeoutSeconds
						? tool.timeoutSeconds * 1000
						: undefined;
					const executions: { name: string; argv: string[] }[] =
						tool.commands.map(
							(commandDefinition): { name: string; argv: string[] } => {
								const argv = expandCommand(
									tool,
									commandDefinition,
									params as ToolInput,
									cwd,
								);
								if (argv.length === 0)
									throw new Error(
										`${commandDefinition.name} expanded to no argv entries.`,
									);
								return { name: commandDefinition.name, argv };
							},
						);
					const states = executions.map(
						(execution): CommandState =>
							createCommandState(execution.name, execution.argv),
					);
					const emitUpdate = (): void => {
						onUpdate?.({
							content: [{ type: "text", text: renderCommandStates(states) }],
							details: undefined,
						});
					};
					const runCommand = (index: number): Promise<CommandState> =>
						executeCommand(states[index], {
							cwd,
							timeout,
							signal,
							onUpdate: emitUpdate,
						});

					const results = tool.parallel
						? await Promise.all(
								states.map(
									(_state, index): Promise<CommandState> => runCommand(index),
								),
							)
						: await runSequential(
								states.map((_state, index): number => index),
								runCommand,
							);
					const finalText = renderCommandStates(results, { final: true });
					if (results.some((result): boolean => result.status === "failed")) {
						throw new Error(finalText);
					}
					return {
						content: [{ type: "text", text: finalText }],
						details: {
							parallel: tool.parallel,
							cwd,
							commands: results.map(
								(result): Record<string, unknown> => ({
									name: result.name,
									argv: result.argv,
									exitCode: result.exitCode,
									killed: result.killed,
									status: result.status,
									fullOutputFile: result.fullOutputFile,
									truncated: result.truncated,
								}),
							),
						},
					};
				},
			});
			registered.add(name);
			policyRegistry.register<ToolInput>({
				name: tool.name,
				allowedModes: tool.modes,
				notAllowedReason: (mode): string =>
					`${tool.name} is disabled in ${mode} mode.`,
			});
		}
	});
}
