import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isProjectToolAvailable } from "../tool/project";
import {
	ENTER_FOCUS_TOOL,
	EXIT_FOCUS_TOOL,
	FOCUS_EXIT_MODE,
	FOCUS_TRANSITION,
	type FocusDefinition,
	type FocusExitMode,
	type FocusTransition,
	getFocusExitMode,
} from "./definitions";

const ALWAYS_ALLOWED_TOOL_NAMES = ["multi_tool_use.parallel"] as const;
const NO_FOCUS_MANAGEMENT_TOOLS: readonly string[] = [];
const FOCUS_MANAGEMENT_TOOLS_BY_TRANSITION_AND_EXIT_MODE: Record<
	FocusTransition,
	Record<FocusExitMode, readonly string[]>
> = {
	[FOCUS_TRANSITION.AUTO]: {
		[FOCUS_EXIT_MODE.SINGLE_TURN]: [ENTER_FOCUS_TOOL],
		[FOCUS_EXIT_MODE.EXPLICIT]: [EXIT_FOCUS_TOOL],
	},
	[FOCUS_TRANSITION.CONFIRM]: {
		[FOCUS_EXIT_MODE.SINGLE_TURN]: [ENTER_FOCUS_TOOL],
		[FOCUS_EXIT_MODE.EXPLICIT]: [EXIT_FOCUS_TOOL],
	},
	[FOCUS_TRANSITION.MANUAL]: {
		[FOCUS_EXIT_MODE.SINGLE_TURN]: NO_FOCUS_MANAGEMENT_TOOLS,
		[FOCUS_EXIT_MODE.EXPLICIT]: NO_FOCUS_MANAGEMENT_TOOLS,
	},
};

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
			"subagent",
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
): readonly string[] {
	return options?.includeManagementTools === false
		? NO_FOCUS_MANAGEMENT_TOOLS
		: FOCUS_MANAGEMENT_TOOLS_BY_TRANSITION_AND_EXIT_MODE[focus.transition][
				getFocusExitMode(focus)
			];
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
