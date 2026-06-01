import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import { showModelSelector } from "../lib/model";
import { showQuickActions } from "../lib/quick-actions";
import { showEffortSelector } from "../lib/thinking";
import { showModeQuickAction } from "./mode";

const openQuickActions =
	(pi: ExtensionAPI) =>
	async (ctx: ExtensionContext): Promise<void> => {
		const action = await showQuickActions(ctx);
		switch (action) {
			case "mode":
				await showModeQuickAction(ctx);
				break;
			case "effort":
				await showEffortSelector(pi, ctx);
				break;
			case "model":
				await showModelSelector(pi, ctx);
				break;
		}
	};

function register(pi: ExtensionAPI): void {
	pi.registerShortcut("ctrl+f", {
		description: "Open quick actions",
		handler: openQuickActions(pi),
	});
}

export default { name: "quick-actions", register } satisfies Feature;
