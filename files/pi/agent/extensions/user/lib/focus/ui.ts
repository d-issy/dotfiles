import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { colors, fg } from "../theme";
import { type FilterSelectItem, showFilterSelect } from "../ui";
import {
	BASE_FOCUS,
	type FocusDefinition,
	type FocusName,
	getFocusExitMode,
} from "./definitions";
import type { FocusRegistry } from "./registry";
export {
	activateBaseFocusTools,
	activateFocusTools,
	getActiveFocusTools,
	getBaseFocusTools,
} from "./tool-access";

export function applyFocusStatus(
	ctx: ExtensionContext,
	focus: FocusDefinition | undefined,
): void {
	if (!focus) {
		ctx.ui.setStatus("focus", undefined);
		return;
	}
	ctx.ui.setStatus("focus", fg(colors[focus.color ?? "accent"], focus.name));
}

function describeFocus(focus: FocusDefinition): string {
	const tags: string[] = [];

	if (focus.transition === "manual") {
		tags.push("manual");
	}

	if (getFocusExitMode(focus) === "explicit") {
		tags.push("explicit exit");
	}

	return tags.length === 0
		? focus.description
		: `${focus.description} (${tags.join(", ")})`;
}

function focusItem(focus: FocusDefinition): FilterSelectItem {
	return {
		value: focus.name,
		label: focus.name,
		description: describeFocus(focus),
	};
}

export async function showFocusSelector(
	ctx: ExtensionContext,
	registry: FocusRegistry,
	currentFocusName: FocusName | typeof BASE_FOCUS,
): Promise<FocusName | typeof BASE_FOCUS | undefined> {
	const focuses = registry.list();
	const manualFocuses = focuses.filter(
		(focus) => focus.transition === "manual",
	);
	const explicitFocuses = focuses.filter(
		(focus) =>
			focus.transition !== "manual" && getFocusExitMode(focus) === "explicit",
	);
	const recommendedItems = [
		...manualFocuses.map((focus) => focusItem(focus)),
		...explicitFocuses.map((focus) => focusItem(focus)),
	];
	const allItems = focuses.map((focus) => focusItem(focus));
	const result = await showFilterSelect(ctx, {
		title: "Select Focus",
		items: allItems,
		tabs: [
			{ label: "Recommend", items: recommendedItems },
			{ label: "All", items: allItems },
		],
		currentValue:
			currentFocusName === BASE_FOCUS ? undefined : currentFocusName,
	});

	return result && registry.get(result) ? result : undefined;
}
