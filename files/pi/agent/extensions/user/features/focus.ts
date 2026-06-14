import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import {
	DEFAULT_FOCUS,
	type FocusController,
	createFocusController,
	registerBuiltInFocusPolicies,
	showFocusSelector,
} from "../lib/focus";
import { guardToolCall } from "../lib/focus/guard";
import { filterProviderTools } from "../lib/focus/provider-filter";
import {
	injectFocusReminder,
	injectFocusRestorePrompt,
} from "../lib/focus/prompt";
import { type FocusRuntime, createFocusRuntime } from "../lib/focus/runtime";
import {
	persistFocusBeforeNew,
	resetConfirmDecisions,
	resetFocusAtAgentEnd,
	restoreFocus,
} from "../lib/focus/session";
import { registerEnterFocusTool } from "../lib/focus/tool";

type FocusQuickAction = (ctx: ExtensionContext) => Promise<void>;

let focusQuickAction: FocusQuickAction | undefined;

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
		if (selected === DEFAULT_FOCUS) {
			focus.leave(ctx);
			return;
		}
		focus.enter(ctx, selected, { source: "user" });
	};

const toggleFocusSelector =
	(focus: FocusController, runtime: FocusRuntime) =>
	async (ctx: ExtensionContext): Promise<void> => {
		runtime.resetFocusAtAgentEndPending = false;
		if (focus.current !== DEFAULT_FOCUS) {
			focus.leave(ctx);
			return;
		}
		await openFocusQuickAction(focus, runtime)(ctx);
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
	const runtime = createFocusRuntime();
	registerEnterFocusTool(pi, focus, runtime);
	focusQuickAction = openFocusQuickAction(focus, runtime);
	pi.registerShortcut("shift+tab", {
		description: "Leave focus or open focus selector",
		handler: toggleFocusSelector(focus, runtime),
	});
	pi.on("before_agent_start", injectFocusRestorePrompt(pi, focus, runtime));
	pi.on("context", injectFocusReminder(pi, focus));
	pi.on("before_provider_request", filterProviderTools(pi, focus));
	pi.on("session_before_switch", persistFocusBeforeNew(pi, focus));
	pi.on("session_start", resetConfirmDecisions());
	pi.on("session_start", restoreFocus(focus, runtime));
	pi.on("agent_end", resetFocusAtAgentEnd(focus, runtime));
	pi.on("tool_call", guardToolCall(pi, focus));
}

export default { name: "focus", register } satisfies Feature;
