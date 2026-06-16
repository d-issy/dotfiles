import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
	formatCount,
	formatCwd,
	formatPercent,
	pickRemainingColor,
} from "./format";
import { colors } from "../theme";

describe("status format helpers", () => {
	it("formats counts with compact suffixes", () => {
		assert.equal(formatCount(-1), "0");
		assert.equal(formatCount(Number.NaN), "0");
		assert.equal(formatCount(999.6), "1000");
		assert.equal(formatCount(1_250), "1.3K");
		assert.equal(formatCount(12_500), "13K");
		assert.equal(formatCount(1_250_000), "1.3M");
		assert.equal(formatCount(12_500_000), "13M");
	});

	it("formats percents with one decimal place", () => {
		assert.equal(formatPercent(12), "12.0%");
		assert.equal(formatPercent(12.34), "12.3%");
	});

	it("keeps cwd labels short", () => {
		assert.equal(formatCwd("/tmp/example-project"), "example-project");
		assert.equal(formatCwd("/"), "/");
	});

	it("selects remaining-context colors by threshold", () => {
		assert.equal(pickRemainingColor(50), colors.positive);
		assert.equal(pickRemainingColor(49.9), colors.caution);
		assert.equal(pickRemainingColor(20), colors.caution);
		assert.equal(pickRemainingColor(19.9), colors.alert);
	});
});
