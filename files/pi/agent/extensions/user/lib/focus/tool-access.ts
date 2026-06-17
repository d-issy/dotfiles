import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isProjectToolAvailable } from "../tool/project";
import {
	ENTER_FOCUS_TOOL,
	EXIT_FOCUS_TOOL,
	type FocusDefinition,
	getFocusExitMode,
} from "./definitions";

const ALWAYS_ALLOWED_TOOL_NAMES = ["multi_tool_use.parallel"] as const;

function unique(names: readonly string[]): string[] {
	return [...new Set(names)];
}

function existingToolNames(pi: ExtensionAPI): Set<string> {
	return new Set(pi.getAllTools().map((tool) => tool.name));
}

function filterAvailable(pi: ExtensionAPI, names: readonly string[]): string[] {
	const existing = existingToolNames(pi);
	return names.filter(
		(name) => existing.has(name) && isProjectToolAvailable(name),
	);
}

export function getBaseFocusTools(
	pi: ExtensionAPI,
	options?: FocusToolAccessOptions,
): string[] {
	return filterAvailable(
		pi,
		unique([
			...ALWAYS_ALLOWED_TOOL_NAMES,
			...(options?.includeManagementTools === false ? [] : [ENTER_FOCUS_TOOL]),
		]),
	);
}

function declaredFocusToolNames(focus: FocusDefinition): string[] {
	return focus.tools.filter(
		(name) =>
			name !== ENTER_FOCUS_TOOL &&
			name !== EXIT_FOCUS_TOOL &&
			isProjectToolAvailable(name),
	);
}

type FocusToolAccessOptions = {
	readonly includeManagementTools?: boolean;
};

function activeFocusManagementToolNames(
	focus: FocusDefinition,
	options?: FocusToolAccessOptions,
): string[] {
	if (options?.includeManagementTools === false) return [];
	switch (getFocusExitMode(focus)) {
		case "explicit":
			return [EXIT_FOCUS_TOOL];
		case "single-turn":
			return [ENTER_FOCUS_TOOL];
	}
}

export function getActiveFocusTools(
	pi: ExtensionAPI,
	focus: FocusDefinition,
	options?: FocusToolAccessOptions,
): string[] {
	return filterAvailable(
		pi,
		unique([
			...ALWAYS_ALLOWED_TOOL_NAMES,
			...declaredFocusToolNames(focus),
			...activeFocusManagementToolNames(focus, options),
		]),
	);
}

export function activateBaseFocusTools(
	pi: ExtensionAPI,
	options?: FocusToolAccessOptions,
): string[] {
	const tools = getBaseFocusTools(pi, options);
	pi.setActiveTools(tools);
	return tools;
}

export function activateFocusTools(
	pi: ExtensionAPI,
	focus: FocusDefinition | undefined,
	options?: FocusToolAccessOptions,
): string[] {
	const tools = focus
		? getActiveFocusTools(pi, focus, options)
		: getBaseFocusTools(pi, options);
	pi.setActiveTools(tools);
	return tools;
}
