import assert from "node:assert/strict";
import type {
	BeforeProviderRequestEvent,
	ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import type { FocusController } from "./controller";
import { ENTER_FOCUS_TOOL, EXIT_FOCUS_TOOL } from "./definitions";
import { filterProviderTools } from "./provider-filter";
import type { FocusRuntime } from "./runtime";

function focus(allowedToolNames: readonly string[]): FocusController {
	return {
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

function event(payload: unknown): BeforeProviderRequestEvent {
	return { payload } as BeforeProviderRequestEvent;
}

describe("filterProviderTools", () => {
	it("removes focus management tools from provider payloads when focus is locked", async () => {
		const payload = {
			tools: [
				{ name: "read" },
				{ name: ENTER_FOCUS_TOOL },
				{ function: { name: EXIT_FOCUS_TOOL } },
			],
		};
		const runtime = { lockedFocusName: "edit" } as FocusRuntime;

		assert.deepEqual(
			await filterProviderTools(
				{} as ExtensionAPI,
				focus(["read", ENTER_FOCUS_TOOL, EXIT_FOCUS_TOOL]),
				runtime,
			)(event(payload), undefined as never),
			{ tools: [{ name: "read" }] },
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
								{ name: ENTER_FOCUS_TOOL },
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
				focus(["read", ENTER_FOCUS_TOOL]),
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
});
