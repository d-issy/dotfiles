import {
	type AgentToolResult,
	type Theme,
	type ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import {
	confirmExitFocusTransition,
	confirmFocusTransition,
	isFocusAllowedForSession,
	isFocusDeniedForSession,
	rememberFocusTransitionDecision,
} from "./confirmation";
import {
	BASE_FOCUS,
	ENTER_FOCUS_TOOL,
	EXIT_FOCUS_TOOL,
	FOCUS_EXIT_MODE,
	FOCUS_TRANSITION,
	getFocusExitMode,
} from "./definitions";
import type { FocusController } from "./controller";
import type { FocusRuntime } from "./runtime";
import { type ToolCatalog, defineToolContribution } from "../tool/catalog";

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

function getEnterableFocusNames(focus: FocusController): readonly string[] {
	return focus.registry
		.list()
		.filter((definition) => definition.transition !== FOCUS_TRANSITION.MANUAL)
		.map((definition) => definition.name);
}

function formatUnknownFocusMessage(
	name: string,
	availableFocuses: readonly string[],
): string {
	const availableText =
		availableFocuses.length > 0
			? `Available focuses: ${availableFocuses.map((focus) => `'${focus}'`).join(", ")}.`
			: "No enterable focuses are currently available.";
	return `Unknown focus '${name}'. ${availableText}`;
}

function renderEnterFocusResult(
	result: AgentToolResult<FocusToolDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
): Text {
	const rejectReason =
		typeof result.details.rejectReason === "string"
			? result.details.rejectReason
			: undefined;
	const text = options.expanded
		? resultText(result)
		: rejectReason
			? `${firstResultLine(result)}\nReject reason: ${rejectReason}`
			: firstResultLine(result);
	const color = isOkResult(result) ? "success" : "error";
	return new Text(theme.fg(color, text), 0, 0);
}

export function registerEnterFocusTool(
	focus: FocusController,
	runtime: FocusRuntime,
	catalog: ToolCatalog,
): void {
	const contribution = defineToolContribution({
		source: "focus-management",
		policy: { name: ENTER_FOCUS_TOOL },
		isErrorResult: isFailedFocusToolDetails,
		definition: {
			name: ENTER_FOCUS_TOOL,
			label: "enter_focus",
			description:
				"Enter or switch to a predefined focus available to the agent.",
			executionMode: "sequential",
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
				const activeFocus = focus.active;
				const definition = focus.registry.get(params.name);
				if (!definition) {
					const availableFocuses = getEnterableFocusNames(focus);
					return {
						content: [
							{
								type: "text" as const,
								text: formatUnknownFocusMessage(params.name, availableFocuses),
							},
						],
						details: {
							ok: false,
							reason: "unknown-focus",
							availableFocuses,
						} as FocusToolDetails,
					};
				}

				if (
					activeFocus &&
					activeFocus.name !== definition.name &&
					getFocusExitMode(activeFocus) === FOCUS_EXIT_MODE.EXPLICIT
				) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Focus '${activeFocus.name}' requires exit_focus before entering '${definition.name}'.`,
							},
						],
						details: {
							ok: false,
							reason: "explicit-exit-required",
							focus: activeFocus.name,
							requested: definition.name,
						} as FocusToolDetails,
					};
				}

				if (previousFocusName === definition.name) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Focus '${definition.name}' is already active. No action taken.`,
							},
						],
						details: {
							ok: true,
							focus: definition.name,
							reason: "already-active",
						} as FocusToolDetails,
					};
				}

				if (definition.transition === FOCUS_TRANSITION.MANUAL) {
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

				if (definition.transition === FOCUS_TRANSITION.CONFIRM) {
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
							confirmationReason,
						);
						if (!decision || decision.choice.startsWith("deny")) {
							if (decision)
								rememberFocusTransitionDecision(definition.name, decision);
							const rejectReason = decision?.rejectReason;
							const text = rejectReason
								? [
										`User rejected entering focus '${definition.name}' for this request. Do not request this focus again or route through another focus to request it. Use currently available tools if they can satisfy the request. If not, ask the user how to proceed.`,
										`Reject reason: ${rejectReason}`,
									].join("\n\n")
								: `User rejected entering focus '${definition.name}' for this request. Do not request this focus again or route through another focus to request it. Use currently available tools if they can satisfy the request. If not, ask the user how to proceed.`;
							return {
								content: [
									{
										type: "text" as const,
										text,
									},
								],
								details: {
									ok: false,
									reason: "declined",
									...(rejectReason ? { rejectReason } : {}),
								} as FocusToolDetails,
							};
						}
						rememberFocusTransitionDecision(definition.name, decision);
					}
				}

				runtime.setResetFocusAtAgentEndPending(
					getFocusExitMode(definition) === FOCUS_EXIT_MODE.SINGLE_TURN,
				);
				runtime.setUserSelectedFocus(false);
				const entered = focus.enter(ctx, definition.name);
				runtime.scheduleAutoContinue(entered.name);
				const action =
					previousFocusName === BASE_FOCUS
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
							previousFocusName === BASE_FOCUS ? undefined : previousFocusName,
					} as FocusToolDetails,
					terminate: true,
				};
			},
		},
	});
	catalog.register(contribution);
}

