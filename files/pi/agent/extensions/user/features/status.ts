import type {
	ExtensionAPI,
	ExtensionHandler,
	SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import {
	type RenderTrigger,
	createRenderTrigger,
	createStatusBarFooter,
} from "../lib/status";

const initFooter =
	(
		pi: ExtensionAPI,
		render: RenderTrigger,
	): ExtensionHandler<SessionStartEvent> =>
	(_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setFooter(createStatusBarFooter(pi, ctx, render.set));
	};

function register(pi: ExtensionAPI): void {
	const render = createRenderTrigger();

	pi.on("thinking_level_select", render.trigger);
	pi.on("model_select", render.trigger);
	pi.on("session_start", initFooter(pi, render));
}

export default { name: "status", register } satisfies Feature;
