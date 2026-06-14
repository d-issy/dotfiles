import type {
	ExtensionAPI,
	SessionStartEvent,
	Theme,
} from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import {
	getCurrentFocusRegistry,
	refreshCurrentFocusTools,
} from "../lib/focus";
import { policyRegistry } from "../lib/policy";
import { ensureProjectUserSettingsTrusted } from "../lib/project-settings";
import {
	type ProjectToolSummary,
	markFailedProjectToolResult,
	registerBuiltInTools,
	registerProjectTools,
	toolRegistry,
} from "../lib/tool";

type ToolInfo = ReturnType<ExtensionAPI["getAllTools"]>[number];

type ProjectFocusToolGroup = {
	readonly name: string;
	readonly transition: string;
	readonly projectTools: readonly string[];
	readonly builtinTools: readonly string[];
	readonly otherTools: readonly string[];
};

function insertSorted(values: string[], value: string): string[] {
	const insertIndex = values.findIndex(
		(candidate) => value.localeCompare(candidate) < 0,
	);
	if (insertIndex === -1) return [...values, value];
	return [...values.slice(0, insertIndex), value, ...values.slice(insertIndex)];
}

function sortStrings(values: readonly string[]): string[] {
	return values.reduce<string[]>(
		(sorted, value) => insertSorted(sorted, value),
		[],
	);
}

function sortedToolNames(tools: readonly ProjectToolSummary[]): string[] {
	return sortStrings(tools.map((tool) => tool.name));
}

function formatToolNames(
	names: readonly string[],
	role: "accent" | "success" | "muted" | "warning",
	theme: Theme,
): string {
	return names.map((name) => theme.fg(role, name)).join(theme.fg("dim", ", "));
}

function formatToolPart(
	label: string,
	names: readonly string[],
	role: "accent" | "success" | "muted",
	theme: Theme,
): string | undefined {
	if (names.length === 0) return undefined;
	return `${theme.fg("dim", `${label}: `)}${formatToolNames(names, role, theme)}`;
}

function formatProjectGroup(
	group: ProjectFocusToolGroup,
	theme: Theme,
): string {
	const tools = [
		formatToolPart("project", group.projectTools, "success", theme),
		formatToolPart("builtin", group.builtinTools, "accent", theme),
		formatToolPart("other", group.otherTools, "muted", theme),
	]
		.filter((part) => part !== undefined)
		.join(theme.fg("dim", "; "));
	if (group.transition === "auto") {
		return `${theme.fg("dim", `  ${group.name} `)}${theme.fg("warning", "auto")}${theme.fg("dim", ": ")}${tools}`;
	}
	return `${theme.fg("dim", `  ${group.name}: `)}${tools}`;
}

function formatProjectSummary(
	groups: readonly ProjectFocusToolGroup[],
	unfocusedTools: readonly string[],
	theme: Theme,
): string {
	const lines = groups.map((group) => formatProjectGroup(group, theme));
	if (unfocusedTools.length > 0) {
		lines.push(
			`${theme.fg("warning", "  not in any focus: ")}${formatToolNames(unfocusedTools, "warning", theme)}`,
		);
	}
	return [theme.fg("mdHeading", "[Project]"), ...lines].join("\n");
}

function projectToolGroups(
	tools: readonly ProjectToolSummary[],
	allTools: readonly ToolInfo[],
): {
	readonly groups: readonly ProjectFocusToolGroup[];
	readonly unfocusedTools: readonly string[];
} {
	const projectToolNames = new Set(sortedToolNames(tools));
	const toolByName = new Map(allTools.map((tool) => [tool.name, tool]));
	const displayBuiltinToolNames = new Set(
		toolRegistry.list().map((tool) => tool.definition.name),
	);
	const focusedToolNames = new Set<string>();
	const groups: ProjectFocusToolGroup[] = [];
	for (const focus of getCurrentFocusRegistry().list()) {
		const settingsTools = focus.settingsTools ?? [];
		const projectTools = sortStrings(
			settingsTools.filter((toolName) => projectToolNames.has(toolName)),
		);
		const builtinTools = sortStrings(
			settingsTools.filter((toolName) => {
				const tool = toolByName.get(toolName);
				return (
					tool &&
					!projectToolNames.has(toolName) &&
					(tool.sourceInfo.source === "builtin" ||
						displayBuiltinToolNames.has(toolName))
				);
			}),
		);
		const otherTools = sortStrings(
			settingsTools.filter((toolName) => {
				const tool = toolByName.get(toolName);
				return (
					tool &&
					!projectToolNames.has(toolName) &&
					tool.sourceInfo.source !== "builtin" &&
					!displayBuiltinToolNames.has(toolName)
				);
			}),
		);
		if (
			projectTools.length === 0 &&
			builtinTools.length === 0 &&
			otherTools.length === 0
		) {
			continue;
		}
		for (const toolName of projectTools) focusedToolNames.add(toolName);
		groups.push({
			name: focus.name,
			transition: focus.transition,
			projectTools,
			builtinTools,
			otherTools,
		});
	}
	const unfocusedTools = sortedToolNames(tools).filter(
		(toolName) => !focusedToolNames.has(toolName),
	);
	return { groups, unfocusedTools };
}

function register(pi: ExtensionAPI): void {
	registerBuiltInTools();

	for (const { policy, definition } of toolRegistry.list()) {
		policyRegistry.register(policy);
		pi.registerTool(definition);
	}

	const projectToolNames = new Set<string>();
	pi.on("session_start", async (_event: SessionStartEvent, ctx) => {
		await ensureProjectUserSettingsTrusted(ctx);
		const projectTools = registerProjectTools(pi, ctx, projectToolNames);
		refreshCurrentFocusTools(pi);
		if (ctx.hasUI) {
			setTimeout(() => {
				const { groups, unfocusedTools } = projectToolGroups(
					projectTools,
					pi.getAllTools(),
				);
				if (groups.length === 0 && unfocusedTools.length === 0) return;
				ctx.ui.notify(
					formatProjectSummary(groups, unfocusedTools, ctx.ui.theme),
					"info",
				);
			}, 50);
		}
	});
	pi.on("tool_result", async (event) =>
		markFailedProjectToolResult(projectToolNames, event),
	);
}

export function createToolFeature(): Feature {
	return { name: "tool", dependsOn: ["focus"], register };
}

export default createToolFeature();
