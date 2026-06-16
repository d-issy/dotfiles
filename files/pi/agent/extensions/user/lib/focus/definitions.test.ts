import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
	BASE_FOCUS_DEFINITIONS,
	BUILT_IN_TOOL_SETS,
	getFocusExitMode,
	isFocusTransition,
} from "./definitions";

describe("focus definitions", () => {
	it("has unique built-in focus names", () => {
		const names = BASE_FOCUS_DEFINITIONS.map((focus) => focus.name);
		assert.equal(new Set(names).size, names.length);
	});

	it("uses known tool sets", () => {
		for (const focus of BASE_FOCUS_DEFINITIONS) {
			for (const toolSet of focus.toolSets ?? []) {
				assert.ok(
					BUILT_IN_TOOL_SETS.has(toolSet),
					`${focus.name} references unknown tool set ${toolSet}`,
				);
			}
		}
	});

	it("defaults focus exit mode to single-turn", () => {
		assert.equal(
			getFocusExitMode({
				name: "demo",
				description: "demo",
				prompt: "demo",
				tools: [],
				transition: "auto",
			}),
			"single-turn",
		);
		assert.equal(
			getFocusExitMode({
				name: "demo",
				description: "demo",
				prompt: "demo",
				tools: [],
				transition: "auto",
				exitMode: "explicit",
			}),
			"explicit",
		);
	});

	it("recognizes focus transition values", () => {
		assert.equal(isFocusTransition("auto"), true);
		assert.equal(isFocusTransition("confirm"), true);
		assert.equal(isFocusTransition("manual"), true);
		assert.equal(isFocusTransition("other"), false);
		assert.equal(isFocusTransition(undefined), false);
	});
});
