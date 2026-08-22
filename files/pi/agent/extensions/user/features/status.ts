import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { createStatusBarFooter } from "../lib/status";

type ModelIdentity = Pick<
	NonNullable<ExtensionContext["model"]>,
	"provider" | "id"
>;

export function registerStatusFeature(
	pi: ExtensionAPI,
	isFastEnabled: (model: ModelIdentity | undefined) => boolean,
): void {
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
				isFastEnabled,
			),
		);
	});

	pi.on("model_select", refresh);
	pi.on("thinking_level_select", refresh);
	pi.on("turn_end", refresh);
	pi.on("session_shutdown", () => {
		requestRender = undefined;
	});
}

export default registerStatusFeature;
