import type {
	ExtensionAPI,
	SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import { policyRegistry } from "../lib/policy";
import {
	markFailedProjectToolResult,
	registerBuiltInTools,
	registerProjectTools,
	toolRegistry,
} from "../lib/tool";

function register(pi: ExtensionAPI): void {
	registerBuiltInTools();

	for (const { policy, definition } of toolRegistry.list()) {
		policyRegistry.register(policy);
		pi.registerTool(definition);
	}

	const projectToolNames = new Set<string>();
	pi.on("session_start", async (_event: SessionStartEvent, ctx) => {
		registerProjectTools(pi, ctx, projectToolNames);
	});
	pi.on("tool_result", async (event) =>
		markFailedProjectToolResult(projectToolNames, event),
	);
}

export default { name: "tool", register } satisfies Feature;
