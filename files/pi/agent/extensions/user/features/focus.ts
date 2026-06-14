import {
	type AgentEndEvent,
	type AgentToolResult,
	type BeforeAgentStartEvent,
	type BeforeAgentStartEventResult,
	type BeforeProviderRequestEvent,
	type ContextEvent,
	DynamicBorder,
	type ExtensionAPI,
	type ExtensionContext,
	type ExtensionHandler,
	type SessionBeforeSwitchEvent,
	type SessionStartEvent,
	type Theme,
	type ToolCallEvent,
	type ToolCallEventResult,
	type ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { Feature } from "../feature";
import {
	DEFAULT_FOCUS,
	ENTER_FOCUS_TOOL,
	FOCUS_REMINDER_TYPE,
	FOCUS_STATE_TYPE,
	type FocusController,
	buildFocusRestorePrompt,
	createFocusController,
	findPersistedFocus,
	isFocusReminderMessage,
	registerBuiltInFocusPolicies,
	showFocusSelector,
} from "../lib/focus";
import { policyRegistry } from "../lib/policy";
import { ensureProjectUserSettingsTrusted } from "../lib/project-settings";
import { decodePrintableInput } from "../lib/ui";

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
type FocusConfirmDecision =
	| "allow-once"
	| "deny-once"
	| "allow-session"
	| "deny-session";

type FocusConfirmItem = {
	key: string;
	value: FocusConfirmDecision;
	label: string;
	description: string;
};

let focusQuickAction: FocusQuickAction | undefined;
let restorePromptPending = false;
let resetFocusAtAgentEndPending = false;
const sessionAllowedConfirmFocuses = new Set<string>();
const sessionDeniedConfirmFocuses = new Set<string>();

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

function buildDefaultFocusPrompt(focus: FocusController): string {
	const focuses = focus.registry.search().map((definition) => ({
		name: definition.name,
		description: definition.description,
	}));
	return `[DEFAULT FOCUS]\nYou are in default focus. Use enter_focus to enter one.\n\nAvailable focuses:\n${formatFocusList(focuses)}`;
}

function renderEnterFocusCall(
	_args: { name: string; reason?: string },
	theme: Theme,
): Text {
	return new Text(theme.fg("toolTitle", theme.bold(ENTER_FOCUS_TOOL)), 0, 0);
}

function resultText(result: AgentToolResult<FocusToolDetails>): string {
	const content = result.content[0];
	return content?.type === "text" ? content.text : "";
}

function firstResultLine(result: AgentToolResult<FocusToolDetails>): string {
	return resultText(result).split("\n")[0] ?? "";
}

function isOkResult(result: AgentToolResult<FocusToolDetails>): boolean {
	return result.details.ok !== false;
}

function renderEnterFocusResult(
	result: AgentToolResult<FocusToolDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
): Text {
	const text = options.expanded ? resultText(result) : firstResultLine(result);
	const color = isOkResult(result) ? "success" : "error";
	return new Text(theme.fg(color, text), 0, 0);
}

function focusConfirmItems(description: string): readonly FocusConfirmItem[] {
	return [
		{
			key: "y",
			value: "allow-once",
			label: "Allow once",
			description,
		},
		{
			key: "n",
			value: "deny-once",
			label: "Deny once",
			description: "Decline this request only.",
		},
		{
			key: "a",
			value: "allow-session",
			label: "Allow this session only",
			description: "Enter this focus without asking again in this session.",
		},
		{
			key: "d",
			value: "deny-session",
			label: "Deny this session only",
			description: "Decline this focus without asking again in this session.",
		},
	];
}

function renderFocusConfirmItem(
	theme: Theme,
	item: FocusConfirmItem,
	selected: boolean,
	width: number,
): string {
	const prefix = selected ? theme.fg("accent", "→ ") : "  ";
	const key = theme.fg("accent", item.key);
	const label = selected ? theme.fg("accent", item.label) : item.label;
	const left = `${prefix}${key}  ${label}`;
	const gap = " ".repeat(Math.max(1, 30 - visibleWidth(left)));
	return truncateToWidth(
		`${left}${theme.fg("muted", gap + item.description)}`,
		width,
		"",
	);
}

async function confirmFocusTransition(
	ctx: ExtensionContext,
	name: string,
	description: string,
	reason: string,
): Promise<FocusConfirmDecision | undefined> {
	const items = focusConfirmItems(description);
	return ctx.ui.custom<FocusConfirmDecision | undefined>(
		(tui, theme, keybindings, done) => {
			const border = new DynamicBorder((text) => theme.fg("accent", text));
			let selectedIndex = 0;
			const move = (delta: -1 | 1): void => {
				selectedIndex = (selectedIndex + delta + items.length) % items.length;
			};
			const select = (item: FocusConfirmItem): void => done(item.value);
			return {
				render(width: number) {
					return [
						...border.render(width),
						truncateToWidth(
							theme.fg("accent", theme.bold(`Enter focus: ${name}`)),
							width,
							"",
						),
						truncateToWidth(theme.fg("dim", `Reason: ${reason}`), width, ""),
						...items.map((item, index) =>
							renderFocusConfirmItem(
								theme,
								item,
								index === selectedIndex,
								width,
							),
						),
						truncateToWidth(
							theme.fg(
								"dim",
								"y/n/a/d select • ↑↓ navigate • enter select • esc cancel",
							),
							width,
							"",
						),
						...border.render(width),
					];
				},
				invalidate: () => border.invalidate(),
				handleInput(data: string) {
					if (keybindings.matches(data, "tui.select.up")) {
						move(-1);
						tui.requestRender();
						return;
					}
					if (keybindings.matches(data, "tui.select.down")) {
						move(1);
						tui.requestRender();
						return;
					}
					if (keybindings.matches(data, "tui.select.confirm")) {
						select(items[selectedIndex]);
						return;
					}
					if (keybindings.matches(data, "tui.select.cancel")) {
						done(undefined);
						return;
					}
					const input = decodePrintableInput(data);
					if (!input) return;
					const key = input.toLowerCase();
					const item = items.find((entry) => entry.key === key);
					if (item) select(item);
				},
			};
		},
	);
}

function rememberFocusTransitionDecision(
	name: string,
	decision: FocusConfirmDecision,
): void {
	if (decision === "allow-session") {
		sessionDeniedConfirmFocuses.delete(name);
		sessionAllowedConfirmFocuses.add(name);
	}
	if (decision === "deny-session") {
		sessionAllowedConfirmFocuses.delete(name);
		sessionDeniedConfirmFocuses.add(name);
	}
}

function clearFocusTransitionDecisions(): void {
	sessionAllowedConfirmFocuses.clear();
	sessionDeniedConfirmFocuses.clear();
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
		content: `<system-reminder>\nCurrent focus: ${focus.active.name}. Follow the focus instructions already provided.\n\nAvailable tool definitions:\n\`\`\`json\n${formatToolDefinitions(tools)}\n\`\`\`\n</system-reminder>`,
		display: false,
		details: { focus: focus.active.name },
	};
}

