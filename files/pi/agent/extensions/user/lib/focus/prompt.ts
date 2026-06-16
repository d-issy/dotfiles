import type {
	BeforeAgentStartEvent,
	BeforeAgentStartEventResult,
	ExtensionAPI,
	ExtensionHandler,
} from "@earendil-works/pi-coding-agent";
import { type FocusController, buildFocusRestorePrompt } from "./controller";
import {
	ENTER_FOCUS_TOOL,
	EXIT_FOCUS_TOOL,
	FOCUS_REMINDER_TYPE,
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
	focuses: readonly { name: string; description: string }[],
): string {
	return focuses
		.map((focus) => `- ${focus.name}: ${focus.description}`)
		.join("\n");
}

function buildFocusSystemPrompt(focus: FocusController): string {
	const focuses = focus.registry.search().map((definition) => ({
		name: definition.name,
		description: definition.description,
	}));
	return `[FOCUS]\nUse focuses to solve the user's request.\n\nFocus rules:\n- A focus is an operational mode that controls available tools and instructions.\n- Use the descriptions below to choose when to enter each focus.\n- Enter the appropriate focus before doing substantive work.\n- Auto focuses may be entered without asking the user.\n- Do not ask the user for information that can be discovered after entering an appropriate focus.\n- If a needed capability is not visible, first check whether another available focus exposes it.\n\nAvailable focuses:\n${formatFocusList(focuses)}`;
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
	return new Set([ENTER_FOCUS_TOOL, EXIT_FOCUS_TOOL]);
}

function visiblePromptToolNames(
	pi: ExtensionAPI,
	focus: FocusController,
	runtime: FocusRuntime,
): ReadonlySet<string> {
	const allowedToolNames = focus.allowedToolNames(pi);
	if (!runtime.userSelectedFocus) return allowedToolNames;
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

function buildActiveFocusPrompt(focus: FocusController): string | undefined {
	return focus.active
		? `[ACTIVE FOCUS: ${focus.active.name}]\n${focus.active.prompt}`
		: undefined;
}

function buildFocusReminderPayloadWithTools(
	pi: ExtensionAPI,
	focus: FocusController,
	runtime: FocusRuntime,
): SystemReminderPayload<FocusReminderDetails> {
	const tools = visibleToolDefinitions(pi, focus, runtime);
	const activePrompt = buildActiveFocusPrompt(focus);
	const focusInstructions = activePrompt
		? `Focus instructions:\n${activePrompt}`
		: `Focus routing instructions:\n${buildFocusSystemPrompt(focus)}`;
	return {
		content: [
			`Current focus: ${focus.current}. Follow the focus instructions.`,
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
		const activePrompt = buildActiveFocusPrompt(focus);
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
