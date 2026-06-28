import type {
	BeforeAgentStartEvent,
	BeforeAgentStartEventResult,
	ExtensionAPI,
	ExtensionHandler,
} from "@earendil-works/pi-coding-agent";
import { type FocusController, buildFocusRestorePrompt } from "./controller";
import {
	EXIT_FOCUS_TOOL,
	FOCUS_REMINDER_TYPE,
	FOCUS_TRANSITION,
	type FocusTransition,
} from "./definitions";
import type { FocusRuntime } from "./runtime";
import type {
	RegisteredSystemReminder,
	SystemReminderPayload,
	SystemReminderRegistry,
} from "../system-reminder";

type ToolInfo = ReturnType<ExtensionAPI["getAllTools"]>[number];
export type FocusReminderDetails = {
	readonly focus?: string;
	readonly queuedFocus?: string;
	readonly transitionId: number;
	readonly reason?: string;
};

function formatFocusList(
	focuses: readonly {
		name: string;
		description: string;
		transition: FocusTransition;
	}[],
): string {
	return focuses
		.map((focus) => {
			const label =
				focus.transition === FOCUS_TRANSITION.CONFIRM
					? `${focus.name} (reason required)`
					: focus.name;
			return `- ${label}: ${focus.description}`;
		})
		.join("\n");
}

function buildFocusSystemPrompt(focus: FocusController): string {
	const focuses = focus.registry.search().map((definition) => ({
		name: definition.name,
		description: definition.description,
		transition: definition.transition,
	}));
	return `[FOCUS]\nUse focuses to solve the user's request.\n\nFocus rules:\n- A focus controls available tools and instructions.\n- Use agent to delegate focus-scoped work.\n- Do not ask the user for information that can be discovered after entering an appropriate focus.\n\nAvailable focuses:\n${formatFocusList(focuses)}`;
}

function formatVisibleToolsList(
	allowedToolNames: ReadonlySet<string>,
	toolSnippets: Record<string, string> | undefined,
): string {
	const lines = [...allowedToolNames]
		.filter((name) => toolSnippets?.[name])
		.map((name) => `- ${name}: ${toolSnippets?.[name]}`);
	return lines.length > 0 ? lines.join("\n") : "(none)";
}

function formatVisibleGuidelines(
	allowedToolNames: ReadonlySet<string>,
): string {
	const guidelines: string[] = [];
	if (
		allowedToolNames.has("bash") &&
		!allowedToolNames.has("grep") &&
		!allowedToolNames.has("find") &&
		!allowedToolNames.has("ls")
	) {
		guidelines.push("Use bash for file operations like ls, rg, find");
	}
	guidelines.push("Be concise in your responses");
	guidelines.push("Show file paths clearly when working with files");
	return guidelines.map((guideline) => `- ${guideline}`).join("\n");
}

function rewritePromptSection(
	prompt: string,
	start: string,
	end: string,
	replacement: string,
): string {
	const startIndex = prompt.indexOf(start);
	if (startIndex === -1) return prompt;
	const contentStart = startIndex + start.length;
	const endIndex = prompt.indexOf(end, contentStart);
	if (endIndex === -1) return prompt;
	return `${prompt.slice(0, contentStart)}${replacement}${prompt.slice(endIndex)}`;
}

function removeSkillsSection(prompt: string): string {
	return prompt.replace(
		/\n\nThe following skills provide specialized instructions for specific tasks\.[\s\S]*?<\/available_skills>/u,
		"",
	);
}

function focusManagementToolNames(): ReadonlySet<string> {
	return new Set([EXIT_FOCUS_TOOL]);
}

function visiblePromptToolNames(
	pi: ExtensionAPI,
	focus: FocusController,
	runtime: FocusRuntime,
): ReadonlySet<string> {
	const allowedToolNames = focus.allowedToolNames(pi, {
		includeManagementTools: runtime.lockedFocusName === undefined,
	});
	if (!runtime.userSelectedFocus && !runtime.lockedFocusName) {
		return allowedToolNames;
	}
	const managementTools = focusManagementToolNames();
	return new Set(
		[...allowedToolNames].filter((name) => !managementTools.has(name)),
	);
}

function rewriteSystemPromptForVisibleTools(
	pi: ExtensionAPI,
	focus: FocusController,
	runtime: FocusRuntime,
	systemPrompt: string,
	toolSnippets: Record<string, string> | undefined,
): string {
	const allowedToolNames = visiblePromptToolNames(pi, focus, runtime);
	let prompt = rewritePromptSection(
		systemPrompt,
		"Available tools:\n",
		"\n\nIn addition to the tools above",
		formatVisibleToolsList(allowedToolNames, toolSnippets),
	);
	prompt = rewritePromptSection(
		prompt,
		"Guidelines:\n",
		"\n\nPi documentation",
		formatVisibleGuidelines(allowedToolNames),
	);
	return allowedToolNames.has("read") ? prompt : removeSkillsSection(prompt);
}

