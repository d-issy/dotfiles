import type { ModelThinkingLevel } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { type AutocompleteItem, type KeyId } from "@earendil-works/pi-tui";
import { showFilterSelect } from "./lib/filter-select";

const thinkingLevels: readonly ModelThinkingLevel[] = [
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
];

function selectThinkingLevel(
	pi: ExtensionAPI,
	direction: -1 | 1,
): ModelThinkingLevel {
	const current = pi.getThinkingLevel();
	const currentIndex = Math.max(0, thinkingLevels.indexOf(current));

	for (let offset = 1; offset <= thinkingLevels.length; offset++) {
		const nextIndex =
			(currentIndex + direction * offset + thinkingLevels.length) %
			thinkingLevels.length;
		const nextLevel = thinkingLevels[nextIndex];
		pi.setThinkingLevel(nextLevel);

		const selectedLevel = pi.getThinkingLevel();
		if (selectedLevel !== current || nextLevel === current)
			return selectedLevel;
	}

	return pi.getThinkingLevel();
}

const shortcuts: readonly {
	key: KeyId;
	label: string;
	direction: -1 | 1;
}[] = [
	{ key: "shift+ctrl+h", label: "previous", direction: -1 },
	{ key: "shift+ctrl+l", label: "next", direction: 1 },
];

function isThinkingLevel(value: string): value is ModelThinkingLevel {
	return thinkingLevels.includes(value as ModelThinkingLevel);
}

function setThinkingLevel(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	level: ModelThinkingLevel,
): void {
	pi.setThinkingLevel(level);
	ctx.ui.notify(`Thinking level: ${pi.getThinkingLevel()}`, "info");
}

async function showEffortSelector(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
): Promise<void> {
	const current = pi.getThinkingLevel();
	const result = await showFilterSelect(ctx, {
		title: "Select Thinking Effort",
		items: thinkingLevels.map((level) => ({
			value: level,
			label: level,
			description: `Set thinking level to ${level}`,
		})),
		currentValue: current,
	});

	if (result && isThinkingLevel(result)) setThinkingLevel(pi, ctx, result);
}

export default function thinkingEffort(pi: ExtensionAPI): void {
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
		getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
			const items = thinkingLevels.map((level) => ({
				value: level,
				label: level,
			}));
			const filtered = items.filter((item) => item.value.startsWith(prefix));
			return filtered.length > 0 ? filtered : null;
		},
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
