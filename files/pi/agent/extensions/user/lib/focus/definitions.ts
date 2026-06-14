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
	readonly pathPolicy?: unknown;
	readonly bashPolicy?: unknown;
	readonly model?: unknown;
	readonly thinkingLevel?: unknown;
};

export type ProjectFocusDefinition = Partial<FocusDefinition> & {
	readonly tools?: readonly string[];
};

export const DEFAULT_FOCUS = "default";
export const FOCUS_STATE_TYPE = "focus-state";
export const FOCUS_REMINDER_TYPE = "focus-reminder";
export const SEARCH_FOCUS_TOOL = "search_focus";
export const ENTER_FOCUS_TOOL = "enter_focus";
export const WILDCARD_TOOL = "*";

export const TRANSITION_TOOL_NAMES = [
	SEARCH_FOCUS_TOOL,
	ENTER_FOCUS_TOOL,
] as const;

export const DEFAULT_FOCUS_TOOLS = [
	SEARCH_FOCUS_TOOL,
	ENTER_FOCUS_TOOL,
] as const;

export const BASE_FOCUS_DEFINITIONS: readonly FocusDefinition[] = [
	{
		name: "inspect",
		description: "Read and search the repository to understand the task.",
		prompt:
			"You are in inspect focus. Read and search the repository to understand the task.",
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
			"Full access focus for manual use only. Can read, edit, and run arbitrary shell commands.",
		prompt:
			"You are in yolo focus. Use the currently active tools to inspect and modify files and run shell commands. Avoid exposing secrets or credentials. If a command may print secrets, use a safer command or mask sensitive output. Ask for confirmation for gray-area destructive or privacy-sensitive actions.",
		tools: [WILDCARD_TOOL],
		transition: "manual",
		color: "alert",
	},
];

export function isFocusTransition(value: unknown): value is FocusTransition {
	return value === "auto" || value === "confirm" || value === "manual";
}