function visibleToolDefinitions(
	pi: ExtensionAPI,
	focus: FocusController,
	runtime: FocusRuntime,
): ToolInfo[] {
	const allowedToolNames = visiblePromptToolNames(pi, focus, runtime);
	return pi.getAllTools().filter((tool) => allowedToolNames.has(tool.name));
}

function formatToolDefinitions(tools: readonly ToolInfo[]): string {
	return JSON.stringify(
		tools.map((tool) => ({
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters,
		})),
		null,
		2,
	);
}

function buildActiveFocusPrompt(
	focus: FocusController,
	runtime: FocusRuntime,
): string | undefined {
	if (!focus.active) return undefined;
	const lockedPrompt = runtime.lockedFocusName
		? [
				`[FOCUS LOCKED: ${runtime.lockedFocusName}]`,
				"This pi process was started with --focus and is dedicated to this focus only.",
				"Do not try to enter, switch, or exit focuses. Continue using only the visible tools for this focus.",
			].join("\n")
		: undefined;
	return [
		`[ACTIVE FOCUS: ${focus.active.name}]`,
		focus.active.prompt,
		lockedPrompt,
	]
		.filter(Boolean)
		.join("\n");
}

function buildFocusReminderPayloadWithTools(
	pi: ExtensionAPI,
	focus: FocusController,
	runtime: FocusRuntime,
): SystemReminderPayload<FocusReminderDetails> {
	const tools = visibleToolDefinitions(pi, focus, runtime);
	const activePrompt = buildActiveFocusPrompt(focus, runtime);
	const focusInstructions = activePrompt
		? `Focus instructions:\n${activePrompt}`
		: `Focus routing instructions:\n${buildFocusSystemPrompt(focus)}`;
	const headline = activePrompt
		? `Current focus: ${focus.current}. Follow the focus instructions.`
		: [
				"No focus is active.",
				"Previous focus instructions and tool definitions are no longer active.",
				"Use only the tool definitions in this latest reminder.",
				"If focus-scoped tools are needed, use agent.",
			].join("\n");
	return {
		content: [
			headline,
			"",
			focusInstructions,
			"",
			"Available tool definitions:",
			"```json",
			formatToolDefinitions(tools),
			"```",
		].join("\n"),
		details: {
			focus: focus.current,
			transitionId: runtime.latestTransition.id,
		},
	};
}

export const injectFocusRestorePrompt =
	(
		pi: ExtensionAPI,
		focus: FocusController,
		runtime: FocusRuntime,
	): ExtensionHandler<BeforeAgentStartEvent, BeforeAgentStartEventResult> =>
	async (event) => {
		const systemPrompt = rewriteSystemPromptForVisibleTools(
			pi,
			focus,
			runtime,
			event.systemPrompt,
			event.systemPromptOptions.toolSnippets,
		);
		if (!focus.active) {
			return {
				systemPrompt: `${systemPrompt}\n\n${buildFocusSystemPrompt(focus)}`,
			};
		}
		if (runtime.restorePromptPending) {
			runtime.setRestorePromptPending(false);
			return {
				systemPrompt: `${systemPrompt}\n\n${buildFocusRestorePrompt(focus.active)}`,
			};
		}
		const activePrompt = buildActiveFocusPrompt(focus, runtime);
		return activePrompt
			? { systemPrompt: `${systemPrompt}\n\n${activePrompt}` }
			: systemPrompt === event.systemPrompt
				? undefined
				: { systemPrompt };
	};

function transitionIdFromDetails(details: unknown): number | undefined {
	if (typeof details !== "object" || details === null) return undefined;
	if (!("transitionId" in details)) return undefined;
	return typeof details.transitionId === "number"
		? details.transitionId
		: undefined;
}

export function registerFocusReminderSource(
	pi: ExtensionAPI,
	focus: FocusController,
	runtime: FocusRuntime,
	reminders: SystemReminderRegistry,
): RegisteredSystemReminder<FocusReminderDetails> {
	return reminders.register<FocusReminderDetails>({
		customType: FOCUS_REMINDER_TYPE,
		consumePending: () => runtime.consumeFocusReminderPending(),
		isCurrent: (details) =>
			runtime.isCurrentTransition(transitionIdFromDetails(details)),
		buildReminder: () => buildFocusReminderPayloadWithTools(pi, focus, runtime),
	});
}
