import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const FOCUS_FLAG_NAME = "focus";

export function registerFocusFlag(pi: ExtensionAPI): void {
	pi.registerFlag(FOCUS_FLAG_NAME, {
		description:
			"Start pi locked to a focus. The selected focus is the only focus mode for this process.",
		type: "string",
	});
}

export function getRequestedFocusName(
	pi: Pick<ExtensionAPI, "getFlag">,
): string | undefined {
	const value = pi.getFlag(FOCUS_FLAG_NAME);
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}
