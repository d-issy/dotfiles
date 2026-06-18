import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import {
	FOCUS_FLAG_NAME,
	getRequestedFocusName,
	registerFocusFlag,
} from "./cli";

describe("focus CLI flag", () => {
	it("registers --focus as a string flag", () => {
		const registrations: Record<string, unknown> = {};
		const pi = {
			registerFlag: (name: string, options: unknown) => {
				registrations[name] = options;
			},
		} as ExtensionAPI;

		registerFocusFlag(pi);

		assert.deepEqual(registrations[FOCUS_FLAG_NAME], {
			description:
				"Start pi locked to a focus. The selected focus is the only focus mode for this process.",
			type: "string",
		});
	});

	it("returns a trimmed requested focus name", () => {
		assert.equal(
			getRequestedFocusName({ getFlag: () => "  interview  " }),
			"interview",
		);
	});

	it("ignores missing, non-string, and blank focus flag values", () => {
		assert.equal(
			getRequestedFocusName({ getFlag: () => undefined }),
			undefined,
		);
		assert.equal(getRequestedFocusName({ getFlag: () => true }), undefined);
		assert.equal(getRequestedFocusName({ getFlag: () => "   " }), undefined);
	});
});
