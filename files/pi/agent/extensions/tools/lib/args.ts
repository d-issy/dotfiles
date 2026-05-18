import { ToolError } from "./errors.js";

export function normalizeStringOrArray(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (Array.isArray(value)) {
		return value.filter((v): v is string => typeof v === "string");
	}
	return [];
}

export function checkAbort(
	signal: AbortSignal | undefined,
	operation: string,
): void {
	if (signal?.aborted) throw new ToolError("aborted", operation, "");
}
