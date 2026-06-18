import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import {
	ENTER_FOCUS_TOOL,
	EXIT_FOCUS_TOOL,
	type FocusDefinition,
} from "./definitions";
import {
	activateBaseFocusTools,
	activateFocusTools,
	getActiveFocusTools,
	getBaseFocusTools,
} from "./tool-access";

function pi(
	names: readonly string[],
): ExtensionAPI & { activeTools: string[] } {
	const api = {
		activeTools: [] as string[],
		getAllTools: () => names.map((name) => ({ name })),
		setActiveTools: (tools: string[]) => {
			api.activeTools = tools;
		},
	};
	return api as unknown as ExtensionAPI & { activeTools: string[] };
}

function focus(overrides: Partial<FocusDefinition> = {}): FocusDefinition {
	return {
		name: "edit",
		description: "Edit files",
		prompt: "Edit files",
		tools: ["read", "write", ENTER_FOCUS_TOOL, EXIT_FOCUS_TOOL],
		transition: "confirm",
		...overrides,
	};
}

describe("focus tool access", () => {
	it("base focus exposes only always-allowed and enter_focus when registered", () => {
		const api = pi(["read", "multi_tool_use.parallel", ENTER_FOCUS_TOOL]);

		assert.deepEqual(getBaseFocusTools(api), [
			"multi_tool_use.parallel",
			ENTER_FOCUS_TOOL,
		]);
		assert.deepEqual(activateBaseFocusTools(api), [
			"multi_tool_use.parallel",
			ENTER_FOCUS_TOOL,
		]);
		assert.deepEqual(api.activeTools, [
			"multi_tool_use.parallel",
			ENTER_FOCUS_TOOL,
		]);
	});

	it("can hide base focus management tools for locked focus mode", () => {
		const api = pi(["read", "multi_tool_use.parallel", ENTER_FOCUS_TOOL]);

		assert.deepEqual(
			getBaseFocusTools(api, { includeManagementTools: false }),
			["multi_tool_use.parallel"],
		);
		assert.deepEqual(
			activateBaseFocusTools(api, { includeManagementTools: false }),
			["multi_tool_use.parallel"],
		);
		assert.deepEqual(api.activeTools, ["multi_tool_use.parallel"]);
	});

	it("active single-turn focuses get declared tools plus enter_focus", () => {
		const api = pi([
			"read",
			"write",
			"missing",
			"multi_tool_use.parallel",
			ENTER_FOCUS_TOOL,
			EXIT_FOCUS_TOOL,
		]);

		assert.deepEqual(getActiveFocusTools(api, focus()), [
			"multi_tool_use.parallel",
			"read",
			"write",
			ENTER_FOCUS_TOOL,
		]);
	});

	it("can hide focus management tools for locked focus mode", () => {
		const api = pi([
			"read",
			"write",
			"multi_tool_use.parallel",
			ENTER_FOCUS_TOOL,
			EXIT_FOCUS_TOOL,
		]);

		assert.deepEqual(
			getActiveFocusTools(api, focus(), { includeManagementTools: false }),
			["multi_tool_use.parallel", "read", "write"],
		);
		assert.deepEqual(
			activateFocusTools(api, focus(), { includeManagementTools: false }),
			["multi_tool_use.parallel", "read", "write"],
		);
	});

	it("explicit-exit focuses expose exit_focus instead of enter_focus", () => {
		const api = pi([
			"read",
			"multi_tool_use.parallel",
			ENTER_FOCUS_TOOL,
			EXIT_FOCUS_TOOL,
		]);

		assert.deepEqual(
			activateFocusTools(api, focus({ exitMode: "explicit", tools: ["read"] })),
			["multi_tool_use.parallel", "read", EXIT_FOCUS_TOOL],
		);
		assert.deepEqual(api.activeTools, [
			"multi_tool_use.parallel",
			"read",
			EXIT_FOCUS_TOOL,
		]);
	});

	it("falls back to base tools when no focus is active", () => {
		const api = pi(["multi_tool_use.parallel", ENTER_FOCUS_TOOL]);

		assert.deepEqual(activateFocusTools(api, undefined), [
			"multi_tool_use.parallel",
			ENTER_FOCUS_TOOL,
		]);
	});
});
