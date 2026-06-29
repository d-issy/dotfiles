import type {
	ExtensionAPI,
	ExtensionHandler,
	SessionShutdownEvent,
	SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import {
	FOOTER_NOTICE_EVENT,
	type FooterNoticeState,
	type LiveAgentUsageTracker,
	type RenderTrigger,
	createFooterNoticeState,
	createLiveAgentUsageTracker,
	createRenderTrigger,
	createStatusBarFooter,
	handleFooterNotice,
} from "../lib/status";

const initFooter =
	(
		pi: ExtensionAPI,
		render: RenderTrigger,
		notice: FooterNoticeState,
		liveAgentUsage: LiveAgentUsageTracker,
	): ExtensionHandler<SessionStartEvent> =>
	(_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setFooter(
			createStatusBarFooter(pi, ctx, render.set, notice, liveAgentUsage),
		);
	};

const cleanupStatus =
	(
		notice: FooterNoticeState,
		unsubscribe: () => void,
		liveAgentUsage: LiveAgentUsageTracker,
	): ExtensionHandler<SessionShutdownEvent> =>
	() => {
		unsubscribe();
		liveAgentUsage.clear();
		notice.dispose();
	};

function register(pi: ExtensionAPI): void {
	const render = createRenderTrigger();
	const notice = createFooterNoticeState(render);
	const liveAgentUsage = createLiveAgentUsageTracker();
	const unsubscribeFooterNotice = pi.events.on(
		FOOTER_NOTICE_EVENT,
		handleFooterNotice(notice),
	);

	pi.on("thinking_level_select", render.trigger);
	pi.on("model_select", render.trigger);
	pi.on("tool_execution_update", (event) => {
		if (liveAgentUsage.handleToolExecutionUpdate(event)) render.trigger();
	});
	pi.on("message_end", (event) => {
		liveAgentUsage.handleMessageEnd(event);
		render.trigger();
	});
	pi.on("session_start", initFooter(pi, render, notice, liveAgentUsage));
	pi.on(
		"session_shutdown",
		cleanupStatus(notice, unsubscribeFooterNotice, liveAgentUsage),
	);
}

export function createStatusFeature(): Feature {
	return { name: "status", register };
}

export default createStatusFeature();
