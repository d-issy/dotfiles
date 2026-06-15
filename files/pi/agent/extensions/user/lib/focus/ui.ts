import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { colors, fg } from "../theme";
import { showFilterSelect } from "../ui";
import {
	BASE_FOCUS,
	type FocusDefinition,
	type FocusName,
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

export async function showFocusSelector(
	ctx: ExtensionContext,
	registry: FocusRegistry,
	currentFocusName: FocusName | typeof BASE_FOCUS,
): Promise<FocusName | typeof BASE_FOCUS | undefined> {
	const result = await showFilterSelect(ctx, {
		title: "Select Focus",
		items: [
			{
				value: BASE_FOCUS,
				label: BASE_FOCUS,
				description: "Leave the active focus.",
			},
			...registry.list().map((focus) => ({
				value: focus.name,
				label: focus.name,
				description:
					focus.transition === "manual"
						? `${focus.description} (manual)`
						: focus.description,
			})),
		],
		currentValue: currentFocusName,
	});

	return result === BASE_FOCUS || (result && registry.get(result))
		? result
		: undefined;
}
