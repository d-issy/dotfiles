import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import type { UserExtensionServices } from "../lib/services";
import {
	BASE_FOCUS,
	type FocusController,
	createFocusController,
	registerBuiltInFocusPolicies,
	showFocusSelector,
} from "../lib/focus";
import { registerQuickActionHandler } from "../lib/quick-actions";
import { guardToolCall } from "../lib/focus/guard";
import { filterProviderTools } from "../lib/focus/provider-filter";
import {
	injectFocusReminder,
	injectFocusRestorePrompt,
} from "../lib/focus/prompt";
import { type FocusRuntime, createFocusRuntime } from "../lib/focus/runtime";
import {
	autoContinueAfterFocusTransition,
	persistFocusBeforeNew,
	resetConfirmDecisions,
	resetFocusAtAgentEnd,
	restoreFocus,
} from "../lib/focus/session";
import {
	registerEnterFocusTool,
	registerExitFocusTool,
} from "../lib/focus/tool";

const openFocusQuickAction =
	(focus: FocusController, runtime: FocusRuntime) =>
	async (ctx: ExtensionContext): Promise<void> => {
		const selected = await showFocusSelector(
			ctx,
			focus.registry,
			focus.current,
		);
		if (!selected) return;
		runtime.resetFocusAtAgentEndPending = false;
		runtime.autoContinueFocusName = undefined;
		if (selected === BASE_FOCUS) {
			runtime.userSelectedFocus = false;
			focus.leave(ctx);
			runtime.focusReminderPending = true;
			return;
		}
		runtime.userSelectedFocus = true;
		focus.enter(ctx, selected);
		runtime.focusReminderPending = true;
	};

const toggleFocusSelector =
	(focus: FocusController, runtime: FocusRuntime) =>
	async (ctx: ExtensionContext): Promise<void> => {
		runtime.resetFocusAtAgentEndPending = false;
		runtime.autoContinueFocusName = undefined;
		if (focus.current !== BASE_FOCUS) {
			runtime.userSelectedFocus = false;
			focus.leave(ctx);
			runtime.focusReminderPending = true;
			return;
		}
		await openFocusQuickAction(focus, runtime)(ctx);
	};

function register(pi: ExtensionAPI, services: UserExtensionServices): void {
	registerBuiltInFocusPolicies();
	const focus = createFocusController(pi, services.focus);
	const runtime = createFocusRuntime();
	registerEnterFocusTool(focus, runtime);
	registerExitFocusTool(focus, runtime);
	registerQuickActionHandler("focus", openFocusQuickAction(focus, runtime));
	pi.registerShortcut("shift+tab", {
		description: "Leave focus or open focus selector",
		handler: toggleFocusSelector(focus, runtime),
	});
	pi.on("before_agent_start", injectFocusRestorePrompt(pi, focus, runtime));
	pi.on("context", injectFocusReminder(pi, focus, runtime));
	pi.on("before_provider_request", filterProviderTools(pi, focus));
	pi.on("session_before_switch", persistFocusBeforeNew(pi, focus));
	pi.on("session_start", resetConfirmDecisions());
	pi.on("session_start", restoreFocus(focus, runtime));
	pi.on("agent_end", resetFocusAtAgentEnd(focus, runtime));
	pi.on("agent_end", autoContinueAfterFocusTransition(pi, focus, runtime));
	pi.on("tool_call", guardToolCall(pi, focus));
}

export function createFocusFeature(): Feature {
	return { name: "focus", register };
}

export default createFocusFeature();
