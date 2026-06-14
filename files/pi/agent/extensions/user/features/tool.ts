import type {
	ExtensionAPI,
	SessionStartEvent,
	Theme,
} from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import { refreshCurrentFocusTools } from "../lib/focus";
import { policyRegistry } from "../lib/policy";
import { ensureProjectUserSettingsTrusted } from "../lib/project-settings";
import {
	type ProjectToolSummary,
	markFailedProjectToolResult,
	registerBuiltInTools,
	registerProjectTools,
	toolRegistry,
} from "../lib/tool";

function formatProjectToolSummary(
	tools: readonly ProjectToolSummary[],
	theme: Theme,
): string {
	const dim = (text: string): string => theme.fg("dim", text);
	const sortedTools = tools.reduce<ProjectToolSummary[]>((sorted, tool) => {
		const insertIndex = sorted.findIndex(
			(candidate) => tool.name.localeCompare(candidate.name) < 0,
		);
		if (insertIndex === -1) {
			sorted.push(tool);
		} else {
			sorted.splice(insertIndex, 0, tool);
		}
		return sorted;
	}, []);
	const lines = sortedTools.map((tool) => {
		const commandLabel = `${tool.commandCount} cmd${tool.commandCount === 1 ? "" : "s"}`;
		return dim(`  ${tool.name} (${commandLabel})`);
	});
	return [theme.fg("mdHeading", "[Project Tools]"), ...lines].join("\n");
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
				ctx.ui.notify(
					formatProjectToolSummary(projectTools, ctx.ui.theme),
					"info",
				);
			}, 50);
		}
	});
	pi.on("tool_result", async (event) =>
		markFailedProjectToolResult(projectToolNames, event),
	);
}

export default { name: "tool", register } satisfies Feature;
