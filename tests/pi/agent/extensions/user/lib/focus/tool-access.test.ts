import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import {
	EXIT_FOCUS_TOOL,
	FOCUS_EXIT_MODE,
	FOCUS_TRANSITION,
	type FocusDefinition,
} from "#pi-user/lib/focus/definitions";
import {
	activateBaseFocusTools,
	activateFocusTools,
	getActiveFocusTools,
	getBaseFocusTools,
} from "#pi-user/lib/focus/tool-access";

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
		tools: ["read", "write", EXIT_FOCUS_TOOL],
		transition: FOCUS_TRANSITION.CONFIRM,
		...overrides,
	};
}

describe("focus tool access", () => {
	it("base focus exposes always-allowed and agent tools", () => {
		const api = pi(["read", "multi_tool_use.parallel", "agent"]);

		assert.deepEqual(getBaseFocusTools(api), [
			"multi_tool_use.parallel",
			"agent",
		]);
		assert.deepEqual(activateBaseFocusTools(api), [
			"multi_tool_use.parallel",
			"agent",
		]);
		assert.deepEqual(api.activeTools, ["multi_tool_use.parallel", "agent"]);
	});

	it("can hide base focus management tools for locked focus mode", () => {
		const api = pi(["read", "multi_tool_use.parallel", "agent"]);

		assert.deepEqual(
			getBaseFocusTools(api, { includeManagementTools: false }),
			["multi_tool_use.parallel", "agent"],
		);
		assert.deepEqual(
			activateBaseFocusTools(api, { includeManagementTools: false }),
			["multi_tool_use.parallel", "agent"],
		);
		assert.deepEqual(api.activeTools, ["multi_tool_use.parallel", "agent"]);
	});

	it("active single-turn focuses get declared tools without focus management tools", () => {
		const api = pi([
			"read",
			"write",
			"missing",
			"multi_tool_use.parallel",
			EXIT_FOCUS_TOOL,
		]);

		assert.deepEqual(getActiveFocusTools(api, focus()), [
			"multi_tool_use.parallel",
			"read",
			"write",
		]);
	});

	it("active manual focuses do not expose focus management tools", () => {
		const api = pi([
			"read",
			"write",
			"multi_tool_use.parallel",
			EXIT_FOCUS_TOOL,
		]);

		assert.deepEqual(
			getActiveFocusTools(api, focus({ transition: FOCUS_TRANSITION.MANUAL })),
			["multi_tool_use.parallel", "read", "write"],
		);
		assert.deepEqual(
			activateFocusTools(api, focus({ transition: FOCUS_TRANSITION.MANUAL })),
			["multi_tool_use.parallel", "read", "write"],
		);
		assert.deepEqual(api.activeTools, [
			"multi_tool_use.parallel",
			"read",
			"write",
		]);
	});

	it("can hide focus management tools for locked focus mode", () => {
		const api = pi([
			"read",
			"write",
			"multi_tool_use.parallel",
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

	it("explicit-exit focuses expose exit_focus", () => {
		const api = pi(["read", "multi_tool_use.parallel", EXIT_FOCUS_TOOL]);

		assert.deepEqual(
			activateFocusTools(
				api,
				focus({ exitMode: FOCUS_EXIT_MODE.EXPLICIT, tools: ["read"] }),
			),
			["multi_tool_use.parallel", "read", EXIT_FOCUS_TOOL],
		);
		assert.deepEqual(api.activeTools, [
			"multi_tool_use.parallel",
			"read",
			EXIT_FOCUS_TOOL,
		]);
	});

	it("falls back to base tools when no focus is active", () => {
		const api = pi(["multi_tool_use.parallel", "agent"]);

		assert.deepEqual(activateFocusTools(api, undefined), [
			"multi_tool_use.parallel",
			"agent",
		]);
	});
});
