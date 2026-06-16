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
		runtime.recordFocusChange(focus.current);
		runtime.setRestorePromptPending(focus.active !== undefined);
		runtime.setFocusReminderPending(focus.active !== undefined);
		runtime.setResetFocusAtAgentEndPending(false);
		runtime.setUserSelectedFocus(false);
		runtime.cancelAutoContinue();
	};

export const resetFocusAtAgentEnd =
	(
		focus: FocusController,
		runtime: FocusRuntime,
	): ExtensionHandler<AgentEndEvent> =>
	async (_event, ctx) => {
		if (runtime.pendingAutoContinue) return;
		if (!focus.active || !runtime.resetFocusAtAgentEndPending) return;
		if (getFocusExitMode(focus.active) !== "single-turn") {
			runtime.setResetFocusAtAgentEndPending(false);
			return;
		}
		focus.leave(ctx);
		runtime.recordFocusChange(BASE_FOCUS);
		runtime.setRestorePromptPending(false);
		runtime.setResetFocusAtAgentEndPending(false);
	};

export const autoContinueAfterFocusTransition =
	(
		pi: ExtensionAPI,
		focus: FocusController,
		runtime: FocusRuntime,
	): ExtensionHandler<AgentEndEvent> =>
	async () => {
		const transition = runtime.consumeAutoContinue();
		if (!transition) return;
		if (!runtime.isCurrentTransition(transition.id)) return;
		if (focus.current !== transition.focusName) return;
		if (transition.focusName !== BASE_FOCUS && !focus.active) return;
		runtime.requestFocusReminder();
		const isBase = transition.focusName === BASE_FOCUS;
		// This message only wakes the agent up. Focus-specific guidance is rebuilt
		// from current runtime state in the context hook. The transition id lets us
		// drop older queued wakeups if a later focus change happens first.
		pi.sendMessage(
			{
				customType: FOCUS_REMINDER_TYPE,
				content: [
					"<system-reminder>",
					isBase
						? "A focus exit completed. Continue from the latest focus state."
						: "A focus transition completed. Continue from the latest focus state.",
					"Use the current focus reminder injected for this turn as authoritative; ignore older focus reminders if they conflict.",
					isBase
						? "Continue from the focus tool result and its exit handoff. If another focus is needed, use enter_focus."
						: "Continue the user's request under the current focus. Follow the active focus instructions and available tools. Do not answer only with a focus status message.",
					"</system-reminder>",
				].join("\n"),
				display: false,
				details: {
					queuedFocus: transition.focusName,
					transitionId: transition.id,
					reason: isBase
						? "auto-continue-after-exit"
						: "auto-continue-after-enter",
				},
			},
			{ triggerTurn: true, deliverAs: "steer" },
		);
	};

export const resetConfirmDecisions =
	(): ExtensionHandler<SessionStartEvent> => async () => {
		clearFocusTransitionDecisions();
	};
