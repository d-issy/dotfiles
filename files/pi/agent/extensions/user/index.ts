import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Feature } from "./feature";
import modeFeature from "./features/mode";
import statusFeature from "./features/status";
import thinkingFeature from "./features/thinking";
import fileToolsFeature from "./features/tool";

const features: readonly Feature[] = [
	modeFeature,
	statusFeature,
	thinkingFeature,
	fileToolsFeature,
];

export default function user(pi: ExtensionAPI): void {
	for (const feature of features) feature.register(pi);
}
