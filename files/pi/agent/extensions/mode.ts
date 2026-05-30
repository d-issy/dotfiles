import {
	type BashToolInput,
	type EditToolInput,
	type ExtensionAPI,
	type ExtensionContext,
	type FindToolInput,
	type GrepToolInput,
	type LsToolInput,
	type ReadToolInput,
	SettingsManager,
	type WriteToolInput,
} from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import { showFilterSelect } from "./lib/filter-select";
import { type ColorName, catppuccin, fg } from "./lib/theme";
import { type ModeName, policyRegistry } from "./tools/lib/policy";

function block(reason: string): { block: true; reason: string } {
	return { block: true, reason };
}

type Mode = {
	name: ModeName;
	description: string;
	color: ColorName;
	systemPrompt?: string;
};

type ModeStateEntry = { mode?: ModeName };

type ModeSettings = {
	permissionMode?: unknown;
};

type CustomSessionEntry = {
	type: string;
	customType?: string;
	data?: ModeStateEntry;
};

const MODE_DEFINITIONS: readonly Mode[] = [
	{
		name: "read",
		description: "Default read-only mode.",
		color: "blue",
		systemPrompt:
			"You are in read mode. Use the currently active tools to inspect the repository, summarize findings, run explicitly allowed read-only checks, and propose plans. If the task requires file changes, ask the user to switch to write or yolo mode.",
	},
	{
		name: "write",
		description: "Read and write files.",
		color: "green",
		systemPrompt:
			"You are in write mode. Inspect and modify files using the currently active tools. You may run explicitly allowed project tools when they are active.",
	},
	{
		name: "yolo",
		description: "Read, write, edit, and run shell commands.",
		color: "red",
	},
];

const DEFAULT_MODE: ModeName = "read";
const MODE_STATE_TYPE = "mode";
const MODES = new Map(MODE_DEFINITIONS.map((mode) => [mode.name, mode]));
const MODE_NAMES = MODE_DEFINITIONS.map((mode) => mode.name);

const READ_MODES: readonly ModeName[] = ["read", "write", "yolo"];
const WRITE_MODES: readonly ModeName[] = ["write", "yolo"];
const NAVIGATE_MODES: readonly ModeName[] = ["read", "write", "yolo"];

function registerBuiltInPolicies(): void {
	policyRegistry.register<BashToolInput>({
		name: "bash",
		allowedModes: ["yolo"],
		notAllowedReason: (mode) =>
			`Running bash commands is disabled in ${mode} mode.`,
	});
	policyRegistry.register<ReadToolInput>({
		name: "read",
		allowedModes: READ_MODES,
		extractSecretPaths: (input) => [input.path],
		secretBlockReason: (mode) =>
			`Reading secret files is disabled in ${mode} mode.`,
	});
	policyRegistry.register<WriteToolInput>({
		name: "write",
		allowedModes: WRITE_MODES,
		extractSecretPaths: (input) => [input.path],
		secretBlockReason: (mode) =>
			`Writing to secret files is disabled in ${mode} mode.`,
	});
	policyRegistry.register<EditToolInput>({
		name: "edit",
		allowedModes: WRITE_MODES,
		extractSecretPaths: (input) => [input.path],
		secretBlockReason: (mode) =>
			`Writing to secret files is disabled in ${mode} mode.`,
	});
	policyRegistry.register<GrepToolInput>({
		name: "grep",
		allowedModes: NAVIGATE_MODES,
		extractSecretPaths: (input) => (input.path ? [input.path] : []),
		secretBlockReason: (mode) =>
			`Grepping secret files is disabled in ${mode} mode.`,
	});
	policyRegistry.register<FindToolInput>({
		name: "find",
		allowedModes: NAVIGATE_MODES,
	});
	policyRegistry.register<LsToolInput>({
		name: "ls",
		allowedModes: NAVIGATE_MODES,
	});
}

function isModeName(value: string): value is ModeName {
	return MODES.has(value as ModeName);
}

function normalizeModeName(value: unknown): ModeName | undefined {
	if (typeof value !== "string") return undefined;
	if (value === "explore") return "read";
	if (isModeName(value)) return value;
	return undefined;
}

function getMode(value: ModeName): Mode {
	const mode = MODES.get(value);
	if (!mode) throw new Error(`Unknown mode: ${value}`);
	return mode;
}

function getNextMode(currentMode: ModeName): ModeName {
	const currentIndex = MODE_NAMES.indexOf(currentMode);
	return MODE_NAMES[(currentIndex + 1) % MODE_NAMES.length];
}

