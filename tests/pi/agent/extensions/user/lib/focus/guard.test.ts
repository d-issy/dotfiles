import assert from "node:assert/strict";
import type {
	ExtensionAPI,
	ToolCallEvent,
} from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import { createToolCatalog } from "#pi-user/lib/tool/catalog";
import { guardToolCall } from "#pi-user/lib/focus/guard";
import { registerBuiltInFocusPolicies } from "#pi-user/lib/focus/policies";
import type { FocusController } from "#pi-user/lib/focus/controller";
import {
	BASE_FOCUS,
	ENTER_FOCUS_TOOL,
	EXIT_FOCUS_TOOL,
} from "#pi-user/lib/focus/definitions";
import type { FocusRuntime } from "#pi-user/lib/focus/runtime";

function toolCall(toolName: string, input: unknown): ToolCallEvent {
	return { toolName, input } as ToolCallEvent;
}

function focus(allowedToolNames: readonly string[]): FocusController {
	return {
		current: "edit",
		active: { name: "edit" },
		allowedToolNames: (
			_pi: ExtensionAPI,
			options?: { readonly includeManagementTools?: boolean },
		) =>
			new Set(
				options?.includeManagementTools === false
					? allowedToolNames.filter(
							(name) => name !== ENTER_FOCUS_TOOL && name !== EXIT_FOCUS_TOOL,
						)
					: allowedToolNames,
			),
	} as unknown as FocusController;
}

function noFocus(allowedToolNames: readonly string[]): FocusController {
	return {
		...focus(allowedToolNames),
		current: BASE_FOCUS,
		active: undefined,
	} as unknown as FocusController;
}

describe("guardToolCall", () => {
	it("blocks unavailable tools with built-in policy reasons", async () => {
		const catalog = createToolCatalog();
		registerBuiltInFocusPolicies(catalog);
		const guard = guardToolCall({} as ExtensionAPI, focus(["read"]), catalog);

		assert.deepEqual(await guard(toolCall("bash", {}), undefined as never), {
			block: true,
			reason: "Running bash commands is disabled in edit focus.",
		});
	});

	it("blocks allowed tools when their input targets secrets", async () => {
		const catalog = createToolCatalog();
		registerBuiltInFocusPolicies(catalog);
		const guard = guardToolCall({} as ExtensionAPI, focus(["read"]), catalog);

		assert.deepEqual(
			await guard(toolCall("read", { path: ".env" }), undefined as never),
			{
				block: true,
				reason: "Reading secret files is disabled in edit focus.",
			},
		);
	});

	it("allows available non-secret tool calls", async () => {
		const catalog = createToolCatalog();
		registerBuiltInFocusPolicies(catalog);
		const guard = guardToolCall({} as ExtensionAPI, focus(["read"]), catalog);

		assert.equal(
			await guard(toolCall("read", { path: "README.md" }), undefined as never),
			undefined,
		);
	});

	it("blocks focus management tool calls when focus is locked", async () => {
		const catalog = createToolCatalog();
		const runtime = { lockedFocusName: "edit" } as FocusRuntime;
		const guard = guardToolCall(
			{} as ExtensionAPI,
			focus(["read", ENTER_FOCUS_TOOL, EXIT_FOCUS_TOOL]),
			catalog,
			runtime,
		);

		assert.deepEqual(
			await guard(
				toolCall(ENTER_FOCUS_TOOL, { name: "explore" }),
				undefined as never,
			),
			{
				block: true,
				reason: `${ENTER_FOCUS_TOOL} is not available in edit focus.`,
			},
		);
	});

	it("blocks edit_chunk when no focus is active", async () => {
		const catalog = createToolCatalog();
		registerBuiltInFocusPolicies(catalog);
		const guard = guardToolCall(
			{} as ExtensionAPI,
			noFocus(["read", ENTER_FOCUS_TOOL]),
			catalog,
		);

		assert.deepEqual(
			await guard(toolCall("edit_chunk", {}), undefined as never),
			{
				block: true,
				reason:
					"edit_chunk is not available because no focus is active. Use enter_focus to enter an appropriate focus first.",
			},
		);
	});
});
