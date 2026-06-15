import type { ModelThinkingLevel } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { showFilterSelect } from "./ui";

export const thinkingLevels: readonly ModelThinkingLevel[] = [
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
];

export function isThinkingLevel(value: string): value is ModelThinkingLevel {
	return thinkingLevels.includes(value as ModelThinkingLevel);
}

export function setThinkingLevel(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	level: ModelThinkingLevel,
): void {
	pi.setThinkingLevel(level);
	ctx.ui.notify(`Thinking level: ${pi.getThinkingLevel()}`, "info");
}

export async function showEffortSelector(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
): Promise<void> {
	const current = pi.getThinkingLevel();
	const result = await showFilterSelect(ctx, {
		title: "Select Thinking Effort",
		items: thinkingLevels.map((level) => ({
			value: level,
			label: level,
		})),
		currentValue: current,
	});

	if (result && isThinkingLevel(result)) setThinkingLevel(pi, ctx, result);
}
