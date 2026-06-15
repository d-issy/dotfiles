import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { isProjectUserSettingsTrusted } from "../project-settings";
import {
	BASE_FOCUS,
	FOCUS_REMINDER_TYPE,
	FOCUS_STATE_TYPE,
	type FocusDefinition,
	type FocusName,
} from "./definitions";
import { type FocusRegistry, loadFocusRegistry } from "./registry";
import type { FocusSharedState } from "./state";
import {
	activateBaseFocusTools,
	activateFocusTools,
	applyFocusStatus,
	getActiveFocusTools,
	getBaseFocusTools,
} from "./ui";

export type FocusStateEntry = {
	focus?: FocusName | typeof BASE_FOCUS;
};

export type FocusController = {
	readonly current: FocusName | typeof BASE_FOCUS;
	readonly active: FocusDefinition | undefined;
	readonly registry: FocusRegistry;
	loadProjectFocuses(ctx: ExtensionContext): void;
	enter(
		ctx: ExtensionContext,
		focusName: FocusName,
		options?: { persist?: boolean; force?: boolean },
	): FocusDefinition;
	leave(
		ctx: ExtensionContext,
		options?: { persist?: boolean; force?: boolean },
	): FocusDefinition | undefined;
	restore(
		ctx: ExtensionContext,
		focusName: FocusName | typeof BASE_FOCUS | undefined,
	): void;
	allowedToolNames(pi: ExtensionAPI): ReadonlySet<string>;
};

export function buildFocusRestorePrompt(focus: FocusDefinition): string {
	return `[FOCUS RESTORED: ${focus.name}]\n${focus.prompt}`;
}

export function isFocusReminderMessage(message: {
	role: string;
	customType?: string;
}): boolean {
	return (
		message.role === "custom" && message.customType === FOCUS_REMINDER_TYPE
	);
}

export function createFocusController(
	pi: ExtensionAPI,
	sharedState: FocusSharedState,
): FocusController {
	let registry: FocusRegistry = sharedState.registry;
	let currentFocusName: FocusName | typeof BASE_FOCUS = sharedState.currentName;
	let currentFocus: FocusDefinition | undefined = sharedState.activeDefinition;

	function persist(focusName: FocusName | typeof BASE_FOCUS): void {
		pi.appendEntry(FOCUS_STATE_TYPE, { focus: focusName });
	}

	function publish(): void {
		sharedState.setCurrent(currentFocusName, currentFocus, registry);
	}

	function apply(ctx: ExtensionContext, options?: { force?: boolean }): void {
		if (!options?.force && currentFocusName === sharedState.currentName) return;
		publish();
		activateFocusTools(pi, currentFocus);
		applyFocusStatus(ctx, currentFocus);
	}

	function restoreBase(ctx: ExtensionContext): void {
		currentFocusName = BASE_FOCUS;
		currentFocus = undefined;
		activateBaseFocusTools(pi);
		applyFocusStatus(ctx, undefined);
		publish();
	}

	return {
		get current() {
			return currentFocusName;
		},
		get active() {
			return currentFocus;
		},
		get registry() {
			return registry;
		},
		loadProjectFocuses(ctx) {
			const result = loadFocusRegistry(ctx.cwd, {
				includeProject: isProjectUserSettingsTrusted(ctx),
				includeInteractive: ctx.hasUI,
			});
			registry = result.registry;
			for (const warning of result.warnings) ctx.ui.notify(warning, "warning");
			if (currentFocusName !== BASE_FOCUS) {
				currentFocus = registry.get(currentFocusName);
				if (!currentFocus) currentFocusName = BASE_FOCUS;
			}
			publish();
			activateFocusTools(pi, currentFocus);
			applyFocusStatus(ctx, currentFocus);
		},
		enter(ctx, focusName, options) {
			const focus = registry.get(focusName);
			if (!focus) throw new Error(`Unknown focus: ${focusName}`);
			const changed = currentFocusName !== focus.name;
			if (!changed && !options?.force) return focus;
			currentFocusName = focus.name;
			currentFocus = focus;
			if (options?.persist ?? true) persist(focus.name);
			apply(ctx, { force: true });
			return focus;
		},
		leave(ctx, options) {
			const previous = currentFocus;
			const changed = currentFocusName !== BASE_FOCUS;
			if (!changed && !options?.force) return previous;
			if (options?.persist ?? true) persist(BASE_FOCUS);
			restoreBase(ctx);
			return previous;
		},
		restore(ctx, focusName) {
			if (!focusName || focusName === BASE_FOCUS) {
				restoreBase(ctx);
				return;
			}
			const focus = registry.get(focusName);
			if (!focus) {
				restoreBase(ctx);
				return;
			}
			currentFocusName = focus.name;
			currentFocus = focus;
			activateFocusTools(pi, focus);
			applyFocusStatus(ctx, focus);
			publish();
		},
		allowedToolNames(focusPi) {
			return new Set(
				currentFocus
					? getActiveFocusTools(focusPi, currentFocus)
					: getBaseFocusTools(focusPi),
			);
		},
	};
}
