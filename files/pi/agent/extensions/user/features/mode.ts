import type {
	BeforeAgentStartEvent,
	BeforeAgentStartEventResult,
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	ExtensionHandler,
	SessionStartEvent,
	ToolCallEvent,
	ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import type { Feature } from "../feature";
import {
	MODE_DEFINITIONS,
	MODE_NAMES,
	type ModeController,
	createModeController,
	findPersistedMode,
	getMode,
	getNextMode,
	getStartupMode,
	isModeName,
	registerBuiltInPolicies,
	showModeSelector,
} from "../lib/mode";
import { policyRegistry } from "../lib/policy";
import { filterCompletionsByPrefix } from "../lib/ui";

type BlockedToolCall = { block: true; reason: string };

function block(reason: string): BlockedToolCall {
	return { block: true, reason };
}

function completeMode(prefix: string): AutocompleteItem[] | null {
	return filterCompletionsByPrefix(
		MODE_DEFINITIONS.map((definition) => ({
			value: definition.name,
			label: definition.name,
			description: definition.description,
		})),
		prefix,
	);
}

const switchMode =
	(mode: ModeController) =>
	async (args: string, ctx: ExtensionCommandContext): Promise<void> => {
		const requestedMode = args.trim().split(/\s+/u)[0];
		if (!requestedMode) {
			const selectedMode = await showModeSelector(ctx, mode.current);
			if (!selectedMode) return;
			mode.setMode(ctx, selectedMode, { persist: true });
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

		mode.setMode(ctx, requestedMode, { persist: true });
		ctx.ui.notify(`Permission mode switched to ${requestedMode}.`, "info");
	};

const selectMode =
	(mode: ModeController) =>
	async (ctx: ExtensionContext): Promise<void> => {
		const selectedMode = await showModeSelector(ctx, mode.current);
		if (!selectedMode) return;
		mode.setMode(ctx, selectedMode, { persist: true });
		ctx.ui.notify(`Permission mode switched to ${selectedMode}.`, "info");
	};

const cycleMode =
	(mode: ModeController) =>
	async (ctx: ExtensionContext): Promise<void> => {
		const nextMode = getNextMode(mode.current);
		mode.setMode(ctx, nextMode, { persist: true });
		ctx.ui.notify(`Permission mode switched to ${nextMode}.`, "info");
	};

const injectSystemPrompt =
	(
		mode: ModeController,
	): ExtensionHandler<BeforeAgentStartEvent, BeforeAgentStartEventResult> =>
	async (event) => {
		const prompt = getMode(mode.current).systemPrompt;
		if (!prompt) return;

		return {
			systemPrompt: `${event.systemPrompt}\n\n[${mode.current.toUpperCase()} MODE]\n${prompt}`,
		};
	};

const restoreMode =
	(
		pi: ExtensionAPI,
		mode: ModeController,
	): ExtensionHandler<SessionStartEvent> =>
	async (_event, ctx) => {
		mode.setMode(
			ctx,
			getStartupMode(pi, ctx.cwd, findPersistedMode(ctx), (message) =>
				ctx.ui.notify(message, "warning"),
			),
			{ persist: false, force: true },
		);
	};

const guardToolCall =
	(
		mode: ModeController,
	): ExtensionHandler<ToolCallEvent, ToolCallEventResult> =>
	async (event) => {
		const notAllowed = policyRegistry.checkToolAllowed(mode.current, event);
		if (notAllowed) return block(notAllowed);

		const secret = policyRegistry.checkSecretBlock(mode.current, event);
		if (secret) return block(secret);
	};

function register(pi: ExtensionAPI): void {
	registerBuiltInPolicies();
	const mode = createModeController(pi);

	pi.registerFlag("permission-mode", {
		description: `Start in permission mode: ${MODE_NAMES.join(" / ")}`,
		type: "string",
	});
	pi.registerCommand("mode", {
		description: `Show or switch permission mode: ${MODE_NAMES.join(" / ")}`,
		getArgumentCompletions: completeMode,
		handler: switchMode(mode),
	});
	pi.registerShortcut("ctrl+m", {
		description: `Select permission mode: ${MODE_NAMES.join(" / ")}`,
		handler: selectMode(mode),
	});
	pi.registerShortcut("shift+tab", {
		description: `Cycle permission mode: ${MODE_NAMES.join(" / ")}`,
		handler: cycleMode(mode),
	});
	pi.on("before_agent_start", injectSystemPrompt(mode));
	pi.on("session_start", restoreMode(pi, mode));
	pi.on("tool_call", guardToolCall(mode));
}

export default { name: "mode", register } satisfies Feature;
