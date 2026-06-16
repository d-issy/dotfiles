import assert from "node:assert/strict";
import type {
	ExtensionAPI,
	ToolCallEvent,
} from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import { createToolCatalog } from "../tool/catalog";
import { guardToolCall } from "./guard";
import { registerBuiltInFocusPolicies } from "./policies";
import type { FocusController } from "./controller";

function toolCall(toolName: string, input: unknown): ToolCallEvent {
	return { toolName, input } as ToolCallEvent;
}

function focus(allowedToolNames: readonly string[]): FocusController {
	return {
		current: "edit",
		active: undefined,
		allowedToolNames: () => new Set(allowedToolNames),
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
});
