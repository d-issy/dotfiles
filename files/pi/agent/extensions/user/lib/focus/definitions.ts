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
	readonly spawnable?: boolean;
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

/**
 * Whether a focus may be launched as a subagent. Interactive focuses (e.g.
 * `interview`) cannot run headless, so they are excluded unless `spawnable` is
 * explicitly set. Derivation: `spawnable ?? !interactiveOnly` (SPEC §6).
 */
export function isFocusSpawnable(focus: FocusDefinition): boolean {
	return (
		focus.spawnable ??
		(!focus.interactiveOnly && focus.transition !== FOCUS_TRANSITION.MANUAL)
	);
}

export const BUILT_IN_TOOL_SETS: ReadonlyMap<string, readonly string[]> =
	new Map([
		["file_read", ["read_chunk", "grep", "find", "ls"]],
		["file_write", ["write", "edit_chunk", "mv", "rm"]],
		[
			"git_read",
			[
				"git_status",
				"git_diff",
				"git_log",
				"git_show",
				"git_branch",
				"git_ls_files",
				"git_grep",
				"git_blame",
				"github_pull_request_view",
				"github_pull_request_files",
				"github_pull_request_diff",
				"github_compare",
				"github_pull_request_checks",
			],
		],
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
			"You are in edit focus. Make focused file changes with read_chunk/write/edit_chunk/mv/rm. Keep changes minimal.",
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
			"Before asking, use read_chunk, grep, find, or ls when they can answer the question or make the next question sharper. Do not ask the user for information that can be inspected from code or repository state.",
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
		tools: [],
		toolSets: ["git_read"],
		transition: FOCUS_TRANSITION.AUTO,
		color: "accent",
	},
	{
		name: "yolo",
		description:
			"Shell-enabled focus for manual use only. Can read chunks, write, edit chunks, and run shell commands.",
		prompt:
			"You are in yolo focus. Use read_chunk, write, edit_chunk, and bash to inspect and modify files and run shell commands. Avoid exposing secrets or credentials. If a command may print secrets, use a safer command or mask sensitive output. Ask for confirmation for gray-area destructive or privacy-sensitive actions.",
		tools: ["read_chunk", "write", "edit_chunk", "bash"],
		transition: FOCUS_TRANSITION.MANUAL,
		color: "alert",
	},
	{
		name: "pull-request",
		description:
			"Use when creating or updating a pull request. Stages explicit files on a dedicated branch, pushes, and opens or updates a draft PR via gh without low-level git/gh commands.",
		prompt: [
			"You are in pull-request focus. At the start of each turn, inspect the current diff (e.g. with git_diff or github_pull_request_diff) before doing any work, so you act on the real state of changes.",
			"Keep PR body concise: do not include a Changes section (the changed files are visible) or a Verify section (CI checks handle verification). Prefer this focus over the runbook skill for PR creation and updates.",
		].join(" "),
		tools: ["create_pull_request", "update_pull_request"],
		toolSets: ["file_read", "git_read"],
		transition: FOCUS_TRANSITION.CONFIRM,
		color: "accent",
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

export function isTerminatingFocusResult(result: unknown): boolean {
	return (
		typeof result === "object" &&
		result !== null &&
		"terminate" in result &&
		result.terminate === true
	);
}
