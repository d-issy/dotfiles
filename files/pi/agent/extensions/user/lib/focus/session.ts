import type {
	AgentEndEvent,
	ExtensionAPI,
	ExtensionHandler,
	SessionBeforeSwitchEvent,
	SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import { ensureProjectUserSettingsTrusted } from "../project-settings";
import type { RegisteredSystemReminder } from "../system-reminder";
import { clearFocusTransitionDecisions } from "./confirmation";
import type { FocusController } from "./controller";
import {
	BASE_FOCUS,
	FOCUS_EXIT_MODE,
	FOCUS_STATE_TYPE,
	type FocusName,
	getFocusExitMode,
} from "./definitions";
import type { FocusReminderDetails } from "./prompt";
import type { FocusRuntime } from "./runtime";
import { findPersistedFocus } from "./startup";

type SessionBeforeSwitchResult = { cancel?: boolean };

export const persistFocusBeforeNew =
	(
		pi: ExtensionAPI,
		focus: FocusController,
		runtime: FocusRuntime,
	): ExtensionHandler<SessionBeforeSwitchEvent, SessionBeforeSwitchResult> =>
	async (event) => {
		if (event.reason !== "new") return;
		if (runtime.lockedFocusName) return;
		pi.appendEntry(FOCUS_STATE_TYPE, { focus: focus.current });
	};

type RestoreFocusOptions = {
	readonly getLockedFocusName?: () => FocusName | undefined;
	readonly onLockedFocusName?: (focusName: FocusName | undefined) => void;
};

function formatUnknownLockedFocusMessage(
	requested: FocusName,
	available: readonly FocusName[],
): string {
	const availableText =
		available.length > 0
			? `Available focuses: ${available.map((name) => `'${name}'`).join(", ")}.`
			: "No focuses are currently available.";
	return `Unknown --focus '${requested}'. ${availableText}`;
}

export const restoreFocus =
	(
		focus: FocusController,
		runtime: FocusRuntime,
		options?: RestoreFocusOptions,
	): ExtensionHandler<SessionStartEvent> =>
	async (_event, ctx) => {
		await ensureProjectUserSettingsTrusted(ctx);
		focus.loadProjectFocuses(ctx);
		const lockedFocusName = options?.getLockedFocusName?.();
		runtime.setLockedFocusName(lockedFocusName);
		options?.onLockedFocusName?.(lockedFocusName);
		runtime.setResetFocusAtAgentEndPending(false);
		runtime.setUserSelectedFocus(false);
		runtime.cancelAutoContinue();

		if (lockedFocusName) {
			if (!focus.registry.get(lockedFocusName)) {
				focus.restore(ctx, undefined);
				const available = focus.registry
					.list()
					.map((definition) => definition.name);
				const message = formatUnknownLockedFocusMessage(
					lockedFocusName,
					available,
				);
				if (ctx.hasUI) ctx.ui.notify(message, "error");
				throw new Error(message);
			}
			focus.enter(ctx, lockedFocusName, {
				persist: false,
				force: true,
				includeManagementTools: false,
			});
			runtime.recordFocusChange(focus.current);
			runtime.setRestorePromptPending(true);
			runtime.setFocusReminderPending(true);
			return;
		}

		const persisted = findPersistedFocus(ctx);
		focus.restore(ctx, persisted);
		runtime.recordFocusChange(focus.current);
		runtime.setRestorePromptPending(focus.active !== undefined);
		runtime.setFocusReminderPending(focus.active !== undefined);
	};

export const resetFocusAtAgentEnd =
	(
		focus: FocusController,
		runtime: FocusRuntime,
	): ExtensionHandler<AgentEndEvent> =>
	async (_event, ctx) => {
		if (runtime.lockedFocusName) return;
		if (runtime.pendingAutoContinue) return;
		if (!focus.active || !runtime.resetFocusAtAgentEndPending) return;
		if (getFocusExitMode(focus.active) !== FOCUS_EXIT_MODE.SINGLE_TURN) {
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
		reminder: RegisteredSystemReminder<FocusReminderDetails>,
	): ExtensionHandler<AgentEndEvent> =>
	async () => {
		const transition = runtime.consumeAutoContinue();
		if (!transition) return;
		if (!runtime.isCurrentTransition(transition.id)) return;
		if (focus.current !== transition.focusName) return;
		if (transition.focusName !== BASE_FOCUS && !focus.active) return;
		const isBase = transition.focusName === BASE_FOCUS;
		// This message only wakes the agent up. Focus-specific guidance is rebuilt
		// from current runtime state by the system reminder registry. The transition
		// id lets the registry drop older queued wakeups if a later focus change wins.
		reminder.sendWakeup(
			pi,
			{
				content: [
					isBase
						? "No focus is active. Previous focus instructions and tool definitions are no longer active."
						: "A focus transition completed. Continue from the latest focus state.",
					"Use the current focus reminder injected for this turn as authoritative; ignore older focus reminders if they conflict.",
					isBase
						? "Use only the tool definitions in the latest reminder. If focus-scoped tools are needed, call enter_focus to enter an appropriate focus first."
						: "Continue the user's request under the current focus. Follow the active focus instructions and available tools. Do not answer only with a focus status message.",
				],
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