function renderExitFocusCall(_args: { reason: string }, theme: Theme): Text {
	return new Text(theme.fg("toolTitle", theme.bold(EXIT_FOCUS_TOOL)), 0, 0);
}

function renderExitFocusResult(
	result: AgentToolResult<FocusToolDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
): Text {
	const rejectReason =
		typeof result.details.rejectReason === "string"
			? result.details.rejectReason
			: undefined;
	const text = options.expanded
		? resultText(result)
		: rejectReason
			? `${firstResultLine(result)}\nReject reason: ${rejectReason}`
			: firstResultLine(result);
	const color = isOkResult(result) ? "muted" : "error";
	return new Text(theme.fg(color, text), 0, 0);
}

function isFailedFocusToolDetails(details: unknown): boolean {
	return (
		typeof details === "object" &&
		details !== null &&
		"ok" in details &&
		details.ok === false
	);
}

export function registerExitFocusTool(
	focus: FocusController,
	runtime: FocusRuntime,
	catalog: ToolCatalog,
): void {
	const contribution = defineToolContribution({
		source: "focus-management",
		policy: { name: EXIT_FOCUS_TOOL },
		isErrorResult: isFailedFocusToolDetails,
		definition: {
			name: EXIT_FOCUS_TOOL,
			label: "exit_focus",
			description:
				"Exit the current focus and return to base focus. If already in base focus, no action is taken.",
			executionMode: "sequential",
			parameters: Type.Object({
				reason: Type.String({
					description: "Why the current focus goal is complete.",
				}),
			}),
			renderCall: renderExitFocusCall,
			renderResult: renderExitFocusResult,
			execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
				const active = focus.active;
				if (!active) {
					return {
						content: [
							{
								type: "text" as const,
								text: "Already in base focus. No action taken.",
							},
						],
						details: { ok: true, reason: "already-base" } as FocusToolDetails,
					};
				}

				if (getFocusExitMode(active) === FOCUS_EXIT_MODE.EXPLICIT) {
					if (!ctx.hasUI) {
						return {
							content: [
								{
									type: "text" as const,
									text: `Focus '${active.name}' requires confirmation before exiting, but UI is unavailable.`,
								},
							],
							details: {
								ok: false,
								reason: "confirmation-unavailable",
							} as FocusToolDetails,
						};
					}
					const decision = await confirmExitFocusTransition(
						ctx,
						active.name,
						params.reason,
					);
					if (!decision) {
						return {
							content: [
								{
									type: "text" as const,
									text: `User cancelled exiting focus '${active.name}'. Continue in the current focus.`,
								},
							],
							details: {
								ok: false,
								cancelled: true,
								focus: active.name,
							} as FocusToolDetails,
						};
					}
					if (!decision.confirmed) {
						const rejectReason = decision.rejectReason;
						const text = rejectReason
							? [
									`User rejected exiting focus '${active.name}'. Continue in the current focus.`,
									`Reject reason: ${rejectReason}`,
									"Use the reject reason to address the missing work before trying to exit again.",
								].join("\n\n")
							: `User rejected exiting focus '${active.name}'. Continue in the current focus.`;
						return {
							content: [
								{
									type: "text" as const,
									text,
								},
							],
							details: {
								ok: false,
								cancelled: false,
								focus: active.name,
								...(rejectReason ? { rejectReason } : {}),
							} as FocusToolDetails,
						};
					}
				}

				const previous = focus.leave(ctx);
				const exitPrompt = previous?.exitPrompt?.trim();
				const exitText = previous
					? `Exited focus '${previous.name}'.`
					: "Exited focus.";
				runtime.setRestorePromptPending(false);
				runtime.setResetFocusAtAgentEndPending(false);
				runtime.setUserSelectedFocus(false);
				runtime.scheduleAutoContinue(BASE_FOCUS);
				return {
					content: [
						{
							type: "text" as const,
							text: exitPrompt ? `${exitText}\n\n${exitPrompt}` : exitText,
						},
					],
					details: {
						ok: true,
						previous: previous?.name,
						exitPrompt,
					} as FocusToolDetails,
					terminate: true,
				};
			},
		},
	});
	catalog.register(contribution);
}
