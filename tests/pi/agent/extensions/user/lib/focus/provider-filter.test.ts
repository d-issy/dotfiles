import assert from "node:assert/strict";
import type {
	BeforeProviderRequestEvent,
	ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import type { FocusController } from "#pi-user/lib/focus/controller";
import { EXIT_FOCUS_TOOL } from "#pi-user/lib/focus/definitions";
import { filterProviderTools } from "#pi-user/lib/focus/provider-filter";
import type { FocusRuntime } from "#pi-user/lib/focus/runtime";

function focus(allowedToolNames: readonly string[]): FocusController {
	return {
		allowedToolNames: (
			_pi: ExtensionAPI,
			options?: { readonly includeManagementTools?: boolean },
		) =>
			new Set(
				options?.includeManagementTools === false
					? allowedToolNames.filter((name) => name !== EXIT_FOCUS_TOOL)
					: allowedToolNames,
			),
	} as unknown as FocusController;
}

function event(payload: unknown): BeforeProviderRequestEvent {
	return { payload } as BeforeProviderRequestEvent;
}

describe("filterProviderTools", () => {
	it("removes focus management tools from provider payloads when focus is locked", async () => {
		const payload = {
			tools: [
				{ name: "read" },
				{ name: "agent" },
				{ function: { name: EXIT_FOCUS_TOOL } },
			],
		};
		const runtime = { lockedFocusName: "edit" } as FocusRuntime;

		assert.deepEqual(
			await filterProviderTools(
				{} as ExtensionAPI,
				focus(["read", "agent", EXIT_FOCUS_TOOL]),
				runtime,
			)(event(payload), undefined as never),
			{ tools: [{ name: "read" }, { name: "agent" }] },
		);
	});

	it("filters nested function declarations with the locked tool set", async () => {
		const payload = {
			contents: [
				{
					tools: [
						{
							functionDeclarations: [
								{ name: "read" },
								{ name: EXIT_FOCUS_TOOL },
							],
						},
					],
				},
			],
		};
		const runtime = { lockedFocusName: "edit" } as FocusRuntime;

		assert.deepEqual(
			await filterProviderTools(
				{} as ExtensionAPI,
				focus(["read", EXIT_FOCUS_TOOL]),
				runtime,
			)(event(payload), undefined as never),
			{
				contents: [
					{
						tools: [
							{
								functionDeclarations: [{ name: "read" }],
							},
						],
					},
				],
			},
		);
	});

	it("removes edit_chunk and other focus-scoped tools when no focus is active", async () => {
		const payload = {
			tools: [{ name: "read" }, { name: "edit_chunk" }, { name: "agent" }],
		};
		const runtime = { lockedFocusName: undefined } as FocusRuntime;

		assert.deepEqual(
			await filterProviderTools(
				{} as ExtensionAPI,
				focus(["read", "agent"]),
				runtime,
			)(event(payload), undefined as never),
			{ tools: [{ name: "read" }, { name: "agent" }] },
		);
	});
});
