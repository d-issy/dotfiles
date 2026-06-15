import type { ColorRole } from "../theme";

export type FocusTransition = "auto" | "confirm" | "manual";
export type FocusName = string;

export type FocusDefinition = {
	readonly name: FocusName;
	readonly description: string;
	readonly prompt: string;
	readonly tools: readonly string[];
	readonly settingsTools?: readonly string[];
	readonly transition: FocusTransition;
	readonly color?: ColorRole;
};

export const BASE_FOCUS = "base";
export const FOCUS_STATE_TYPE = "focus-state";
export const FOCUS_REMINDER_TYPE = "focus-reminder";
export const ENTER_FOCUS_TOOL = "enter_focus";

export const BASE_FOCUS_TOOLS = [ENTER_FOCUS_TOOL] as const;

export const BASE_FOCUS_DEFINITIONS: readonly FocusDefinition[] = [
	{
		name: "explore",
		description:
			"Use when the task requires reading or searching the repository to understand requirements, inspect files, or answer questions without modifying files.",
		prompt:
			"You are in explore focus. Read and search the repository to understand the task.",
		tools: ["read", "grep", "find", "ls"],
		transition: "auto",
		color: "accent",
	},
	{
		name: "edit",
		description:
			"Use when the user asks for repository file changes, or after investigation establishes that file changes are needed.",
		prompt:
			"You are in edit focus. Make focused file changes with read/write/edit/mv/rm. Keep changes minimal.",
		tools: ["read", "grep", "find", "ls", "write", "edit", "mv", "rm"],
		transition: "confirm",
		color: "positive",
	},
	{
		name: "git-read",
		description:
			"Use when the task requires read-only git/GitHub inspection such as status, diffs, history, branches, tracked files, grep matches, blame, pull requests, GitHub compares, or CI checks.",
		prompt:
			"You are in git-read focus. Use only read-only git and GitHub tools to inspect repository state, diffs, history, branches, tracked files, grep matches, blame, pull requests, GitHub compares, and CI checks. Prefer narrow parameters such as paths, mode, maxFiles, maxPatchBytes, include* flags, and check state filters to keep context small. Do not modify the worktree, index, branches, remotes, GitHub state, or git configuration. Do not use checkout, switch, reset, restore, add, commit, push, pull, fetch, merge, rebase, stash, clean, tag, branch creation/deletion, gh edit/merge/close/comment, or config-changing commands.",
		tools: [
			"git_status",
			"git_diff",
			"git_log",
			"git_show",
			"git_branch",
			"git_ls_files",
			"git_grep",
			"git_blame",
			"github_pr_view",
			"github_pr_files",
			"github_pr_diff",
			"github_compare",
			"github_pr_checks",
		],
		transition: "auto",
		color: "accent",
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
