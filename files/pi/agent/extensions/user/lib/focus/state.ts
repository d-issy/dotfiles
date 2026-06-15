import {
	BASE_FOCUS,
	type FocusDefinition,
	type FocusName,
} from "./definitions";
import { type FocusRegistry, loadFocusRegistry } from "./registry";

const emptyRegistry = loadFocusRegistry("/", {
	includeProject: false,
}).registry;

export type FocusSharedState = {
	readonly currentFocusName: FocusName | typeof BASE_FOCUS;
	readonly activeFocusDefinition: FocusDefinition | undefined;
	readonly registry: FocusRegistry;
	setFocusState(
		name: FocusName | typeof BASE_FOCUS,
		definition: FocusDefinition | undefined,
		registry: FocusRegistry,
	): void;
};

export function createFocusSharedState(): FocusSharedState {
	let currentFocusName: FocusName | typeof BASE_FOCUS = BASE_FOCUS;
	let activeFocusDefinition: FocusDefinition | undefined;
	let registry: FocusRegistry = emptyRegistry;

	return {
		get currentFocusName() {
			return currentFocusName;
		},
		get activeFocusDefinition() {
			return activeFocusDefinition;
		},
		get registry() {
			return registry;
		},
		setFocusState(nextName, nextDefinition, nextRegistry) {
			currentFocusName = nextName;
			activeFocusDefinition = nextDefinition;
			registry = nextRegistry;
		},
	};
}
