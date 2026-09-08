import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { installToolSummary } from "../lib/tool-summary";

export function registerToolSummaryFeature(pi: ExtensionAPI): void {
	let uninstall: (() => void) | undefined;

	function stop(): void {
		uninstall?.();
		uninstall = undefined;
	}

	pi.on("session_start", (_event, ctx) => {
		stop();
		if (!ctx.hasUI || ctx.mode !== "tui") return;
		uninstall = installToolSummary(() => ctx.ui.theme);
	});
	pi.on("session_shutdown", stop);
}
