import { type FocusSharedState, createFocusSharedState } from "./focus/state";
import {
	type SystemReminderRegistry,
	createSystemReminderRegistry,
} from "./system-reminder";
import { type ToolCatalog, createToolCatalog } from "./tool";

export type UserExtensionServices = {
	readonly focus: FocusSharedState;
	readonly reminders: SystemReminderRegistry;
	readonly tools: ToolCatalog;
};

export function createUserExtensionServices(): UserExtensionServices {
	return {
		focus: createFocusSharedState(),
		reminders: createSystemReminderRegistry(),
		tools: createToolCatalog(),
	};
}
