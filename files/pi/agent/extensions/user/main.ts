import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerStatusFeature from "./features/status";

export default function user(pi: ExtensionAPI): void {
	registerStatusFeature(pi);
}
