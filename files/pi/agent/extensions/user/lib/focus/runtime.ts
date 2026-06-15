export type FocusRuntime = {
	restorePromptPending: boolean;
	focusReminderPending: boolean;
	resetFocusAtAgentEndPending: boolean;
	userSelectedFocus: boolean;
	autoContinueFocusName?: string;
};

export function createFocusRuntime(): FocusRuntime {
	return {
		restorePromptPending: false,
		focusReminderPending: false,
		resetFocusAtAgentEndPending: false,
		userSelectedFocus: false,
	};
}
