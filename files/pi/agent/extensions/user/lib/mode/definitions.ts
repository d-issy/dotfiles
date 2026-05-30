import type { ModeName } from "../policy";
import type { ColorName } from "../theme";

export type { ModeName } from "../policy";

export type Mode = {
	name: ModeName;
	description: string;
	color: ColorName;
	systemPrompt?: string;
};

export const MODE_DEFINITIONS: readonly Mode[] = [
	{
		name: "read",
		description: "Default read-only mode.",
		color: "blue",
		systemPrompt:
			"You are in read mode. Use the currently active tools to inspect the repository, summarize findings, and propose plans. If the task requires changes or command execution, ask the user to switch to write or yolo mode.",
	},
	{
		name: "write",
		description: "Read and write files, but no command execution.",
		color: "green",
		systemPrompt:
			"You are in write mode. Inspect and modify files using the currently active tools. If the task requires command execution (tests, formatting, git, package managers, etc.), tell the user which command to run or ask them to switch to yolo mode.",
	},
	{
		name: "yolo",
		description: "Read, write, edit, and run shell commands.",
		color: "red",
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
