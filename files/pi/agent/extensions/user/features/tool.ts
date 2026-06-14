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

type ProjectFocusToolGroup = {
	readonly name: string;
	readonly transition: string;
	readonly tools: readonly string[];
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

function formatProjectGroup(
	group: ProjectFocusToolGroup,
	theme: Theme,
): string {
	const tools = group.tools.join(", ");
	if (group.transition === "auto") {
		return `${theme.fg("dim", `  ${group.name} `)}${theme.fg("warning", "auto")}${theme.fg("dim", `: ${tools}`)}`;
	}
	return theme.fg("dim", `  ${group.name}: ${tools}`);
}

function formatProjectSummary(
	groups: readonly ProjectFocusToolGroup[],
	unfocusedTools: readonly string[],
	theme: Theme,
): string {
	const lines = groups.map((group) => formatProjectGroup(group, theme));
	if (unfocusedTools.length > 0) {
		lines.push(
			theme.fg("warning", `  not in any focus: ${unfocusedTools.join(", ")}`),
		);
	}
	return [theme.fg("mdHeading", "[Project]"), ...lines].join("\n");
}

function projectToolGroups(tools: readonly ProjectToolSummary[]): {
	readonly groups: readonly ProjectFocusToolGroup[];
	readonly unfocusedTools: readonly string[];
} {
	const projectToolNames = new Set(sortedToolNames(tools));
	const focusedToolNames = new Set<string>();
	const groups: ProjectFocusToolGroup[] = [];
	for (const focus of getCurrentFocusRegistry().list()) {
		const focusTools = sortStrings(
			focus.tools.filter((toolName) => projectToolNames.has(toolName)),
		);
		if (focusTools.length === 0) continue;
		for (const toolName of focusTools) focusedToolNames.add(toolName);
		groups.push({
			name: focus.name,
			transition: focus.transition,
			tools: focusTools,
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
		if (ctx.hasUI && projectTools.length > 0) {
			setTimeout(() => {
				const { groups, unfocusedTools } = projectToolGroups(projectTools);
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
