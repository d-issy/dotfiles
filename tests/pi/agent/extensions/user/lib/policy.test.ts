import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { makeSecretActionReason } from "#pi-user/lib/policy";

describe("makeSecretActionReason", () => {
	it("formats focus-specific secret action reasons", () => {
		assert.equal(
			makeSecretActionReason("Reading")("explore"),
			"Reading secret files is disabled in explore focus.",
		);
	});
});
