import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import mvTool from "./mv";
import rmTool from "./rm";

export default function tools(pi: ExtensionAPI): void {
	mvTool(pi);
	rmTool(pi);
}
