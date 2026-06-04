import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { showFilterSelect } from "../ui";
import { policyRegistry } from "../policy";
import { colors, fg } from "../theme";
import {
	MODE_DEFINITIONS,
	MODE_STATE_TYPE,
	type Mode,
	type ModeName,
	isModeName,
} from "./definitions";

const ALWAYS_ALLOWED_TOOL_NAMES = ["multi_tool_use.parallel"] as const;

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
	ctx.ui.setStatus(MODE_STATE_TYPE, fg(colors[mode.color], mode.name));
}

function unique(names: readonly string[]): string[] {
	return [...new Set(names)];
}

function getUnmanagedActiveTools(pi: ExtensionAPI): string[] {
	const managedTools = new Set(policyRegistry.getKnownToolNames());
	return pi.getActiveTools().filter((name) => !managedTools.has(name));
}

export function getAllowedModeTools(
	pi: ExtensionAPI,
	modeName: ModeName,
): string[] {
	return unique([
		...ALWAYS_ALLOWED_TOOL_NAMES,
		...getUnmanagedActiveTools(pi),
		...policyRegistry.getAllowedToolsForMode(modeName),
	]);
}

export function activateModeTools(
	pi: ExtensionAPI,
	modeName: ModeName,
): string[] {
	// Expose only the tools that are currently allowed. Otherwise providers see
	// inactive tool schemas, and the agent can unnecessarily reveal that those
	// tools exist when asked to list tools.
	const allowedTools = getAllowedModeTools(pi, modeName);
	pi.setActiveTools(allowedTools);
	return allowedTools;
}
