import type { JsonObject } from "./types";

export function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function str(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

export function obj(value: unknown): JsonObject {
	return isObject(value) ? value : {};
}

export function arr(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

export function parseJsonLine(line: string): JsonObject | undefined {
	if (line.trim() === "") return undefined;
	try {
		const value: unknown = JSON.parse(line);
		return isObject(value) ? value : undefined;
	} catch {
		return undefined;
	}
}

export function parseTime(value: unknown): number | undefined {
	if (typeof value === "number") return value;
	if (typeof value !== "string") return undefined;
	const time = Date.parse(value);
	return Number.isNaN(time) ? undefined : time;
}
