import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import { policyRegistry } from "../lib/policy";
import { registerBuiltInTools, toolRegistry } from "../lib/tool";

function register(pi: ExtensionAPI): void {
	registerBuiltInTools();

	for (const { policy, definition } of toolRegistry.list()) {
		policyRegistry.register(policy);
		pi.registerTool(definition);
	}
}

export default { name: "tool", register } satisfies Feature;
