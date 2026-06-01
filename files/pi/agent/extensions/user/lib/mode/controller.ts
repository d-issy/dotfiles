import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	DEFAULT_MODE,
	MODE_STATE_TYPE,
	type ModeName,
	getMode,
} from "./definitions";
import { policyRegistry } from "../policy";
import { activateModeTools, applyModeStatus } from "./ui";

export const MODE_REMINDER_TYPE = "system-reminder";

/** Render an allowed-tool list for prompts, or "none" when empty. */
export function formatAllowedTools(allowedTools: readonly string[]): string {
	return allowedTools.length > 0 ? allowedTools.join(", ") : "none";
}

export function getModeReminder(
	modeName: ModeName,
	allowedTools: readonly string[],
): string {
	const mode = getMode(modeName);
	const modeInstruction = mode.systemPrompt;
	const tools = formatAllowedTools(allowedTools);

	return `<system-reminder>
Permission mode changed while you were working.

Current mode: ${modeName}
Allowed tools now: ${tools}

${modeInstruction}

The tool names above are the complete current allowed tool set. If the user asks for a listed tool, call that tool rather than saying it is unavailable. Tool schemas may include tools that are blocked in the current mode; do not call tools that are not listed above.
Follow the current mode and current allowed tools. Do not rely on any earlier mode reminder.
</system-reminder>`;
}

/**
 * The shared shape of a mode-reminder custom message. Construction and
 * detection stay in one place; detection also accepts the previous
 * `details.activeTools` field so stale reminders from older sessions are
 * stripped from context. Callers add their own delivery-specific fields
 * (e.g. `role`/`timestamp` for context injection).
 */
export type ModeReminderPayload = {
	customType: string;
	content: string;
	display: boolean;
	details: { mode: ModeName; allowedTools: readonly string[] };
};

export function buildModeReminderPayload(
	modeName: ModeName,
	allowedTools: readonly string[],
): ModeReminderPayload {
	return {
		customType: MODE_REMINDER_TYPE,
		content: getModeReminder(modeName, allowedTools),
		display: false,
		details: { mode: modeName, allowedTools },
	};
}

export function isModeReminderMessage(message: {
	role: string;
	customType?: string;
	details?: unknown;
}): boolean {
	if (message.role !== "custom" || message.customType !== MODE_REMINDER_TYPE) {
		return false;
	}

	return (
		typeof message.details === "object" &&
		message.details !== null &&
		"mode" in message.details &&
		("allowedTools" in message.details || "activeTools" in message.details)
	);
}

function steerModeReminder(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	modeName: ModeName,
	allowedTools: readonly string[],
): void {
	if (ctx.isIdle()) return;

	pi.sendMessage(buildModeReminderPayload(modeName, allowedTools), {
		deliverAs: "steer",
		triggerTurn: true,
	});
}

export type SetModeOptions = {
	/** Persist the choice so the next session starts in this mode. */
	persist: boolean;
	/** Re-apply tools/status even when the mode is unchanged (used on startup). */
	force?: boolean;
};

/**
 * Holds the single source of truth for the active permission mode and the
 * transition logic. The `mode` feature constructs one of these and wires pi
 * events to it; the state machine itself lives here in `lib`.
 */
export type ModeController = {
	readonly current: ModeName;
	setMode(
		ctx: ExtensionContext,
		modeName: ModeName,
		options: SetModeOptions,
	): void;
};

export function createModeController(pi: ExtensionAPI): ModeController {
	let currentMode: ModeName = DEFAULT_MODE;

	return {
		get current() {
			return currentMode;
		},
		setMode(ctx, modeName, options) {
			const changed = modeName !== currentMode;
			if (!changed && !options.force) return;

			if (changed && options.persist) {
				pi.appendEntry(MODE_STATE_TYPE, { mode: modeName });
			}
			currentMode = modeName;
			const allowedTools = policyRegistry.getAllowedToolsForMode(modeName);
			activateModeTools(pi, modeName);
			applyModeStatus(ctx, getMode(modeName));
			if (changed) steerModeReminder(pi, ctx, modeName, allowedTools);
		},
	};
}
