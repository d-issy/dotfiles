import type {
	AgentEndEvent,
	ExtensionAPI,
	ExtensionHandler,
	SessionBeforeSwitchEvent,
	SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import { ensureProjectUserSettingsTrusted } from "../project-settings";
import { clearFocusTransitionDecisions } from "./confirmation";
import type { FocusController } from "./controller";
import {
	BASE_FOCUS,
	FOCUS_REMINDER_TYPE,
	FOCUS_STATE_TYPE,
	getFocusExitMode,
} from "./definitions";
import type { FocusRuntime } from "./runtime";
import { findPersistedFocus } from "./startup";

type SessionBeforeSwitchResult = { cancel?: boolean };

export const persistFocusBeforeNew =
	(
		pi: ExtensionAPI,
		focus: FocusController,
	): ExtensionHandler<SessionBeforeSwitchEvent, SessionBeforeSwitchResult> =>
	async (event) => {
		if (event.reason !== "new") return;
		pi.appendEntry(FOCUS_STATE_TYPE, { focus: focus.current });
	};

export const restoreFocus =
	(
		focus: FocusController,
		runtime: FocusRuntime,
	): ExtensionHandler<SessionStartEvent> =>
	async (_event, ctx) => {
		await ensureProjectUserSettingsTrusted(ctx);
		focus.loadProjectFocuses(ctx);
		const persisted = findPersistedFocus(ctx);
		focus.restore(ctx, persisted);
		runtime.restorePromptPending = focus.active !== undefined;
		runtime.focusReminderPending = focus.active !== undefined;
		runtime.resetFocusAtAgentEndPending = false;
		runtime.autoContinueFocusName = undefined;
	};

export const resetFocusAtAgentEnd =
	(
		focus: FocusController,
		runtime: FocusRuntime,
	): ExtensionHandler<AgentEndEvent> =>
	async (_event, ctx) => {
		if (runtime.autoContinueFocusName) return;
		if (!focus.active || !runtime.resetFocusAtAgentEndPending) return;
		if (getFocusExitMode(focus.active) !== "single-turn") {
			runtime.resetFocusAtAgentEndPending = false;
			return;
		}
		focus.leave(ctx);
		runtime.restorePromptPending = false;
		runtime.focusReminderPending = true;
		runtime.resetFocusAtAgentEndPending = false;
	};

export const autoContinueAfterFocusTransition =
	(
		pi: ExtensionAPI,
		focus: FocusController,
		runtime: FocusRuntime,
	): ExtensionHandler<AgentEndEvent> =>
	async () => {
		const focusName = runtime.autoContinueFocusName;
		if (!focusName) return;
		runtime.autoContinueFocusName = undefined;
		if (focus.current !== focusName) return;
		if (focusName !== BASE_FOCUS && !focus.active) return;
		runtime.focusReminderPending = true;
		const isBase = focusName === BASE_FOCUS;
		pi.sendMessage(
			{
				customType: FOCUS_REMINDER_TYPE,
				content: [
					"<system-reminder>",
					isBase
						? "Returned to base focus after exit_focus."
						: `Focus '${focusName}' is now active after enter_focus.`,
					isBase
						? "Continue from the focus tool result and its exit handoff. If another focus is needed, use enter_focus."
						: "Continue the user's request under this focus now. Follow the active focus instructions and available tools. Do not answer only with a focus status message.",
					"</system-reminder>",
				].join("\n"),
				display: false,
				details: {
					focus: focusName,
					reason: isBase
						? "auto-continue-after-exit"
						: "auto-continue-after-enter",
				},
			},
			{ triggerTurn: true, deliverAs: "followUp" },
		);
	};

export const resetConfirmDecisions =
	(): ExtensionHandler<SessionStartEvent> => async () => {
		clearFocusTransitionDecisions();
	};
