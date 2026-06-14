export type FocusRuntime = {
	restorePromptPending: boolean;
	resetFocusAtAgentEndPending: boolean;
};

export function createFocusRuntime(): FocusRuntime {
	return {
		restorePromptPending: false,
		resetFocusAtAgentEndPending: false,
	};
}
