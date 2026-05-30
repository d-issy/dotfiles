import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { showFilterSelect } from "../filter-select";
import { policyRegistry } from "../policy";
import { catppuccin, fg } from "../theme";
import {
	MODE_DEFINITIONS,
	MODE_STATE_TYPE,
	type Mode,
	type ModeName,
	isModeName,
} from "./definitions";

export async function showModeSelector(
	ctx: ExtensionContext,
	currentMode: ModeName,
): Promise<ModeName | undefined> {
	const result = await showFilterSelect(ctx, {
		title: "Select Mode",
		items: MODE_DEFINITIONS.map((mode) => ({
			value: mode.name,
			label: mode.name,
			description: mode.description,
		})),
		currentValue: currentMode,
	});

	return result && isModeName(result) ? result : undefined;
}

export function applyModeStatus(ctx: ExtensionContext, mode: Mode): void {
	ctx.ui.setStatus(MODE_STATE_TYPE, fg(catppuccin[mode.color], mode.name));
}

export function activateModeTools(pi: ExtensionAPI, modeName: ModeName): void {
	pi.setActiveTools(policyRegistry.getActiveToolsForMode(modeName));
}
