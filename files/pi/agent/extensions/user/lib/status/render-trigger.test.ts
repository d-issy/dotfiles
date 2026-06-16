import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { createRenderTrigger } from "./render-trigger";

describe("createRenderTrigger", () => {
	it("triggers the current render callback", () => {
		const trigger = createRenderTrigger();
		let calls = 0;

		trigger.trigger();
		trigger.set(() => calls++);
		trigger.trigger();
		trigger.set(() => (calls += 10));
		trigger.trigger();
		trigger.set(undefined);
		trigger.trigger();

		assert.equal(calls, 11);
	});
});
