import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { filterCompletionsByPrefix } from "./lib/completions";
import type { Feature } from "./lib/feature";
import {
	DEFAULT_MODE,
	MODE_DEFINITIONS,
	MODE_NAMES,
	MODE_STATE_TYPE,
	type ModeName,
	findPersistedMode,
	getMode,
	getNextMode,
	getStartupMode,
	isModeName,
	registerBuiltInPolicies,
	applyModeStatus,
	activateModeTools,
	showModeSelector,
} from "./lib/mode";
import { policyRegistry } from "./lib/policy";

function block(reason: string): { block: true; reason: string } {
	return { block: true, reason };
}

function register(pi: ExtensionAPI): void {
	let currentMode: ModeName = DEFAULT_MODE;

	registerBuiltInPolicies();

	pi.registerFlag("permission-mode", {
		description: `Start in permission mode: ${MODE_NAMES.join(" / ")}`,
		type: "string",
	});

	function setMode(
		ctx: ExtensionContext,
		modeName: ModeName,
		options: { persist: boolean; force?: boolean },
	): void {
		const changed = modeName !== currentMode;
		if (!changed && !options.force) return;

		if (changed && options.persist) {
			pi.appendEntry(MODE_STATE_TYPE, { mode: modeName });
		}
		currentMode = modeName;
		activateModeTools(pi, modeName);
		applyModeStatus(ctx, getMode(modeName));
	}

	pi.registerCommand("permission-mode", {
		description: `Show or switch permission mode: ${MODE_NAMES.join(" / ")}`,
		getArgumentCompletions: (prefix) =>
			filterCompletionsByPrefix(
				MODE_DEFINITIONS.map((mode) => ({
					value: mode.name,
					label: mode.name,
					description: mode.description,
				})),
				prefix,
			),
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
	});

	pi.on("tool_call", async (event) => {
		const notAllowed = policyRegistry.checkToolAllowed(currentMode, event);
		if (notAllowed) return block(notAllowed);

		const secret = policyRegistry.checkSecretBlock(currentMode, event);
		if (secret) return block(secret);
	});
}

export default { name: "mode", register } satisfies Feature;
