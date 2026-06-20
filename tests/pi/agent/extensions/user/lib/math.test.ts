import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { clamp } from "#pi-user/lib/math";

describe("clamp", () => {
	it("keeps values inside the inclusive range", () => {
		assert.equal(clamp(2, 1, 3), 2);
		assert.equal(clamp(0, 1, 3), 1);
		assert.equal(clamp(4, 1, 3), 3);
	});

	it("prefers the minimum when max is lower than min", () => {
		assert.equal(clamp(0, 5, 3), 5);
	});
});
