import type {
	AgentEndEvent,
	BeforeAgentStartEvent,
	BeforeAgentStartEventResult,
	BeforeProviderRequestEvent,
	ContextEvent,
	ExtensionAPI,
	ExtensionContext,
	ExtensionHandler,
	SessionBeforeSwitchEvent,
	SessionStartEvent,
	Theme,
	ToolCallEvent,
	ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { Feature } from "../feature";
import {
	DEFAULT_FOCUS,
	ENTER_FOCUS_TOOL,
	FOCUS_REMINDER_TYPE,
	FOCUS_STATE_TYPE,
	type FocusController,
	SEARCH_FOCUS_TOOL,
	buildFocusRestorePrompt,
	createFocusController,
	findPersistedFocus,
	isFocusReminderMessage,
	registerBuiltInFocusPolicies,
	showFocusSelector,
} from "../lib/focus";
import { policyRegistry } from "../lib/policy";
import { ensureProjectUserSettingsTrusted } from "../lib/project-settings";

type ContextResult = { messages?: ContextEvent["messages"] };
type SessionBeforeSwitchResult = { cancel?: boolean };
type BlockedToolCall = { block: true; reason: string };
type FocusToolDetails = Record<string, unknown>;
type FocusReminderWithTools = {
	customType: typeof FOCUS_REMINDER_TYPE;
	content: string;
	display: false;
	details: { focus: string };
};

type FocusQuickAction = (ctx: ExtensionContext) => Promise<void>;

let focusQuickAction: FocusQuickAction | undefined;
let restorePromptPending = false;
let resetFocusAtAgentEndPending = false;

function block(reason: string): BlockedToolCall {
	return { block: true, reason };
}

function formatFocusList(
	focuses: readonly { name: string; description: string }[],
): string {
	return focuses
		.map((focus) => `- ${focus.name}: ${focus.description}`)
		.join("\n");
}

function formatFocusSearchResult(
	matches: readonly { name: string; description: string }[],
	fallbacks: readonly { name: string; description: string }[],
	query: string | undefined,
): string {
	if (matches.length > 0) return formatFocusList(matches);
	const normalized = query?.trim();
	if (!normalized) return "No available focus found.";
	return `No focus matched query '${normalized}'. Available focuses:\n${formatFocusList(fallbacks)}`;
}

function formatToolArg(value: string | undefined, fallback = "<none>"): string {
	const normalized = value?.trim();
	return normalized ? JSON.stringify(normalized) : fallback;
}

function renderSearchFocusCall(args: { query?: string }, theme: Theme): Text {
	let text = theme.fg("toolTitle", theme.bold(SEARCH_FOCUS_TOOL));
	text += theme.fg("muted", ` query=${formatToolArg(args.query, "*")}`);
	return new Text(text, 0, 0);
}

function renderEnterFocusCall(
	args: { name: string; reason: string },
	theme: Theme,
): Text {
	let text = theme.fg("toolTitle", theme.bold(ENTER_FOCUS_TOOL));
	text += theme.fg("muted", ` name=${formatToolArg(args.name)}`);
	text += theme.fg("muted", ` reason=${formatToolArg(args.reason)}`);
	return new Text(text, 0, 0);
}

type PayloadRecord = Record<string, unknown>;
type ToolInfo = ReturnType<ExtensionAPI["getAllTools"]>[number];

function isRecord(value: unknown): value is PayloadRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function payloadToolName(value: unknown): string | undefined {
	if (!isRecord(value)) return undefined;
	if (typeof value.name === "string") return value.name;
	if (isRecord(value.function) && typeof value.function.name === "string") {
		return value.function.name;
	}
	return undefined;
}

function filterPayloadTool(
	tool: unknown,
	allowedToolNames: ReadonlySet<string>,
): unknown | undefined {
	if (!isRecord(tool)) {
		return tool;
	}
	if (Array.isArray(tool.functionDeclarations)) {
		const functionDeclarations = tool.functionDeclarations.filter(
			(declaration) => {
				const name = payloadToolName(declaration);
				return name ? allowedToolNames.has(name) : true;
			},
		);
		if (functionDeclarations.length === 0) return undefined;
		return { ...tool, functionDeclarations };
	}
	const name = payloadToolName(tool);
	return name && !allowedToolNames.has(name) ? undefined : tool;
}

function filterPayloadToolArray(
	tools: readonly unknown[],
	allowedToolNames: ReadonlySet<string>,
): unknown[] {
	return tools
		.map((tool) => filterPayloadTool(tool, allowedToolNames))
		.filter((tool) => tool !== undefined);
}

function filterProviderPayloadTools(
	payload: unknown,
	allowedToolNames: ReadonlySet<string>,
): unknown {
	if (Array.isArray(payload)) {
		return payload.map((value) =>
			filterProviderPayloadTools(value, allowedToolNames),
		);
	}
	if (!isRecord(payload)) return payload;

	const next: PayloadRecord = {};
	for (const [key, value] of Object.entries(payload)) {
		if (key === "tools" && Array.isArray(value)) {
			const tools = filterPayloadToolArray(value, allowedToolNames);
			if (tools.length > 0) next[key] = tools;
			continue;
		}
		next[key] = filterProviderPayloadTools(value, allowedToolNames);
	}
	if (!("tools" in next)) delete next.toolConfig;
	return next;
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
		content: `<system-reminder>\nCurrent focus: ${focus.active.name}. Follow the focus instructions already provided. Only the tools listed below are visible and available in this focus. You may use enter_focus to switch to another non-manual focus when the user explicitly asks for it.\n\nAvailable tool definitions:\n\`\`\`json\n${formatToolDefinitions(tools)}\n\`\`\`\n</system-reminder>`,
		display: false,
		details: { focus: focus.active.name },
	};
}

