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
import { FOCUS_STATE_TYPE, getFocusExitMode } from "./definitions";
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
		runtime.resetFocusAtAgentEndPending = false;
	};

export const resetFocusAtAgentEnd =
	(
		focus: FocusController,
		runtime: FocusRuntime,
	): ExtensionHandler<AgentEndEvent> =>
	async (_event, ctx) => {
		if (!focus.active || !runtime.resetFocusAtAgentEndPending) return;
		if (getFocusExitMode(focus.active) !== "single-turn") {
			runtime.resetFocusAtAgentEndPending = false;
			return;
		}
		focus.leave(ctx);
		runtime.restorePromptPending = false;
		runtime.resetFocusAtAgentEndPending = false;
	};

export const resetConfirmDecisions =
	(): ExtensionHandler<SessionStartEvent> => async () => {
		clearFocusTransitionDecisions();
	};
