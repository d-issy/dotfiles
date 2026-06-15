export type FocusRuntime = {
	restorePromptPending: boolean;
	focusReminderPending: boolean;
	resetFocusAtAgentEndPending: boolean;
	autoContinueFocusName?: string;
};

export function createFocusRuntime(): FocusRuntime {
	return {
		restorePromptPending: false,
		focusReminderPending: false,
		resetFocusAtAgentEndPending: false,
	};
}
