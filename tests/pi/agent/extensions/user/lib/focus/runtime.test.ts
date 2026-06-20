import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { BASE_FOCUS } from "#pi-user/lib/focus/definitions";
import { createFocusRuntime } from "#pi-user/lib/focus/runtime";

describe("createFocusRuntime", () => {
	it("tracks reminder flags independently and consumes pending reminders", () => {
		const runtime = createFocusRuntime();

		assert.equal(runtime.restorePromptPending, false);
		assert.equal(runtime.consumeFocusReminderPending(), false);

		runtime.setRestorePromptPending(true);
		runtime.requestFocusReminder();
		runtime.setResetFocusAtAgentEndPending(true);
		runtime.setUserSelectedFocus(true);

		assert.equal(runtime.restorePromptPending, true);
		assert.equal(runtime.focusReminderPending, true);
		assert.equal(runtime.resetFocusAtAgentEndPending, true);
		assert.equal(runtime.userSelectedFocus, true);
		assert.equal(runtime.consumeFocusReminderPending(), true);
		assert.equal(runtime.consumeFocusReminderPending(), false);
	});

	it("uses transition ids to reject stale auto-continue wakeups", () => {
		const runtime = createFocusRuntime();

		const first = runtime.recordFocusChange("edit");
		const second = runtime.scheduleAutoContinue("explore");

		assert.deepEqual(first, { id: 1, focusName: "edit" });
		assert.deepEqual(runtime.latestTransition, second);
		assert.equal(runtime.pendingAutoContinue, second);
		assert.equal(runtime.isCurrentTransition(first.id), false);
		assert.equal(runtime.isCurrentTransition(second.id), true);
		assert.equal(runtime.isCurrentTransition(undefined), true);
		assert.deepEqual(runtime.consumeAutoContinue(), second);
		assert.equal(runtime.consumeAutoContinue(), undefined);
	});

	it("can cancel pending auto-continue without changing the latest transition", () => {
		const runtime = createFocusRuntime();
		const transition = runtime.scheduleAutoContinue(BASE_FOCUS);

		runtime.cancelAutoContinue();

		assert.equal(runtime.pendingAutoContinue, undefined);
		assert.deepEqual(runtime.latestTransition, transition);
	});
});
