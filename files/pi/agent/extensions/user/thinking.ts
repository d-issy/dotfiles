import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { KeyId } from "@earendil-works/pi-tui";
import { filterCompletionsByPrefix } from "./lib/ui";
import type { Feature } from "./lib/feature";
import {
	isThinkingLevel,
	selectThinkingLevel,
	setThinkingLevel,
	showEffortSelector,
	thinkingLevels,
} from "./lib/thinking";

const shortcuts: readonly {
	key: KeyId;
	label: string;
	direction: -1 | 1;
}[] = [
	{ key: "shift+ctrl+h", label: "previous", direction: -1 },
	{ key: "shift+ctrl+l", label: "next", direction: 1 },
];

function register(pi: ExtensionAPI): void {
	for (const { key, label, direction } of shortcuts) {
		pi.registerShortcut(key, {
			description: `Select ${label} thinking level`,
			handler: (ctx) => {
				const level = selectThinkingLevel(pi, direction);
				ctx.ui.notify(`Thinking level: ${level}`, "info");
			},
		});
	}

	pi.registerCommand("effort", {
		description: "Select thinking effort",
		getArgumentCompletions: (prefix) =>
			filterCompletionsByPrefix(
				thinkingLevels.map((level) => ({ value: level, label: level })),
				prefix,
			),
		handler: async (args, ctx) => {
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
		},
	});
}

export default { name: "thinking", register } satisfies Feature;
