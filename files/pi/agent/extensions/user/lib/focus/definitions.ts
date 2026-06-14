import type { ColorRole } from "../theme";

export type FocusTransition = "auto" | "confirm" | "manual";
export type FocusName = string;

export type FocusDefinition = {
	readonly name: FocusName;
	readonly description: string;
	readonly prompt: string;
	readonly tools: readonly string[];
	readonly transition: FocusTransition;
	readonly color?: ColorRole;
};

export const DEFAULT_FOCUS = "default";
export const FOCUS_STATE_TYPE = "focus-state";
export const FOCUS_REMINDER_TYPE = "focus-reminder";
export const ENTER_FOCUS_TOOL = "enter_focus";

export const DEFAULT_FOCUS_TOOLS = [ENTER_FOCUS_TOOL] as const;

export const BASE_FOCUS_DEFINITIONS: readonly FocusDefinition[] = [
	{
		name: "explore",
		description: "Read and search the repository to understand the task.",
		prompt:
			"You are in explore focus. Read and search the repository to understand the task.",
		tools: ["read", "grep", "find", "ls"],
		transition: "auto",
		color: "accent",
	},
	{
		name: "edit",
		description: "Make repository file changes using structured file tools.",
		prompt:
			"You are in edit focus. Make focused file changes with read/write/edit/mv/rm. Keep changes minimal.",
		tools: ["read", "grep", "find", "ls", "write", "edit", "mv", "rm"],
		transition: "confirm",
		color: "positive",
	},
	{
		name: "yolo",
		description:
			"Shell-enabled focus for manual use only. Can read, write, edit, and run shell commands.",
		prompt:
			"You are in yolo focus. Use read, write, edit, and bash to inspect and modify files and run shell commands. Avoid exposing secrets or credentials. If a command may print secrets, use a safer command or mask sensitive output. Ask for confirmation for gray-area destructive or privacy-sensitive actions.",
		tools: ["read", "write", "edit", "bash"],
		transition: "manual",
		color: "alert",
	},
];

export function isFocusTransition(value: unknown): value is FocusTransition {
	return value === "auto" || value === "confirm" || value === "manual";
}