function registerSearchFocusTool(
	pi: ExtensionAPI,
	focus: FocusController,
): void {
	pi.registerTool({
		name: SEARCH_FOCUS_TOOL,
		label: "search_focus",
		description:
			"Search predefined focuses by name or description. Manual-only focuses are hidden.",
		parameters: Type.Object({
			query: Type.Optional(
				Type.String({ description: "Optional search query." }),
			),
		}),
		renderCall: renderSearchFocusCall,
		execute: async (_toolCallId, params) => {
			if (focus.current !== DEFAULT_FOCUS) {
				return {
					content: [
						{
							type: "text" as const,
							text: "search_focus is only available from default focus.",
						},
					],
					details: { ok: false, reason: "not-default" } as FocusToolDetails,
				};
			}
			const matches = focus.registry.search(params.query).map((definition) => ({
				name: definition.name,
				description: definition.description,
			}));
			const available = focus.registry.search().map((definition) => ({
				name: definition.name,
				description: definition.description,
			}));
			return {
				content: [
					{
						type: "text" as const,
						text: formatFocusSearchResult(matches, available, params.query),
					},
				],
				details: {
					ok: true,
					focuses: matches,
					availableFocuses: matches.length === 0 ? available : undefined,
				} as FocusToolDetails,
			};
		},
	});
}

