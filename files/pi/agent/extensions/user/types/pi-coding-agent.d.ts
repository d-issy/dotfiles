import "@earendil-works/pi-coding-agent";

declare module "@earendil-works/pi-coding-agent" {
	interface ExtensionContext {
		/** Whether project-local trust is active for the current session context. */
		isProjectTrusted(): boolean;
	}
}
