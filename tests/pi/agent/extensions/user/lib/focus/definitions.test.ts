import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
	BASE_FOCUS_DEFINITIONS,
	BUILT_IN_TOOL_SETS,
	FOCUS_EXIT_MODE,
	FOCUS_TRANSITION,
	getFocusExitMode,
	isFocusExitMode,
	isFocusTransition,
} from "#pi-user/lib/focus/definitions";

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
				transition: FOCUS_TRANSITION.AUTO,
			}),
			FOCUS_EXIT_MODE.SINGLE_TURN,
		);
		assert.equal(
			getFocusExitMode({
				name: "demo",
				description: "demo",
				prompt: "demo",
				tools: [],
				transition: FOCUS_TRANSITION.AUTO,
				exitMode: FOCUS_EXIT_MODE.EXPLICIT,
			}),
			FOCUS_EXIT_MODE.EXPLICIT,
		);
	});

	it("recognizes focus exit mode values", () => {
		assert.equal(isFocusExitMode(FOCUS_EXIT_MODE.SINGLE_TURN), true);
		assert.equal(isFocusExitMode(FOCUS_EXIT_MODE.EXPLICIT), true);
		assert.equal(isFocusExitMode("other"), false);
		assert.equal(isFocusExitMode(undefined), false);
	});

	it("recognizes focus transition values", () => {
		assert.equal(isFocusTransition(FOCUS_TRANSITION.AUTO), true);
		assert.equal(isFocusTransition(FOCUS_TRANSITION.CONFIRM), true);
		assert.equal(isFocusTransition(FOCUS_TRANSITION.MANUAL), true);
		assert.equal(isFocusTransition("other"), false);
		assert.equal(isFocusTransition(undefined), false);
	});

	it("defines the pull-request focus as manual with PR workflow tools", () => {
		const focus = BASE_FOCUS_DEFINITIONS.find((f) => f.name === "pull-request");
		assert.ok(focus, "pull-request focus should be defined");
		assert.equal(focus?.transition, FOCUS_TRANSITION.CONFIRM);
		assert.deepEqual(focus?.tools, [
			"create_pull_request",
			"update_pull_request",
		]);
	});
});
