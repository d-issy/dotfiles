import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import type { UserExtensionServices } from "../lib/services";

function register(pi: ExtensionAPI, services: UserExtensionServices): void {
	pi.on("context", services.reminders.inject);
}

export function createSystemRemindersFeature(): Feature {
	return { name: "system-reminders", register };
}

export default createSystemRemindersFeature();
