import { describe, expect, it } from "vitest";
import {
	formatPercent,
	formatTokens,
	truncateMiddle,
} from "#pi-user/lib/status/format";

const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");
const plain = (value: string): string => value.replace(ansiPattern, "");

describe("formatTokens", () => {
	it.each([
		[0, "0"],
		[999, "999"],
		[999.4, "999"],
		[999.6, "1.0k"],
		[1_000, "1.0k"],
		[9_949, "9.9k"],
		[9_999, "10k"],
		[10_000, "10k"],
		[999_499, "999k"],
		[999_500, "1.0M"],
		[9_949_999, "9.9M"],
		[9_960_000, "10M"],
		[25_000_000, "25M"],
		[-5, "0"],
		[Number.NaN, "0"],
		[Number.POSITIVE_INFINITY, "0"],
	])("formats %s as %s", (value, expected) => {
		expect(formatTokens(value)).toBe(expected);
	});
});

describe("formatPercent", () => {
	it("keeps one decimal", () => {
		expect(formatPercent(4.24)).toBe("4.2%");
	});
});

describe("truncateMiddle", () => {
	it("returns values that already fit", () => {
		expect(truncateMiddle("abcdef", 6)).toBe("abcdef");
	});
	it("keeps both ends within the width", () => {
		expect(plain(truncateMiddle("abcdefghij", 5))).toBe("ab…ij");
		expect(plain(truncateMiddle("abcdefghij", 6))).toBe("abc…ij");
		expect(truncateMiddle("abcdefghij", 6)).not.toContain("m0[");
	});
	it("returns nothing for non-positive widths", () => {
		expect(truncateMiddle("abc", 0)).toBe("");
		expect(truncateMiddle("abc", -1)).toBe("");
	});
});
