import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Feature } from "./lib/feature";
import { type RequestRender, createStatusBarFooter } from "./lib/status";

function register(pi: ExtensionAPI): void {
	let requestRender: RequestRender | undefined;
	const setRequestRender = (next: RequestRender | undefined): void => {
		requestRender = next;
	};
	const triggerRender = (): void => requestRender?.();

	pi.on("thinking_level_select", triggerRender);
	pi.on("model_select", triggerRender);

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setFooter(createStatusBarFooter(pi, ctx, setRequestRender));
	});
}

export default { name: "status", register } satisfies Feature;
