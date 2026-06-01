import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import type { Feature } from "../feature";
import {
	isThinkingLevel,
	setThinkingLevel,
	showEffortSelector,
	thinkingLevels,
} from "../lib/thinking";
import { filterCompletionsByPrefix } from "../lib/ui";

function completeLevel(prefix: string): AutocompleteItem[] | null {
	return filterCompletionsByPrefix(
		thinkingLevels.map((level) => ({ value: level, label: level })),
		prefix,
	);
}

const selectEffort =
	(pi: ExtensionAPI) =>
	async (args: string, ctx: ExtensionCommandContext): Promise<void> => {
		const level = args.trim();
		if (!level) {
			await showEffortSelector(pi, ctx);
			return;
		}

		if (!isThinkingLevel(level)) {
			ctx.ui.notify(
				`Unknown thinking level "${level}". Available: ${thinkingLevels.join(", ")}`,
				"error",
			);
			return;
		}

		setThinkingLevel(pi, ctx, level);
	};

function register(pi: ExtensionAPI): void {
	pi.registerCommand("effort", {
		description: "Select thinking effort",
		getArgumentCompletions: completeLevel,
		handler: selectEffort(pi),
	});
}

export default { name: "thinking", register } satisfies Feature;
