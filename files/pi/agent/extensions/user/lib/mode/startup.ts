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
): ModeName {
	const flagValue = pi.getFlag("permission-mode");
	const flagMode = normalizeModeName(flagValue);
	if (flagValue !== undefined && !flagMode) {
		onWarning?.(
			`Invalid --permission-mode value: ${String(flagValue)}. Use one of: ${MODE_NAMES.join(", ")}.`,
		);
	}
	const configuredMode = getConfiguredDefaultMode(cwd, onWarning);
	return flagMode ?? persistedMode ?? configuredMode ?? DEFAULT_MODE;
}

export function findPersistedMode(ctx: ExtensionContext): ModeName | undefined {
	const entries =
		ctx.sessionManager.getEntries() as readonly CustomSessionEntry[];
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type === "custom" && entry.customType === MODE_STATE_TYPE) {
			return normalizeModeName(entry.data?.mode);
		}
	}
	return undefined;
}
