import assert from "node:assert/strict";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import { getThinkingLevels, isThinkingLevel } from "#pi-user/lib/thinking";

const model = {
	reasoning: true,
	thinkingLevelMap: {
		xhigh: null,
		max: "max",
	},
} as NonNullable<ExtensionContext["model"]>;

describe("thinking levels", () => {
	it("uses the levels supported by the current Pi model", () => {
		const levels = getThinkingLevels(model);

		assert.equal(levels.includes("xhigh"), false);
		assert.equal(levels.includes("max"), true);
		assert.equal(isThinkingLevel("max", levels), true);
		assert.equal(isThinkingLevel("xhigh", levels), false);
		assert.equal(isThinkingLevel("invalid", levels), false);
	});

	it("has no choices before Pi selects a model", () => {
		assert.deepEqual(getThinkingLevels(undefined), []);
	});
});
