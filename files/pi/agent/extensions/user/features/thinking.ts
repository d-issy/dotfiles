import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem, KeyId } from "@earendil-works/pi-tui";
import type { Feature } from "../feature";
import {
	isThinkingLevel,
	selectThinkingLevel,
	setThinkingLevel,
	showEffortSelector,
	thinkingLevels,
} from "../lib/thinking";
import { filterCompletionsByPrefix } from "../lib/ui";

const shortcuts: readonly {
	key: KeyId;
	label: string;
	direction: -1 | 1;
}[] = [
	{ key: "shift+ctrl+h", label: "previous", direction: -1 },
	{ key: "shift+ctrl+l", label: "next", direction: 1 },
];

function completeLevel(prefix: string): AutocompleteItem[] | null {
	return filterCompletionsByPrefix(
		thinkingLevels.map((level) => ({ value: level, label: level })),
		prefix,
	);
}

const selectLevel =
	(pi: ExtensionAPI, direction: -1 | 1) =>
	(ctx: ExtensionContext): void => {
		const level = selectThinkingLevel(pi, direction);
		ctx.ui.notify(`Thinking level: ${level}`, "info");
	};

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
	for (const { key, label, direction } of shortcuts) {
		pi.registerShortcut(key, {
			description: `Select ${label} thinking level`,
			handler: selectLevel(pi, direction),
		});
	}
	pi.registerCommand("effort", {
		description: "Select thinking effort",
		getArgumentCompletions: completeLevel,
		handler: selectEffort(pi),
	});
}

export default { name: "thinking", register } satisfies Feature;
