import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import type { Feature } from "../feature";
import {
	getThinkingLevels,
	isThinkingLevel,
	setThinkingLevel,
	showEffortSelector,
} from "../lib/thinking";
import { filterCompletionsByPrefix } from "../lib/ui";

function completeLevel(
	prefix: string,
	levels: ReturnType<typeof getThinkingLevels>,
): AutocompleteItem[] | null {
	return filterCompletionsByPrefix(
		levels.map((level) => ({ value: level, label: level })),
		prefix,
	);
}

const selectEffort =
	(pi: ExtensionAPI) =>
	async (args: string, ctx: ExtensionCommandContext): Promise<void> => {
		const levels = getThinkingLevels(ctx.model);
		const level = args.trim();
		if (!level) {
			await showEffortSelector(pi, ctx);
			return;
		}

		if (!isThinkingLevel(level, levels)) {
			ctx.ui.notify(
				`Unknown thinking level "${level}". Available: ${levels.join(", ")}`,
				"error",
			);
			return;
		}

		setThinkingLevel(pi, ctx, level);
	};

function register(pi: ExtensionAPI): void {
	let levels: ReturnType<typeof getThinkingLevels> = [];

	pi.on("session_start", (_event, ctx) => {
		levels = getThinkingLevels(ctx.model);
	});
	pi.on("model_select", (event) => {
		levels = getThinkingLevels(event.model);
	});
	pi.registerCommand("effort", {
		description: "Select thinking effort",
		getArgumentCompletions: (prefix) => completeLevel(prefix, levels),
		handler: selectEffort(pi),
	});
}

export function createThinkingFeature(): Feature {
	return { name: "thinking", register };
}

export default createThinkingFeature();