function registerEnterFocusTool(
	pi: ExtensionAPI,
	focus: FocusController,
): void {
	pi.registerTool({
		name: ENTER_FOCUS_TOOL,
		label: "enter_focus",
		description:
			"Enter or switch to a predefined focus available to the agent.",
		parameters: Type.Object({
			name: Type.String({ description: "Focus name to enter." }),
			reason: Type.Optional(
				Type.String({
					description:
						"Why this focus is appropriate. Required when user confirmation is needed.",
				}),
			),
		}),
		renderCall: renderEnterFocusCall,
		renderResult: renderEnterFocusResult,
		execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
			const previousFocusName = focus.current;
			const definition = focus.registry.get(params.name);
			if (!definition) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Unknown focus '${params.name}'. Choose one of the available focuses from the default focus instructions.`,
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
							text: `Already in focus '${definition.name}'. Continue with the current focus tools.`,
						},
					],
					details: {
						ok: false,
						focus: definition.name,
						reason: "already-active",
					} as FocusToolDetails,
				};
			}

			if (definition.transition === "manual") {
				return {
					content: [
						{
							type: "text" as const,
							text: `Focus '${definition.name}' is reserved for Quick Actions.`,
						},
					],
					details: { ok: false, reason: "manual-only" } as FocusToolDetails,
				};
			}

			if (definition.transition === "confirm") {
				const confirmationReason = params.reason?.trim();
				if (sessionDeniedConfirmFocuses.has(definition.name)) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Focus '${definition.name}' is denied for this session.`,
							},
						],
						details: {
							ok: false,
							reason: "session-denied",
						} as FocusToolDetails,
					};
				}
				if (!sessionAllowedConfirmFocuses.has(definition.name)) {
					if (!confirmationReason) {
						return {
							content: [
								{
									type: "text" as const,
									text: `Focus '${definition.name}' requires a reason for user confirmation. Call enter_focus again with a concise reason.`,
								},
							],
							details: {
								ok: false,
								reason: "reason-required",
							} as FocusToolDetails,
						};
					}
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
					const decision = await confirmFocusTransition(
						ctx,
						definition.name,
						definition.description,
						confirmationReason,
					);
					if (!decision || decision.startsWith("deny")) {
						if (decision)
							rememberFocusTransitionDecision(definition.name, decision);
						return {
							content: [
								{
									type: "text" as const,
									text: `User rejected entering focus '${definition.name}' for this request. Do not request this focus again or route through another focus to request it. Use currently available tools if they can satisfy the request. If not, ask the user how to proceed.`,
								},
							],
							details: { ok: false, reason: "declined" } as FocusToolDetails,
						};
					}
					rememberFocusTransitionDecision(definition.name, decision);
				}
			}

			resetFocusAtAgentEndPending = true;
			const entered = focus.enter(ctx, definition.name, { source: "agent" });
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
				systemPrompt: `${systemPrompt}\n\n${buildDefaultFocusPrompt(focus)}`,
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

const resetConfirmDecisions =
	(): ExtensionHandler<SessionStartEvent> => async () => {
		clearFocusTransitionDecisions();
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
		focus.enter(ctx, selected, { source: "user" });
	};

const toggleFocusSelector =
	(focus: FocusController) =>
	async (ctx: ExtensionContext): Promise<void> => {
		resetFocusAtAgentEndPending = false;
		if (focus.current !== DEFAULT_FOCUS) {
			focus.leave(ctx);
			return;
		}
		await openFocusQuickAction(focus)(ctx);
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
	registerEnterFocusTool(pi, focus);
	focusQuickAction = openFocusQuickAction(focus);
	pi.registerShortcut("shift+tab", {
		description: "Leave focus or open focus selector",
		handler: toggleFocusSelector(focus),
	});
	pi.on("before_agent_start", injectFocusRestorePrompt(pi, focus));
	pi.on("context", injectFocusReminder(pi, focus));
	pi.on("before_provider_request", filterProviderTools(pi, focus));
	pi.on("session_before_switch", persistFocusBeforeNew(pi, focus));
	pi.on("session_start", resetConfirmDecisions());
	pi.on("session_start", restoreFocus(focus));
	pi.on("agent_end", resetFocusAtAgentEnd(focus));
	pi.on("tool_call", guardToolCall(pi, focus));
}

export default { name: "focus", register } satisfies Feature;
