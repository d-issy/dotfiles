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
import { getRequestedFocusName, registerFocusFlag } from "../lib/focus/cli";
import { registerQuickActionHandler } from "../lib/quick-actions";
import { guardToolCall } from "../lib/focus/guard";
import { filterProviderTools } from "../lib/focus/provider-filter";
import {
	injectFocusRestorePrompt,
	registerFocusReminderSource,
} from "../lib/focus/prompt";
import { type FocusRuntime, createFocusRuntime } from "../lib/focus/runtime";
import {
	autoContinueAfterFocusTransition,
	persistFocusBeforeNew,
	resetConfirmDecisions,
	resetFocusAtAgentEnd,
	restoreFocus,
} from "../lib/focus/session";
import { registerExitFocusTool } from "../lib/focus/tool";

const openFocusQuickAction =
	(focus: FocusController, runtime: FocusRuntime) =>
	async (ctx: ExtensionContext): Promise<void> => {
		if (runtime.lockedFocusName) {
			ctx.ui.notify(
				`Focus is locked to '${runtime.lockedFocusName}' by --focus.`,
				"warning",
			);
			return;
		}
		const selected = await showFocusSelector(
			ctx,
			focus.registry,
			focus.current,
		);
		if (!selected) return;
		runtime.setResetFocusAtAgentEndPending(false);
		runtime.cancelAutoContinue();
		if (selected === BASE_FOCUS) {
			runtime.setUserSelectedFocus(false);
			focus.leave(ctx);
			runtime.recordFocusChange(BASE_FOCUS);
			return;
		}
		runtime.setUserSelectedFocus(true);
		focus.enter(ctx, selected);
		runtime.recordFocusChange(selected);
	};

const toggleFocusSelector =
	(focus: FocusController, runtime: FocusRuntime) =>
	async (ctx: ExtensionContext): Promise<void> => {
		if (runtime.lockedFocusName) {
			ctx.ui.notify(
				`Focus is locked to '${runtime.lockedFocusName}' by --focus.`,
				"warning",
			);
			return;
		}
		runtime.setResetFocusAtAgentEndPending(false);
		runtime.cancelAutoContinue();
		if (focus.current !== BASE_FOCUS) {
			runtime.setUserSelectedFocus(false);
			focus.leave(ctx);
			runtime.recordFocusChange(BASE_FOCUS);
			return;
		}
		await openFocusQuickAction(focus, runtime)(ctx);
	};

function register(pi: ExtensionAPI, services: UserExtensionServices): void {
	registerFocusFlag(pi);
	registerBuiltInFocusPolicies(services.tools);
	const focus = createFocusController(pi, services.focus);
	const runtime = createFocusRuntime();
	const focusReminder = registerFocusReminderSource(
		pi,
		focus,
		runtime,
		services.reminders,
	);
	registerExitFocusTool(focus, runtime, services.tools);
	registerQuickActionHandler("focus", openFocusQuickAction(focus, runtime));
	pi.registerShortcut("shift+tab", {
		description: "Leave focus or open focus selector",
		handler: toggleFocusSelector(focus, runtime),
	});
	pi.on("before_agent_start", injectFocusRestorePrompt(pi, focus, runtime));
	pi.on("before_provider_request", filterProviderTools(pi, focus, runtime));
	pi.on("session_before_switch", persistFocusBeforeNew(pi, focus, runtime));
	pi.on("session_start", resetConfirmDecisions());
	pi.on(
		"session_start",
		restoreFocus(focus, runtime, {
			getLockedFocusName: () => getRequestedFocusName(pi),
			onLockedFocusName: (focusName) =>
				services.focus.setLockedFocusName(focusName),
		}),
	);
	pi.on("agent_end", resetFocusAtAgentEnd(focus, runtime));
	pi.on(
		"agent_end",
		autoContinueAfterFocusTransition(pi, focus, runtime, focusReminder),
	);
	pi.on("tool_call", guardToolCall(pi, focus, services.tools, runtime));
}

export function createFocusFeature(): Feature {
	return { name: "focus", dependsOn: ["system-reminders"], register };
}

export default createFocusFeature();
