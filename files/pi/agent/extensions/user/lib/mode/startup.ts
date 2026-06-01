import { readFileSync } from "node:fs";
import {
	type ExtensionAPI,
	type ExtensionContext,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import {
	DEFAULT_MODE,
	MODE_NAMES,
	MODE_STATE_TYPE,
	type ModeName,
	normalizeModeName,
} from "./definitions";

type ModeStateEntry = { mode?: ModeName };

type ModeSettings = {
	permissionMode?: unknown;
};

type CustomSessionEntry = {
	type: string;
	customType?: string;
	data?: ModeStateEntry;
};

function getConfiguredDefaultMode(
	cwd: string,
	onWarning?: (message: string) => void,
): ModeName | undefined {
	try {
		const settingsManager = SettingsManager.create(cwd);
		const projectMode = (settingsManager.getProjectSettings() as ModeSettings)
			.permissionMode;
		if (projectMode !== undefined) {
			const mode = normalizeModeName(projectMode);
			if (mode) return mode;
			onWarning?.(
				`Invalid pi permissionMode in project settings: ${String(projectMode)}. Use one of: ${MODE_NAMES.join(", ")}.`,
			);
			return undefined;
		}

		const globalMode = (settingsManager.getGlobalSettings() as ModeSettings)
			.permissionMode;
		if (globalMode !== undefined) {
			const mode = normalizeModeName(globalMode);
			if (mode) return mode;
			onWarning?.(
				`Invalid pi permissionMode in global settings: ${String(globalMode)}. Use one of: ${MODE_NAMES.join(", ")}.`,
			);
		}
	} catch {
		// SettingsManager throws on malformed JSON; treat as absent rather than failing startup.
	}
	return undefined;
}

export function getStartupMode(
	pi: ExtensionAPI,
	cwd: string,
	persistedMode?: ModeName,
	onWarning?: (message: string) => void,
	inheritedMode?: ModeName,
): ModeName {
	const flagValue = pi.getFlag("permission-mode");
	const flagMode = normalizeModeName(flagValue);
	if (flagValue !== undefined && !flagMode) {
		onWarning?.(
			`Invalid --permission-mode value: ${String(flagValue)}. Use one of: ${MODE_NAMES.join(", ")}.`,
		);
	}
	const configuredMode = getConfiguredDefaultMode(cwd, onWarning);
	return (
		inheritedMode ?? flagMode ?? persistedMode ?? configuredMode ?? DEFAULT_MODE
	);
}

function findPersistedModeInEntries(
	entries: readonly CustomSessionEntry[],
): ModeName | undefined {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type === "custom" && entry.customType === MODE_STATE_TYPE) {
			return normalizeModeName(entry.data?.mode);
		}
	}
	return undefined;
}

export function findPersistedMode(ctx: ExtensionContext): ModeName | undefined {
	return findPersistedModeInEntries(
		ctx.sessionManager.getEntries() as readonly CustomSessionEntry[],
	);
}

export function findPersistedModeInSessionFile(
	sessionFile?: string,
): ModeName | undefined {
	if (!sessionFile) return undefined;

	try {
		const entries = readFileSync(sessionFile, "utf8")
			.split(/\r?\n/u)
			.filter(Boolean)
			.map((line) => JSON.parse(line) as CustomSessionEntry);
		return findPersistedModeInEntries(entries);
	} catch {
		return undefined;
	}
}
