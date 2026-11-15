import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ModelIdentity, SpeedMode } from "./fast";
import { createStatusBarFooter } from "../lib/status/footer";

export function registerStatusFeature(
	pi: ExtensionAPI,
	getSpeedMode: (model: ModelIdentity | undefined) => SpeedMode | undefined,
): () => void {
	let requestRender: (() => void) | undefined;

	const refresh = (): void => {
		requestRender?.();
	};

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI || ctx.mode !== "tui") return;

		ctx.ui.setFooter(
			createStatusBarFooter(
				ctx,
				(nextRequestRender) => {
					requestRender = nextRequestRender;
				},
				getSpeedMode,
			),
		);
	});

	pi.on("model_select", refresh);
	pi.on("thinking_level_select", refresh);
	pi.on("turn_end", refresh);
	pi.on("session_shutdown", () => {
		requestRender = undefined;
	});
	return refresh;
}
