import {
	type AgentToolResult,
	type ExtensionAPI,
	type Theme,
	type ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import {
	confirmFocusTransition,
	isFocusAllowedForSession,
	isFocusDeniedForSession,
	rememberFocusTransitionDecision,
} from "./confirmation";
import { DEFAULT_FOCUS, ENTER_FOCUS_TOOL } from "./definitions";
import type { FocusController } from "./controller";
import type { FocusRuntime } from "./runtime";

type FocusToolDetails = Record<string, unknown>;

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

export function registerEnterFocusTool(
	pi: ExtensionAPI,
	focus: FocusController,
	runtime: FocusRuntime,
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
				if (isFocusDeniedForSession(definition.name)) {
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
				if (!isFocusAllowedForSession(definition.name)) {
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

			runtime.resetFocusAtAgentEndPending = true;
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
