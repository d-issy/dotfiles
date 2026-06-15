import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	BASE_FOCUS,
	FOCUS_REMINDER_TYPE,
	FOCUS_STATE_TYPE,
	type FocusDefinition,
	type FocusName,
} from "./definitions";
import { isProjectUserSettingsTrusted } from "../project-settings";
import { type FocusRegistry, loadFocusRegistry } from "./registry";
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

const emptyRegistry = loadFocusRegistry("/", {
	includeProject: false,
}).registry;
let activeFocusName: FocusName | typeof BASE_FOCUS = BASE_FOCUS;
let activeFocusDefinition: FocusDefinition | undefined;
let activeFocusRegistry: FocusRegistry = emptyRegistry;

export function getCurrentFocusRegistry(): FocusRegistry {
	return activeFocusRegistry;
}

export function refreshCurrentFocusTools(pi: ExtensionAPI): void {
	activateFocusTools(pi, activeFocusDefinition, activeFocusRegistry);
}

export function buildFocusRestorePrompt(focus: FocusDefinition): string {
	return `[FOCUS RESTORED: ${focus.name}]\n${focus.prompt}`;
}

export function isFocusReminderMessage(message: {
	role: string;
	customType?: string;
	details?: unknown;
}): boolean {
	if (message.role !== "custom" || message.customType !== FOCUS_REMINDER_TYPE) {
		return false;
	}
	return (
		typeof message.details === "object" &&
		message.details !== null &&
		"focus" in message.details
	);
}

export function createFocusController(pi: ExtensionAPI): FocusController {
	let registry: FocusRegistry = emptyRegistry;
	let currentFocusName: FocusName | typeof BASE_FOCUS = activeFocusName;
	let currentFocus: FocusDefinition | undefined;

	function persist(focusName: FocusName | typeof BASE_FOCUS): void {
		pi.appendEntry(FOCUS_STATE_TYPE, { focus: focusName });
	}

	function apply(ctx: ExtensionContext, options?: { force?: boolean }): void {
		if (!options?.force && currentFocusName === activeFocusName) return;
		activeFocusName = currentFocusName;
		activeFocusDefinition = currentFocus;
		activeFocusRegistry = registry;
		activateFocusTools(pi, currentFocus, registry);
		applyFocusStatus(ctx, currentFocus);
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
			activeFocusName = currentFocusName;
			activeFocusDefinition = currentFocus;
			activeFocusRegistry = registry;
			activateFocusTools(pi, currentFocus, registry);
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
			currentFocusName = BASE_FOCUS;
			currentFocus = undefined;
			if (options?.persist ?? true) persist(BASE_FOCUS);
			activateBaseFocusTools(pi);
			applyFocusStatus(ctx, undefined);
			activeFocusName = BASE_FOCUS;
			activeFocusDefinition = undefined;
			activeFocusRegistry = registry;
			return previous;
		},
		restore(ctx, focusName) {
			if (!focusName || focusName === BASE_FOCUS) {
				currentFocusName = BASE_FOCUS;
				currentFocus = undefined;
				activateBaseFocusTools(pi);
				applyFocusStatus(ctx, undefined);
				activeFocusName = BASE_FOCUS;
				activeFocusDefinition = undefined;
				activeFocusRegistry = registry;
				return;
			}
			const focus = registry.get(focusName);
			if (!focus) {
				currentFocusName = BASE_FOCUS;
				currentFocus = undefined;
				activateBaseFocusTools(pi);
				applyFocusStatus(ctx, undefined);
				activeFocusName = BASE_FOCUS;
				activeFocusDefinition = undefined;
				activeFocusRegistry = registry;
				return;
			}
			currentFocusName = focus.name;
			currentFocus = focus;
			activateFocusTools(pi, focus, registry);
			applyFocusStatus(ctx, focus);
			activeFocusName = focus.name;
			activeFocusDefinition = focus;
			activeFocusRegistry = registry;
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
