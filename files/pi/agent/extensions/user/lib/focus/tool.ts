import {
	type AgentToolResult,
	type Theme,
	type ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { confirmExitFocusTransition } from "./confirmation";
import {
	BASE_FOCUS,
	EXIT_FOCUS_TOOL,
	FOCUS_EXIT_MODE,
	getFocusExitMode,
} from "./definitions";
import type { FocusController } from "./controller";
import type { FocusRuntime } from "./runtime";
import { type ToolCatalog, defineToolContribution } from "../tool/catalog";

type FocusToolDetails = Record<string, unknown>;

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

function resultDisplayText(
	result: AgentToolResult<FocusToolDetails>,
	options: ToolRenderResultOptions,
): string {
	if (options.expanded) return resultText(result);
	const rejectReason =
		typeof result.details.rejectReason === "string"
			? result.details.rejectReason
			: undefined;
	return rejectReason
		? `${firstResultLine(result)}\nReject reason: ${rejectReason}`
		: firstResultLine(result);
}

function renderExitFocusCall(_args: { reason: string }, theme: Theme): Text {
	return new Text(theme.fg("toolTitle", theme.bold(EXIT_FOCUS_TOOL)), 0, 0);
}

function renderExitFocusResult(
	result: AgentToolResult<FocusToolDetails>,
	options: ToolRenderResultOptions,
	theme: Theme,
): Text {
	const text = resultDisplayText(result, options);
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
