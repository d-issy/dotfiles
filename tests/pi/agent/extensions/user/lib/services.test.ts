import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { BASE_FOCUS } from "#pi-user/lib/focus/definitions";
import { createUserExtensionServices } from "#pi-user/lib/services";

describe("createUserExtensionServices", () => {
	it("creates independent focus, reminder, and tool services", () => {
		const services = createUserExtensionServices();

		assert.equal(services.focus.currentFocusName, BASE_FOCUS);
		assert.equal(services.focus.activeFocusDefinition, undefined);
		assert.equal(typeof services.reminders.inject, "function");
		assert.deepEqual(services.tools.list(), []);
	});
});
