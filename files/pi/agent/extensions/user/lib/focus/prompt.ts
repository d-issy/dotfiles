import type {
	BeforeAgentStartEvent,
	BeforeAgentStartEventResult,
	ContextEvent,
	ExtensionAPI,
	ExtensionHandler,
} from "@earendil-works/pi-coding-agent";
import {
	type FocusController,
	buildFocusRestorePrompt,
	isFocusReminderMessage,
} from "./controller";
import { FOCUS_REMINDER_TYPE } from "./definitions";
import type { FocusRuntime } from "./runtime";

type ContextResult = { messages?: ContextEvent["messages"] };
type ToolInfo = ReturnType<ExtensionAPI["getAllTools"]>[number];
type FocusReminderWithTools = {
	customType: typeof FOCUS_REMINDER_TYPE;
	content: string;
	display: false;
	details: { focus: string };
};

function formatFocusList(
	focuses: readonly { name: string; description: string }[],
): string {
	return focuses
		.map((focus) => `- ${focus.name}: ${focus.description}`)
		.join("\n");
}

function buildDefaultFocusPrompt(focus: FocusController): string {
	const focuses = focus.registry.search().map((definition) => ({
		name: definition.name,
		description: definition.description,
	}));
	return `[DEFAULT FOCUS]\nYou are in default focus. This is a routing state, not a work mode. Use enter_focus to enter one.\n\nRouting rules:\n- Select the best matching focus from Available focuses using its description.\n- If the user's request matches an available focus, enter that focus before doing the work.\n- Auto focuses may be entered without asking the user.\n- Do not claim tools are unavailable while an available focus would expose the needed tools.\n\nAvailable focuses:\n${formatFocusList(focuses)}`;
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

function rewriteSystemPromptForVisibleTools(
	pi: ExtensionAPI,
	focus: FocusController,
	systemPrompt: string,
	toolSnippets: Record<string, string> | undefined,
): string {
	const allowedToolNames = focus.allowedToolNames(pi);
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
): ToolInfo[] {
	const allowedToolNames = focus.allowedToolNames(pi);
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

function buildFocusReminderPayloadWithTools(
	pi: ExtensionAPI,
	focus: FocusController,
): FocusReminderWithTools | undefined {
	if (!focus.active) return undefined;
	const tools = visibleToolDefinitions(pi, focus);
	return {
		customType: FOCUS_REMINDER_TYPE,
		content: `<system-reminder>\nCurrent focus: ${focus.active.name}. Follow the focus instructions already provided.\n\nAvailable tool definitions:\n\`\`\`json\n${formatToolDefinitions(tools)}\n\`\`\`\n</system-reminder>`,
		display: false,
		details: { focus: focus.active.name },
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
			event.systemPrompt,
			event.systemPromptOptions.toolSnippets,
		);
		if (!focus.active) {
			return {
				systemPrompt: `${systemPrompt}\n\n${buildDefaultFocusPrompt(focus)}`,
			};
		}
		if (!runtime.restorePromptPending) {
			return systemPrompt === event.systemPrompt ? undefined : { systemPrompt };
		}
		runtime.restorePromptPending = false;
		return {
			systemPrompt: `${systemPrompt}\n\n${buildFocusRestorePrompt(focus.active)}`,
		};
	};

export const injectFocusReminder =
	(
		pi: ExtensionAPI,
		focus: FocusController,
	): ExtensionHandler<ContextEvent, ContextResult> =>
	async (event) => {
		const messages = event.messages.filter(
			(message) => !isFocusReminderMessage(message),
		);
		if (!focus.active) {
			return messages.length === event.messages.length
				? undefined
				: { messages };
		}
		const reminder = buildFocusReminderPayloadWithTools(pi, focus);
		if (!reminder) return;
		return {
			messages: [
				...messages,
				{
					role: "custom",
					...reminder,
					timestamp: Date.now(),
				},
			],
		};
	};
