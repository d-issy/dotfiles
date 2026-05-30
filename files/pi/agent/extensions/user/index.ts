import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Feature } from "./lib/feature";
import modeFeature from "./mode";
import statusFeature from "./status";
import thinkingFeature from "./thinking";
import fileToolsFeature from "./tool";

const features: readonly Feature[] = [
	modeFeature,
	statusFeature,
	thinkingFeature,
	fileToolsFeature,
];

export default function user(pi: ExtensionAPI): void {
	for (const feature of features) feature.register(pi);
}
