import { type FocusSharedState, createFocusSharedState } from "./focus/state";
import { type ToolCatalog, toolCatalog } from "./tool";

export type UserExtensionServices = {
	readonly focus: FocusSharedState;
	readonly tools: ToolCatalog;
};

export function createUserExtensionServices(): UserExtensionServices {
	return {
		focus: createFocusSharedState(),
		tools: toolCatalog,
	};
}
