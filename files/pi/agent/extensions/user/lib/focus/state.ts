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
	readonly lockedFocusName: FocusName | undefined;
	readonly registry: FocusRegistry;
	setFocusState(
		name: FocusName | typeof BASE_FOCUS,
		definition: FocusDefinition | undefined,
		registry: FocusRegistry,
	): void;
	setLockedFocusName(name: FocusName | undefined): void;
};

export function createFocusSharedState(): FocusSharedState {
	let currentFocusName: FocusName | typeof BASE_FOCUS = BASE_FOCUS;
	let activeFocusDefinition: FocusDefinition | undefined;
	let lockedFocusName: FocusName | undefined;
	let registry: FocusRegistry = emptyRegistry;

	return {
		get currentFocusName() {
			return currentFocusName;
		},
		get activeFocusDefinition() {
			return activeFocusDefinition;
		},
		get lockedFocusName() {
			return lockedFocusName;
		},
		get registry() {
			return registry;
		},
		setFocusState(nextName, nextDefinition, nextRegistry) {
			currentFocusName = nextName;
			activeFocusDefinition = nextDefinition;
			registry = nextRegistry;
		},
		setLockedFocusName(name) {
			lockedFocusName = name;
		},
	};
}