async function showModeSelector(
	ctx: ExtensionContext,
	currentMode: ModeName,
): Promise<ModeName | undefined> {
	const result = await showFilterSelect(ctx, {
		title: "Select Mode",
		items: MODE_DEFINITIONS.map((mode) => ({
			value: mode.name,
			label: mode.name,
			description: mode.description,
		})),
		currentValue: currentMode,
	});

	return result && isModeName(result) ? result : undefined;
}

function setStatus(ctx: ExtensionContext, mode: Mode): void {
	ctx.ui.setStatus(MODE_STATE_TYPE, fg(catppuccin[mode.color], mode.name));
}

function setTools(pi: ExtensionAPI, modeName: ModeName): void {
	pi.setActiveTools(policyRegistry.getActiveToolsForMode(modeName));
}

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

function getStartupMode(
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

function findPersistedMode(ctx: ExtensionContext): ModeName | undefined {
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

export default function modeExtension(pi: ExtensionAPI): void {
	let currentMode: ModeName = DEFAULT_MODE;

	policyRegistry.clearListeners();
	registerBuiltInPolicies();

	pi.registerFlag("permission-mode", {
		description: `Start in permission mode: ${MODE_NAMES.join(" / ")}`,
		type: "string",
	});

	let currentContext: ExtensionContext | undefined;

	function setMode(
		ctx: ExtensionContext,
		modeName: ModeName,
		options: { persist: boolean; force?: boolean },
	): void {
		currentContext = ctx;
		if (modeName === currentMode && !options.force) return;
		const mode = getMode(modeName);
		if (modeName !== currentMode) {
			currentMode = modeName;
			if (options.persist) pi.appendEntry(MODE_STATE_TYPE, { mode: modeName });
		}
		setTools(pi, modeName);
		setStatus(ctx, mode);
	}

	policyRegistry.onChange(() => {
		setTools(pi, currentMode);
		if (currentContext) setStatus(currentContext, getMode(currentMode));
	});

	pi.registerCommand("permission-mode", {
		description: `Show or switch permission mode: ${MODE_NAMES.join(" / ")}`,
		getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
			const items = MODE_DEFINITIONS.map((mode) => ({
				value: mode.name,
				label: mode.name,
				description: mode.description,
			}));
			const filtered = items.filter((item) => item.value.startsWith(prefix));
			return filtered.length > 0 ? filtered : null;
		},
		handler: async (args, ctx) => {
			const requestedMode = args.trim().split(/\s+/u)[0];
			if (!requestedMode) {
				const selectedMode = await showModeSelector(ctx, currentMode);
				if (!selectedMode) return;
				setMode(ctx, selectedMode, { persist: true });
				ctx.ui.notify(`Permission mode switched to ${selectedMode}.`, "info");
				return;
			}

			if (!isModeName(requestedMode)) {
				ctx.ui.notify(
					`Unknown mode: ${requestedMode}. Use one of: ${MODE_NAMES.join(", ")}.`,
					"error",
				);
				return;
			}

			setMode(ctx, requestedMode, { persist: true });
			ctx.ui.notify(`Permission mode switched to ${requestedMode}.`, "info");
		},
	});

	pi.registerShortcut("shift+tab", {
		description: `Cycle permission mode: ${MODE_NAMES.join(" / ")}`,
		handler: async (ctx) => {
			const nextMode = getNextMode(currentMode);
			setMode(ctx, nextMode, { persist: true });
			ctx.ui.notify(`Permission mode switched to ${nextMode}.`, "info");
		},
	});

	pi.on("before_agent_start", async (event) => {
		const prompt = getMode(currentMode).systemPrompt;
		if (!prompt) return;

		return {
			systemPrompt: `${event.systemPrompt}\n\n[${currentMode.toUpperCase()} MODE]\n${prompt}`,
		};
	});

	pi.on("session_start", async (_event, ctx) => {
		setMode(
			ctx,
			getStartupMode(pi, ctx.cwd, findPersistedMode(ctx), (message) =>
				ctx.ui.notify(message, "warning"),
			),
			{ persist: false, force: true },
		);
		policyRegistry.setNotificationsEnabled(true);
	});

	pi.on("tool_call", async (event) => {
		const notAllowed = policyRegistry.checkToolAllowed(currentMode, event);
		if (notAllowed) return block(notAllowed);

		const secret = policyRegistry.checkSecretBlock(currentMode, event);
		if (secret) return block(secret);
	});
}
