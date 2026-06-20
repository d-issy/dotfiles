import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { isSecretPath } from "#pi-user/lib/secrets";

describe("isSecretPath", () => {
	it("matches dotenv-style secret files", () => {
		assert.equal(isSecretPath(".env"), true);
		assert.equal(isSecretPath("config/.env.local"), true);
		assert.equal(isSecretPath("subdir/.envrc"), true);
	});

	it("does not match non-secret lookalikes", () => {
		assert.equal(isSecretPath("env"), false);
		assert.equal(isSecretPath(".environment"), false);
		assert.equal(isSecretPath(".env/example"), false);
		assert.equal(isSecretPath("README.md"), false);
	});
});
