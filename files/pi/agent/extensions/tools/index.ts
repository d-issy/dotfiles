import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import mvTool from "./mv.js";
import rmTool from "./rm.js";

export default function tools(pi: ExtensionAPI): void {
	mvTool(pi);
	rmTool(pi);
}
