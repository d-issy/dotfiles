import {
	type ExtensionAPI,
	type ExtensionContext,
	isToolCallEventType,
} from "@earendil-works/pi-coding-agent";
import { type ColorName, catppuccin, fg } from "./lib/theme.js";

const SECRET_PATTERNS: readonly RegExp[] = [
	/(^|\/)\.env(\..+)?$/,
	/(^|\/)\.envrc$/,
];

function isSecretPath(path: string): boolean {
	return SECRET_PATTERNS.some((re) => re.test(path));
}

function block(reason: string): { block: true; reason: string } {
	return { block: true, reason };
}

type ModeName = "yolo" | "edit" | "explore";

type Mode = {
	name: ModeName;
	description: string;
	color: ColorName;
	tools?: readonly string[];
	startupFlag?: string;
	systemPrompt?: string;
};

type ModeStateEntry = { mode?: ModeName };

type CustomSessionEntry = {
	type: string;
	customType?: string;
	data?: ModeStateEntry;
};

const MODE_DEFINITIONS: readonly Mode[] = [
	{
		name: "yolo",
		description: "Default mode. Use all available tools normally.",
		color: "yellow",
	},
	{
		name: "edit",
		description: "Read and write files, but no bash commands.",
		color: "green",
		tools: ["read", "write", "edit", "grep", "find", "ls"],
		startupFlag: "edit",
		systemPrompt:
			"You are in edit mode. You can read and edit files using read, write, edit, grep, find, and ls. Do not run bash commands. Inspect, modify, and create files, but leave shell execution to the user.",
	},
	{
		name: "explore",
		description: "Read-only exploration mode.",
		color: "blue",
		tools: ["read", "grep", "find", "ls"],
		startupFlag: "explore",
		systemPrompt:
			"You are in explore mode. Use only read-only exploration tools: read, grep, find, and ls. Inspect the repository and propose plans, but do not modify files.",
	},
];

const DEFAULT_MODE: ModeName = "yolo";
const MODE_STATE_TYPE = "mode";
const MODES = new Map(MODE_DEFINITIONS.map((mode) => [mode.name, mode]));
const MODE_NAMES = MODE_DEFINITIONS.map((mode) => mode.name);

function isModeName(value: string): value is ModeName {
	return MODES.has(value as ModeName);
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

function formatModeList(): string {
	return MODE_DEFINITIONS.map(
		(mode) => `${mode.name.padEnd(8)} ${mode.description}`,
	).join("\n");
}

function setStatus(ctx: ExtensionContext, mode: Mode): void {
	ctx.ui.setStatus(MODE_STATE_TYPE, fg(catppuccin[mode.color], mode.name));
}

function setTools(pi: ExtensionAPI, mode: Mode): void {
	const tools = mode.tools ?? pi.getAllTools().map((tool) => tool.name);
	pi.setActiveTools([...tools]);
}

function getStartupMode(pi: ExtensionAPI, persistedMode?: ModeName): ModeName {
	const flagMode = MODE_DEFINITIONS.find(
		(mode) => mode.startupFlag && pi.getFlag(mode.startupFlag) === true,
	)?.name;
	return flagMode ?? persistedMode ?? DEFAULT_MODE;
}

function findPersistedMode(ctx: ExtensionContext): ModeName | undefined {
	const entries =
		ctx.sessionManager.getEntries() as readonly CustomSessionEntry[];
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type === "custom" && entry.customType === MODE_STATE_TYPE) {
			return entry.data?.mode;
		}
	}
	return undefined;
}

export default function modeExtension(pi: ExtensionAPI): void {
	let currentMode: ModeName = DEFAULT_MODE;

	for (const mode of MODE_DEFINITIONS) {
		if (!mode.startupFlag) continue;
		pi.registerFlag(mode.startupFlag, {
			description: `Start in ${mode.name} mode`,
			type: "boolean",
			default: false,
		});
	}

	function setMode(
		ctx: ExtensionContext,
		modeName: ModeName,
		options: { persist: boolean },
	): void {
		const mode = getMode(modeName);
		if (modeName !== currentMode) {
			currentMode = modeName;
			setTools(pi, mode);
			if (options.persist) pi.appendEntry(MODE_STATE_TYPE, { mode: modeName });
		}
		setStatus(ctx, mode);
	}

	pi.registerCommand("mode", {
		description: `Show or switch mode: ${MODE_NAMES.join(" / ")}`,
		handler: async (args, ctx) => {
			const requestedMode = args.trim().split(/\s+/)[0];
			if (!requestedMode) {
				ctx.ui.notify(
					`Current mode: ${currentMode}\n\nUsage: /mode <${MODE_NAMES.join("|")}>\n\n${formatModeList()}`,
					"info",
				);
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
			ctx.ui.notify(`Mode switched to ${requestedMode}.`, "info");
		},
	});

	pi.registerShortcut("shift+tab", {
		description: `Cycle mode: ${MODE_NAMES.join(" / ")}`,
		handler: async (ctx) => {
			const nextMode = getNextMode(currentMode);
			setMode(ctx, nextMode, { persist: true });
			ctx.ui.notify(`Mode switched to ${nextMode}.`, "info");
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
		setMode(ctx, getStartupMode(pi, findPersistedMode(ctx)), {
			persist: false,
		});
	});

	pi.on("tool_call", async (event) => {
		if (currentMode === "edit") {
			if (isToolCallEventType("bash", event)) {
				return block("Running bash commands is disabled in edit mode.");
			}
			if (
				(isToolCallEventType("write", event) ||
					isToolCallEventType("edit", event)) &&
				isSecretPath(event.input.path)
			) {
				return block("Writing to secret files is disabled in edit mode.");
			}
			if (
				isToolCallEventType("read", event) &&
				isSecretPath(event.input.path)
			) {
				return block("Reading secret files is disabled in edit mode.");
			}
			if (
				isToolCallEventType("grep", event) &&
				event.input.path &&
				isSecretPath(event.input.path)
			) {
				return block("Grepping secret files is disabled in edit mode.");
			}
			return;
		}

		if (currentMode === "explore") {
			if (
				isToolCallEventType("read", event) &&
				isSecretPath(event.input.path)
			) {
				return block("Reading secret files is disabled in explore mode.");
			}
			if (
				isToolCallEventType("grep", event) &&
				event.input.path &&
				isSecretPath(event.input.path)
			) {
				return block("Grepping secret files is disabled in explore mode.");
			}
		}
	});
}
