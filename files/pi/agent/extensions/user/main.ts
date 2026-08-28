import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFastFeature } from "./features/fast";
import { registerStatusFeature } from "./features/status";

export default function user(pi: ExtensionAPI): void {
	const isFastEnabled = registerFastFeature(pi);
	registerStatusFeature(pi, isFastEnabled);
}
