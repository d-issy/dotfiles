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
import { activateModeTools, applyModeStatus } from "./ui";

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
			activateModeTools(pi, modeName);
			applyModeStatus(ctx, getMode(modeName));
		},
	};
}
