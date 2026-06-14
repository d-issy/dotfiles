import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { colors, fg } from "../theme";
import { isProjectToolAvailable } from "../tool/project";
import { showFilterSelect } from "../ui";
import {
	DEFAULT_FOCUS,
	DEFAULT_FOCUS_TOOLS,
	ENTER_FOCUS_TOOL,
	type FocusDefinition,
	type FocusName,
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

export function getDefaultFocusTools(pi: ExtensionAPI): string[] {
	return filterExisting(
		pi,
		unique([...ALWAYS_ALLOWED_TOOL_NAMES, ...DEFAULT_FOCUS_TOOLS]),
	);
}

export function getRoutableFocusTools(
	pi: ExtensionAPI,
	registry: FocusRegistry,
): string[] {
	const focusTools = registry
		.list()
		.filter((focus) => focus.transition !== "manual")
		.flatMap((focus) => getFocusTools(pi, focus));
	return filterExisting(
		pi,
		unique([
			...ALWAYS_ALLOWED_TOOL_NAMES,
			...DEFAULT_FOCUS_TOOLS,
			...focusTools,
		]),
	);
}

export function getFocusTools(
	pi: ExtensionAPI,
	focus: FocusDefinition,
	options?: { includeEnterFocus?: boolean },
): string[] {
	const requested = focus.tools;
	const focusManagementTools =
		options?.includeEnterFocus === false ? [] : [ENTER_FOCUS_TOOL];
	return filterExisting(
		pi,
		unique([
			...ALWAYS_ALLOWED_TOOL_NAMES,
			...requested,
			...focusManagementTools,
		]),
	);
}

export function activateDefaultFocusTools(
	pi: ExtensionAPI,
	registry?: FocusRegistry,
): string[] {
	const tools = registry
		? getRoutableFocusTools(pi, registry)
		: getDefaultFocusTools(pi);
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
			: getDefaultFocusTools(pi);
	pi.setActiveTools(tools);
	return tools;
}

export function applyFocusStatus(
	ctx: ExtensionContext,
	focus: FocusDefinition | undefined,
): void {
	if (!focus) {
		ctx.ui.setStatus("focus", fg(colors.muted, DEFAULT_FOCUS));
		return;
	}
	ctx.ui.setStatus("focus", fg(colors[focus.color ?? "accent"], focus.name));
}

export async function showFocusSelector(
	ctx: ExtensionContext,
	registry: FocusRegistry,
	currentFocusName: FocusName | typeof DEFAULT_FOCUS,
): Promise<FocusName | typeof DEFAULT_FOCUS | undefined> {
	const result = await showFilterSelect(ctx, {
		title: "Select Focus",
		items: [
			{
				value: DEFAULT_FOCUS,
				label: DEFAULT_FOCUS,
				description: "Return to the default routing state.",
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

	return result === DEFAULT_FOCUS || (result && registry.get(result))
		? result
		: undefined;
}
