import {
	type ModelThinkingLevel,
	getSupportedThinkingLevels,
} from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { showFilterSelect } from "./ui";

export function getThinkingLevels(
	model: ExtensionContext["model"],
): readonly ModelThinkingLevel[] {
	return model ? getSupportedThinkingLevels(model) : [];
}

export function isThinkingLevel(
	value: string,
	levels: readonly ModelThinkingLevel[],
): value is ModelThinkingLevel {
	return levels.includes(value as ModelThinkingLevel);
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
	const levels = getThinkingLevels(ctx.model);
	const result = await showFilterSelect(ctx, {
		title: "Select Thinking Effort",
		items: levels.map((level) => ({
			value: level,
			label: level,
		})),
		currentValue: current,
	});

	if (result && isThinkingLevel(result, levels))
		setThinkingLevel(pi, ctx, result);
}
