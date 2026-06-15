import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	BASE_FOCUS,
	type FocusDefinition,
	type FocusName,
} from "./definitions";
import { type FocusRegistry, loadFocusRegistry } from "./registry";
import { activateFocusTools } from "./tool-access";

const emptyRegistry = loadFocusRegistry("/", {
	includeProject: false,
}).registry;

export type FocusSharedState = {
	readonly currentName: FocusName | typeof BASE_FOCUS;
	readonly activeDefinition: FocusDefinition | undefined;
	readonly registry: FocusRegistry;
	setCurrent(
		name: FocusName | typeof BASE_FOCUS,
		definition: FocusDefinition | undefined,
		registry: FocusRegistry,
	): void;
	refreshTools(pi: ExtensionAPI): void;
};

export function createFocusSharedState(): FocusSharedState {
	let currentName: FocusName | typeof BASE_FOCUS = BASE_FOCUS;
	let activeDefinition: FocusDefinition | undefined;
	let registry: FocusRegistry = emptyRegistry;

	return {
		get currentName() {
			return currentName;
		},
		get activeDefinition() {
			return activeDefinition;
		},
		get registry() {
			return registry;
		},
		setCurrent(nextName, nextDefinition, nextRegistry) {
			currentName = nextName;
			activeDefinition = nextDefinition;
			registry = nextRegistry;
		},
		refreshTools(pi) {
			activateFocusTools(pi, activeDefinition);
		},
	};
}
