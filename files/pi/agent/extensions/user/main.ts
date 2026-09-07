import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFastFeature } from "./features/fast";
import { registerModelSetsFeature } from "./features/model-sets";
import { registerStatusFeature } from "./features/status";
import { registerToolSummaryFeature } from "./features/tool-summary";

export default function user(pi: ExtensionAPI): void {
	const fast = registerFastFeature(pi);
	fast.onChange = registerStatusFeature(pi, fast.isEnabled);
	registerModelSetsFeature(pi, fast);
	registerToolSummaryFeature(pi);
}
