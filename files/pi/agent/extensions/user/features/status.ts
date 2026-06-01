import type {
	ExtensionAPI,
	ExtensionHandler,
	SessionShutdownEvent,
	SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import {
	FOOTER_NOTICE_DEFAULT_MS,
	FOOTER_NOTICE_EVENT,
	type FooterNoticeEvent,
	type FooterNoticeState,
	type RenderTrigger,
	createFooterNoticeState,
	createRenderTrigger,
	createStatusBarFooter,
} from "../lib/status";

const initFooter =
	(
		pi: ExtensionAPI,
		render: RenderTrigger,
		notice: FooterNoticeState,
	): ExtensionHandler<SessionStartEvent> =>
	(_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setFooter(createStatusBarFooter(pi, ctx, render.set, notice));
	};

const handleFooterNotice =
	(notice: FooterNoticeState) =>
	(data: unknown): void => {
		const event = data as FooterNoticeEvent;
		if (!event.message) {
			notice.clear();
			return;
		}

		notice.show(event.message, event.durationMs ?? FOOTER_NOTICE_DEFAULT_MS);
	};

const cleanupFooterNotice =
	(
		notice: FooterNoticeState,
		unsubscribe: () => void,
	): ExtensionHandler<SessionShutdownEvent> =>
	() => {
		unsubscribe();
		notice.dispose();
	};

function register(pi: ExtensionAPI): void {
	const render = createRenderTrigger();
	const notice = createFooterNoticeState(render);
	const unsubscribeFooterNotice = pi.events.on(
		FOOTER_NOTICE_EVENT,
		handleFooterNotice(notice),
	);

	pi.on("thinking_level_select", render.trigger);
	pi.on("model_select", render.trigger);
	pi.on("session_start", initFooter(pi, render, notice));
	pi.on(
		"session_shutdown",
		cleanupFooterNotice(notice, unsubscribeFooterNotice),
	);
}

export default { name: "status", register } satisfies Feature;
