import type { ColorRole } from "../theme";

export const FOCUS_TRANSITION = {
	AUTO: "auto",
	CONFIRM: "confirm",
	MANUAL: "manual",
} as const;
export type FocusTransition =
	(typeof FOCUS_TRANSITION)[keyof typeof FOCUS_TRANSITION];
export const FOCUS_EXIT_MODE = {
	SINGLE_TURN: "single-turn",
	EXPLICIT: "explicit",
} as const;
export type FocusExitMode =
	(typeof FOCUS_EXIT_MODE)[keyof typeof FOCUS_EXIT_MODE];
export type FocusName = string;

export type FocusDefinition = {
	readonly name: FocusName;
	readonly description: string;
	readonly prompt: string;
	readonly exitPrompt?: string;
	readonly tools: readonly string[];
	readonly toolSets?: readonly string[];
	readonly settingsTools?: readonly string[];
	readonly transition: FocusTransition;
	readonly exitMode?: FocusExitMode;
	readonly interactiveOnly?: boolean;
	readonly color?: ColorRole;
};

export const BASE_FOCUS = "base";
export const FOCUS_STATE_TYPE = "focus-state";
export const FOCUS_REMINDER_TYPE = "focus-reminder";
export const ENTER_FOCUS_TOOL = "enter_focus";
export const EXIT_FOCUS_TOOL = "exit_focus";

export function getFocusExitMode(focus: FocusDefinition): FocusExitMode {
	return focus.exitMode ?? FOCUS_EXIT_MODE.SINGLE_TURN;
}

export const BUILT_IN_TOOL_SETS: ReadonlyMap<string, readonly string[]> =
	new Map([
		["file_read", ["read", "grep", "find", "ls"]],
		["file_write", ["write", "edit", "mv", "rm"]],
	]);

export const BASE_FOCUS_DEFINITIONS: readonly FocusDefinition[] = [
	{
		name: "explore",
		description:
			"Use when the task requires reading or searching the repository to understand requirements, inspect files, or answer questions without modifying files.",
		prompt:
			"You are in explore focus. Read and search the repository to understand the task.",
		tools: [],
		toolSets: ["file_read"],
		transition: FOCUS_TRANSITION.AUTO,
		color: "accent",
	},
	{
		name: "edit",
		description:
			"Use when the user asks for repository file changes, or after investigation establishes that file changes are needed.",
		prompt:
			"You are in edit focus. Make focused file changes with read/write/edit/mv/rm. Keep changes minimal.",
		tools: [],
		toolSets: ["file_read", "file_write"],
		transition: FOCUS_TRANSITION.CONFIRM,
		color: "positive",
	},
	{
		name: "interview",
		description:
			"Use when requirements are unclear or incomplete and structured interviewing is needed before proceeding.",
		prompt: [
			"You are in interview focus. Clarify the user's real requirements by understanding their goals, background, pain points, constraints, and success criteria before proceeding.",
			"Do not enter edit focus while requirements are unclear. Treat implementation feasibility and requirement clarity as separate things.",
			"Before asking, use read, grep, find, or ls when they can answer the question or make the next question sharper. Do not ask the user for information that can be inspected from code or repository state.",
			"When requirements remain unclear, send a brief normal message summarizing the current understanding, then in the same turn call ask_user_question. Do not stop after the message. Continue this short-message plus ask_user_question loop until the user's intent is clear.",
			"Use ask_user_question for clarification instead of asking free-form questions in normal chat. Use normal chat only for the brief summary immediately before the structured question, or when the user explicitly asks for discussion instead of answering the question.",
			"Keep ask_user_question question text focused on the question itself, put rationale in the reason field, and do not stuff long summaries into the question.",
			"When requirements are clear and the user asks to leave interview focus, call exit_focus.",
			"Prefer high-value questions that reduce specific uncertainty. Early in the interview, focus on why the user is asking, what is not working, and what would count as a good outcome instead of prematurely asking about implementation tactics or tool categories.",
			"Treat prior answers, Other responses, corrections, objections, and criticism as strong signals. Update the interview direction immediately, discard stale assumptions, and never treat unconfirmed guesses as settled requirements.",
			"When the requirements are clear and the user has approved proceeding, use exit_focus with a concise reason. Do not end with only a normal message.",
		].join(" "),
		exitPrompt:
			"Interview focus has ended. Continue from the agreed requirements instead of stopping. If the user approved implementation, enter the appropriate implementation focus and proceed; otherwise follow the agreed next action.",
		tools: ["ask_user_question"],
		toolSets: ["file_read"],
		transition: FOCUS_TRANSITION.AUTO,
		exitMode: FOCUS_EXIT_MODE.EXPLICIT,
		interactiveOnly: true,
		color: "accent",
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
		transition: FOCUS_TRANSITION.AUTO,
		color: "accent",
	},
	{
		name: "yolo",
		description:
			"Shell-enabled focus for manual use only. Can read, write, edit, and run shell commands.",
		prompt:
			"You are in yolo focus. Use read, write, edit, and bash to inspect and modify files and run shell commands. Avoid exposing secrets or credentials. If a command may print secrets, use a safer command or mask sensitive output. Ask for confirmation for gray-area destructive or privacy-sensitive actions.",
		tools: ["read", "write", "edit", "bash"],
		transition: FOCUS_TRANSITION.MANUAL,
		color: "alert",
	},
];

export function isFocusTransition(value: unknown): value is FocusTransition {
	return (
		value === FOCUS_TRANSITION.AUTO ||
		value === FOCUS_TRANSITION.CONFIRM ||
		value === FOCUS_TRANSITION.MANUAL
	);
}

export function isFocusExitMode(value: unknown): value is FocusExitMode {
	return (
		value === FOCUS_EXIT_MODE.SINGLE_TURN || value === FOCUS_EXIT_MODE.EXPLICIT
	);
}