function registerEnterFocusTool(
	pi: ExtensionAPI,
	focus: FocusController,
): void {
	pi.registerTool({
		name: ENTER_FOCUS_TOOL,
		label: "enter_focus",
		description:
			"Enter or switch to a predefined non-manual focus. Manual-only focuses cannot be entered by AI.",
		parameters: Type.Object({
			name: Type.String({ description: "Focus name to enter." }),
			reason: Type.String({ description: "Why this focus is appropriate." }),
		}),
		renderCall: renderEnterFocusCall,
		execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
			const previousFocusName = focus.current;
			const definition = focus.registry.get(params.name);
			if (!definition) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Unknown focus '${params.name}'. Use search_focus to find available focuses.`,
						},
					],
					details: { ok: false, reason: "unknown-focus" } as FocusToolDetails,
				};
			}

			if (previousFocusName === definition.name) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Already in focus '${definition.name}'.`,
						},
					],
					details: { ok: true, focus: definition.name } as FocusToolDetails,
				};
			}

			if (definition.transition === "manual") {
				return {
					content: [
						{
							type: "text" as const,
							text: `Focus '${definition.name}' is manual-only and must be entered by the user from Quick Actions.`,
						},
					],
					details: { ok: false, reason: "manual-only" } as FocusToolDetails,
				};
			}

			if (definition.transition === "confirm") {
				if (!ctx.hasUI) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Focus '${definition.name}' requires user confirmation, but UI is unavailable.`,
							},
						],
						details: {
							ok: false,
							reason: "confirmation-unavailable",
						} as FocusToolDetails,
					};
				}
				const confirmed = await ctx.ui.confirm(
					`Enter focus: ${definition.name}`,
					`${definition.description}\n\nReason: ${params.reason}`,
				);
				if (!confirmed) {
					return {
						content: [
							{
								type: "text" as const,
								text: `User declined entering focus '${definition.name}'.`,
							},
						],
						details: { ok: false, reason: "declined" } as FocusToolDetails,
					};
				}
			}

			resetFocusAtAgentEndPending = true;
			const entered = focus.enter(ctx, definition.name);
			const action =
				previousFocusName === DEFAULT_FOCUS
					? `Entered focus '${entered.name}'.`
					: `Switched focus from '${previousFocusName}' to '${entered.name}'.`;
			return {
				content: [
					{
						type: "text" as const,
						text: `${action}\n\n${entered.prompt}`,
					},
				],
				details: {
					ok: true,
					focus: entered.name,
					previous:
						previousFocusName === DEFAULT_FOCUS ? undefined : previousFocusName,
				} as FocusToolDetails,
			};
		},
	});
}

const injectFocusRestorePrompt =
	(
		pi: ExtensionAPI,
		focus: FocusController,
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
				systemPrompt: `${systemPrompt}\n\n[DEFAULT FOCUS]\nYou are in default focus. Do not attempt repository work here. Use search_focus when you need to discover an appropriate focus, then use enter_focus with a reason before doing work.`,
			};
		}
		if (!restorePromptPending) {
			return systemPrompt === event.systemPrompt ? undefined : { systemPrompt };
		}
		restorePromptPending = false;
		return {
			systemPrompt: `${systemPrompt}\n\n${buildFocusRestorePrompt(focus.active)}`,
		};
	};

const injectFocusReminder =
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

const filterProviderTools =
	(
		pi: ExtensionAPI,
		focus: FocusController,
	): ExtensionHandler<BeforeProviderRequestEvent, unknown> =>
	async (event) =>
		filterProviderPayloadTools(event.payload, focus.allowedToolNames(pi));

const persistFocusBeforeNew =
	(
		pi: ExtensionAPI,
		focus: FocusController,
	): ExtensionHandler<SessionBeforeSwitchEvent, SessionBeforeSwitchResult> =>
	async (event) => {
		if (event.reason !== "new") return;
		pi.appendEntry(FOCUS_STATE_TYPE, { focus: focus.current });
	};

const restoreFocus =
	(focus: FocusController): ExtensionHandler<SessionStartEvent> =>
	async (_event, ctx) => {
		await ensureProjectUserSettingsTrusted(ctx);
		focus.loadProjectFocuses(ctx);
		const persisted = findPersistedFocus(ctx);
		focus.restore(ctx, persisted);
		restorePromptPending = focus.active !== undefined;
		resetFocusAtAgentEndPending = false;
	};

const resetFocusAtAgentEnd =
	(focus: FocusController): ExtensionHandler<AgentEndEvent> =>
	async (_event, ctx) => {
		if (!focus.active || !resetFocusAtAgentEndPending) return;
		focus.leave(ctx);
		restorePromptPending = false;
		resetFocusAtAgentEndPending = false;
	};

const guardToolCall =
	(
		pi: ExtensionAPI,
		focus: FocusController,
	): ExtensionHandler<ToolCallEvent, ToolCallEventResult> =>
	async (event) => {
		const notAllowed = policyRegistry.checkToolAllowed(
			focus.current,
			focus.allowedToolNames(pi),
			event,
		);
		if (notAllowed) return block(notAllowed);

		const secret = policyRegistry.checkSecretBlock(focus.current, event);
		if (secret) return block(secret);
	};

const openFocusQuickAction =
	(focus: FocusController) =>
	async (ctx: ExtensionContext): Promise<void> => {
		const selected = await showFocusSelector(
			ctx,
			focus.registry,
			focus.current,
		);
		if (!selected) return;
		resetFocusAtAgentEndPending = false;
		if (selected === DEFAULT_FOCUS) {
			focus.leave(ctx);
			return;
		}
		focus.enter(ctx, selected);
	};

export async function showFocusQuickAction(
	ctx: ExtensionContext,
): Promise<void> {
	if (!focusQuickAction) {
		ctx.ui.notify("Focus selector is unavailable.", "error");
		return;
	}
	await focusQuickAction(ctx);
}

function register(pi: ExtensionAPI): void {
	registerBuiltInFocusPolicies();
	const focus = createFocusController(pi);
	registerSearchFocusTool(pi, focus);
	registerEnterFocusTool(pi, focus);
	focusQuickAction = openFocusQuickAction(focus);
	pi.on("before_agent_start", injectFocusRestorePrompt(pi, focus));
	pi.on("context", injectFocusReminder(pi, focus));
	pi.on("before_provider_request", filterProviderTools(pi, focus));
	pi.on("session_before_switch", persistFocusBeforeNew(pi, focus));
	pi.on("session_start", restoreFocus(focus));
	pi.on("agent_end", resetFocusAtAgentEnd(focus));
	pi.on("tool_call", guardToolCall(pi, focus));
}

export default { name: "focus", register } satisfies Feature;
