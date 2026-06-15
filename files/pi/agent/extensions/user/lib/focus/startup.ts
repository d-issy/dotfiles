import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { BASE_FOCUS, FOCUS_STATE_TYPE, type FocusName } from "./definitions";
import type { FocusStateEntry } from "./controller";

type CustomSessionEntry = {
	type: string;
	customType?: string;
	data?: FocusStateEntry;
};

function normalizePersistedFocus(
	value: unknown,
): FocusName | typeof BASE_FOCUS | undefined {
	if (typeof value !== "string" || value.trim() === "") return undefined;
	return value;
}

function findPersistedFocusInEntries(
	entries: readonly CustomSessionEntry[],
): FocusName | typeof BASE_FOCUS | undefined {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type === "custom" && entry.customType === FOCUS_STATE_TYPE) {
			return normalizePersistedFocus(entry.data?.focus);
		}
	}
	return undefined;
}

export function findPersistedFocus(
	ctx: ExtensionContext,
): FocusName | typeof BASE_FOCUS | undefined {
	return findPersistedFocusInEntries(
		ctx.sessionManager.getEntries() as readonly CustomSessionEntry[],
	);
}
