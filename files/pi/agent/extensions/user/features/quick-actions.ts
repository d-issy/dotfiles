import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import { showModelSelector } from "../lib/model";
import { runQuickAction, showQuickActions } from "../lib/quick-actions";
import { showEffortSelector } from "../lib/thinking";

const openQuickActions =
	(pi: ExtensionAPI) =>
	async (ctx: ExtensionContext): Promise<void> => {
		const action = await showQuickActions(ctx);
		switch (action) {
			case "focus":
				await runQuickAction("focus", ctx);
				break;
			case "effort":
				await showEffortSelector(pi, ctx);
				break;
			case "model":
				await showModelSelector(pi, ctx);
				break;
			case "refinePrompt":
				await runQuickAction("refinePrompt", ctx);
				break;
			case "promptStash":
				await runQuickAction("promptStash", ctx);
				break;
		}
	};

function register(pi: ExtensionAPI): void {
	pi.registerShortcut("ctrl+f", {
		description: "Open quick actions",
		handler: openQuickActions(pi),
	});
}

export function createQuickActionsFeature(): Feature {
	return { name: "quick-actions", dependsOn: ["focus"], register };
}

export default createQuickActionsFeature();
