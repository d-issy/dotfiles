import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function notifyWarning(ctx: ExtensionContext, message: string): void {
	ctx.ui.notify(message, "warning");
}
