import type { ModelThinkingLevel } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { KeyId } from "@earendil-works/pi-tui";

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

export default function thinkingShortcuts(pi: ExtensionAPI): void {
	for (const { key, label, direction } of shortcuts) {
		pi.registerShortcut(key, {
			description: `Select ${label} thinking level`,
			handler: (ctx) => {
				const level = selectThinkingLevel(pi, direction);
				ctx.ui.notify(`Thinking level: ${level}`, "info");
			},
		});
	}
}
