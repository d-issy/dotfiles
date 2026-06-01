import type { ModeName } from "../policy";
import type { ColorRole } from "../theme";

export type { ModeName } from "../policy";

export type Mode = {
	name: ModeName;
	description: string;
	color: ColorRole;
	systemPrompt?: string;
};

export const MODE_DEFINITIONS: readonly Mode[] = [
	{
		name: "read",
		description: "Default read-only mode.",
		color: "accent",
		systemPrompt:
			"You are in read mode. Use the currently active tools to inspect the repository, summarize findings, and propose plans. You may use active tools. Do not modify files or run arbitrary shell commands. If the task requires changes or command execution that is not exposed as an active tool, ask the user to switch to write or yolo mode.",
	},
	{
		name: "write",
		description: "Read and write files, but no arbitrary command execution.",
		color: "positive",
		systemPrompt:
			"You are in write mode. Inspect and modify files using the currently active tools. You may use active tools. Do not run arbitrary shell commands. If the task requires command execution that is not exposed as an active tool, tell the user which command to run or ask them to switch to yolo mode.",
	},
	{
		name: "yolo",
		description: "Read, write, edit, and run shell commands.",
		color: "alert",
		systemPrompt:
			"You are in yolo mode. Use the currently active tools to inspect and modify files and run shell commands. You may use active tools, including arbitrary shell command execution when available. If a requested action matches an active tool, call that tool rather than saying it is unavailable. However, avoid exposing secrets or credentials in the conversation context. If a command may print secrets, prefer a safer command or mask sensitive output. If an action is in a gray area for safety, privacy, or destructive impact, ask the user for confirmation before proceeding.",
	},
];

export const DEFAULT_MODE: ModeName = "read";
export const MODE_STATE_TYPE = "mode";
const MODES = new Map(MODE_DEFINITIONS.map((mode) => [mode.name, mode]));
export const MODE_NAMES = MODE_DEFINITIONS.map((mode) => mode.name);

export function isModeName(value: string): value is ModeName {
	return MODES.has(value as ModeName);
}

export function normalizeModeName(value: unknown): ModeName | undefined {
	if (typeof value !== "string") return undefined;
	if (value === "explore") return "read";
	if (isModeName(value)) return value;
	return undefined;
}

export function getMode(value: ModeName): Mode {
	const mode = MODES.get(value);
	if (!mode) throw new Error(`Unknown mode: ${value}`);
	return mode;
}

export function getNextMode(currentMode: ModeName): ModeName {
	const currentIndex = MODE_NAMES.indexOf(currentMode);
	return MODE_NAMES[(currentIndex + 1) % MODE_NAMES.length];
}
