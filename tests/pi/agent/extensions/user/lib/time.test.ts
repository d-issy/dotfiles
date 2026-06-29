import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
	formatElapsedSeconds,
	formatHumanElapsed,
	formatLiveElapsed,
} from "#pi-user/lib/time";

describe("time formatting", () => {
	it("formats completed elapsed time without fractional seconds", () => {
		assert.equal(formatElapsedSeconds(9_200), "9s");
		assert.equal(formatHumanElapsed(9_200), "9s");
		assert.equal(formatHumanElapsed(72_300), "1m 12s");
	});

	it("formats live elapsed time without fractional seconds", () => {
		assert.equal(formatLiveElapsed(9_200), "9s");
		assert.equal(formatLiveElapsed(72_300), "1m 12s");
	});
});
