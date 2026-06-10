import type { ExtensionContext as PiExtensionContext } from "@earendil-works/pi-coding-agent";

type _PiExtensionContext = PiExtensionContext;

declare module "@earendil-works/pi-coding-agent" {
	interface ExtensionContext {
		/** Whether project-local trust is active for the current session context. */
		isProjectTrusted(): boolean;
	}
}
