import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * A self-contained unit of the `user` extension (focus switching, status bar,
 * thinking effort, file tools, ...). Each feature registers its own flags,
 * commands, shortcuts, tools and event handlers against the pi extension API.
 */
export interface Feature {
	/** Identifier for logging / ordering; not surfaced in pi's UI. */
	readonly name: string;
	/** Wire this feature into pi. Called once at extension load. */
	register(pi: ExtensionAPI): void;
}
