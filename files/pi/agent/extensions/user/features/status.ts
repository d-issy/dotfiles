import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { createStatusBarFooter } from "../lib/status";
import type { SpeedMode } from "./fast";

type ModelIdentity = Pick<
	NonNullable<ExtensionContext["model"]>,
	"provider" | "id"
>;

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

export default registerStatusFeature;
