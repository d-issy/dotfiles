import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { colors, fg } from "../theme";
import { isProjectToolAvailable } from "../tool/project";
import { showFilterSelect } from "../ui";
import {
	BASE_FOCUS,
	BASE_FOCUS_TOOLS,
	ENTER_FOCUS_TOOL,
	EXIT_FOCUS_TOOL,
	type FocusDefinition,
	type FocusName,
	getFocusExitMode,
} from "./definitions";
import type { FocusRegistry } from "./registry";

const ALWAYS_ALLOWED_TOOL_NAMES = ["multi_tool_use.parallel"] as const;

function unique(names: readonly string[]): string[] {
	return [...new Set(names)];
}

function existingToolNames(pi: ExtensionAPI): Set<string> {
	return new Set(pi.getAllTools().map((tool) => tool.name));
}

function filterExisting(pi: ExtensionAPI, names: readonly string[]): string[] {
	const existing = existingToolNames(pi);
	return names.filter(
		(name) => existing.has(name) && isProjectToolAvailable(name),
	);
}

export function getBaseFocusTools(pi: ExtensionAPI): string[] {
	return filterExisting(
		pi,
		unique([...ALWAYS_ALLOWED_TOOL_NAMES, ...BASE_FOCUS_TOOLS]),
	);
}

export function getRoutableFocusTools(
	pi: ExtensionAPI,
	registry: FocusRegistry,
): string[] {
	const focusTools = registry
		.list()
		.filter((focus) => focus.transition !== "manual")
		.flatMap((focus) => getFocusTools(pi, focus, { includeExitFocus: false }));
	return filterExisting(
		pi,
		unique([...ALWAYS_ALLOWED_TOOL_NAMES, ...BASE_FOCUS_TOOLS, ...focusTools]),
	);
}

export function getFocusTools(
	pi: ExtensionAPI,
	focus: FocusDefinition,
	options?: { includeEnterFocus?: boolean; includeExitFocus?: boolean },
): string[] {
	const requested = focus.tools;
	const focusManagementTools =
		getFocusExitMode(focus) === "explicit"
			? options?.includeExitFocus === false
				? []
				: [EXIT_FOCUS_TOOL]
			: options?.includeEnterFocus === false
				? []
				: [ENTER_FOCUS_TOOL];
	return filterExisting(
		pi,
		unique([
			...ALWAYS_ALLOWED_TOOL_NAMES,
			...requested,
			...focusManagementTools,
		]),
	);
}

export function activateBaseFocusTools(
	pi: ExtensionAPI,
	registry?: FocusRegistry,
): string[] {
	const tools = registry
		? getRoutableFocusTools(pi, registry)
		: getBaseFocusTools(pi);
	pi.setActiveTools(tools);
	return tools;
}

export function activateFocusTools(
	pi: ExtensionAPI,
	focus: FocusDefinition | undefined,
	registry?: FocusRegistry,
): string[] {
	const tools = registry
		? unique([
				...getRoutableFocusTools(pi, registry),
				...(focus ? getFocusTools(pi, focus) : []),
			])
		: focus
			? getFocusTools(pi, focus)
			: getBaseFocusTools(pi);
	pi.setActiveTools(tools);
	return tools;
}

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
