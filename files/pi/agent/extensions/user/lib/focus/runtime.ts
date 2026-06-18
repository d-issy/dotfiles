import { BASE_FOCUS, type FocusName } from "./definitions";

/**
 * In-memory focus lifecycle state for the current extension instance.
 *
 * Keep mutations behind these methods so future focus/tool features cannot leave
 * stale auto-continue wakeups or reminder flags behind by setting fields out of
 * order. Every focus change gets a monotonically increasing transition id; queued
 * reminders carry that id and are ignored if a newer focus change wins the race.
 */
export type FocusAutoContinue = {
	readonly id: number;
	readonly focusName: FocusName | typeof BASE_FOCUS;
};

export type FocusRuntime = {
	readonly restorePromptPending: boolean;
	readonly focusReminderPending: boolean;
	readonly resetFocusAtAgentEndPending: boolean;
	readonly userSelectedFocus: boolean;
	readonly lockedFocusName: FocusName | undefined;
	readonly latestTransition: FocusAutoContinue;
	readonly pendingAutoContinue: FocusAutoContinue | undefined;
	setRestorePromptPending(pending: boolean): void;
	setFocusReminderPending(pending: boolean): void;
	setLockedFocusName(focusName: FocusName | undefined): void;
	requestFocusReminder(): void;
	consumeFocusReminderPending(): boolean;
	setResetFocusAtAgentEndPending(pending: boolean): void;
	setUserSelectedFocus(selected: boolean): void;
	recordFocusChange(
		focusName: FocusName | typeof BASE_FOCUS,
	): FocusAutoContinue;
	scheduleAutoContinue(
		focusName: FocusName | typeof BASE_FOCUS,
	): FocusAutoContinue;
	cancelAutoContinue(): void;
	consumeAutoContinue(): FocusAutoContinue | undefined;
	isCurrentTransition(transitionId: number | undefined): boolean;
};

export function createFocusRuntime(): FocusRuntime {
	let restorePromptPending = false;
	let focusReminderPending = false;
	let resetFocusAtAgentEndPending = false;
	let userSelectedFocus = false;
	let lockedFocusName: FocusName | undefined;
	let nextTransitionId = 1;
	let latestTransition: FocusAutoContinue = { id: 0, focusName: BASE_FOCUS };
	let pendingAutoContinue: FocusAutoContinue | undefined;

	const bumpTransition = (
		focusName: FocusName | typeof BASE_FOCUS,
	): FocusAutoContinue => {
		latestTransition = { id: nextTransitionId++, focusName };
		return latestTransition;
	};

	return {
		get restorePromptPending() {
			return restorePromptPending;
		},
		get focusReminderPending() {
			return focusReminderPending;
		},
		get resetFocusAtAgentEndPending() {
			return resetFocusAtAgentEndPending;
		},
		get userSelectedFocus() {
			return userSelectedFocus;
		},
		get lockedFocusName() {
			return lockedFocusName;
		},
		get latestTransition() {
			return latestTransition;
		},
		get pendingAutoContinue() {
			return pendingAutoContinue;
		},
		setRestorePromptPending(pending) {
			restorePromptPending = pending;
		},
		setFocusReminderPending(pending) {
			focusReminderPending = pending;
		},
		setLockedFocusName(focusName) {
			lockedFocusName = focusName;
		},
		requestFocusReminder() {
			focusReminderPending = true;
		},
		consumeFocusReminderPending() {
			const pending = focusReminderPending;
			focusReminderPending = false;
			return pending;
		},
		setResetFocusAtAgentEndPending(pending) {
			resetFocusAtAgentEndPending = pending;
		},
		setUserSelectedFocus(selected) {
			userSelectedFocus = selected;
		},
		recordFocusChange(focusName) {
			const transition = bumpTransition(focusName);
			focusReminderPending = true;
			return transition;
		},
		scheduleAutoContinue(focusName) {
			const transition = bumpTransition(focusName);
			pendingAutoContinue = transition;
			focusReminderPending = true;
			return transition;
		},
		cancelAutoContinue() {
			pendingAutoContinue = undefined;
		},
		consumeAutoContinue() {
			const transition = pendingAutoContinue;
			pendingAutoContinue = undefined;
			return transition;
		},
		isCurrentTransition(transitionId) {
			return transitionId === undefined || transitionId === latestTransition.id;
		},
	};
}
