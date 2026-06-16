import assert from "node:assert/strict";
import type {
	ToolCallEvent,
	ToolDefinition,
	ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import { Type } from "typebox";
import { createToolCatalog, defineToolContribution } from "./catalog";

const schema = Type.Object({ path: Type.String() });

function demoTool<TDetails = undefined>(
	description = "demo",
	details = undefined as TDetails,
): ToolDefinition<typeof schema, TDetails> {
	return {
		name: "demo",
		label: "Demo",
		description,
		parameters: schema,
		execute: async () => ({ content: [], details }),
	};
}

function toolCall(toolName: string, input: unknown): ToolCallEvent {
	return { toolName, input } as ToolCallEvent;
}

function toolResult(toolName: string, details: unknown): ToolResultEvent {
	return { toolName, details } as ToolResultEvent;
}

describe("createToolCatalog", () => {
	it("registers and replaces tool contributions by name", () => {
		const catalog = createToolCatalog();
		const first = defineToolContribution({
			policy: { name: "demo" },
			definition: demoTool("first"),
		});
		const replacement = defineToolContribution({
			policy: { name: "demo" },
			definition: demoTool("replacement"),
		});

		catalog.register(first);
		catalog.register(replacement);

		assert.deepEqual(catalog.list(), [replacement]);
	});

	it("rejects mismatched contribution and policy names", () => {
		const catalog = createToolCatalog();

		assert.throws(
			() =>
				catalog.register(
					defineToolContribution({
						policy: { name: "other" },
						definition: demoTool(),
					}),
				),
			/mismatched policy/u,
		);
	});

	it("reports tool-result errors via contribution hooks", () => {
		const catalog = createToolCatalog();
		catalog.register(
			defineToolContribution({
				policy: { name: "demo" },
				definition: demoTool<{ ok: boolean }>("demo", { ok: true }),
				isErrorResult: (details) => !details.ok,
			}),
		);

		assert.deepEqual(
			catalog.toolResultError(toolResult("demo", { ok: false })),
			{
				isError: true,
			},
		);
		assert.equal(
			catalog.toolResultError(toolResult("demo", { ok: true })),
			undefined,
		);
		assert.equal(
			catalog.toolResultError(toolResult("unknown", { ok: false })),
			undefined,
		);
	});

	it("uses policy-specific or fallback not-allowed reasons", () => {
		const catalog = createToolCatalog();
		catalog.registerPolicy({
			name: "demo",
			notAllowedReason: (focusName) => `blocked in ${focusName}`,
		});

		assert.equal(
			catalog.checkToolAllowed("edit", new Set(), toolCall("demo", {})),
			"blocked in edit",
		);
		assert.equal(
			catalog.checkToolAllowed("edit", new Set(["demo"]), toolCall("demo", {})),
			undefined,
		);
		assert.equal(
			catalog.checkToolAllowed("edit", new Set(), toolCall("unknown", {})),
			"unknown is not available in edit focus.",
		);
	});

	it("blocks configured secret paths", () => {
		const catalog = createToolCatalog();
		catalog.registerPolicy({
			name: "demo",
			extractSecretPaths: (input: { path: string }) => [input.path],
			secretBlockReason: (focusName) => `secret blocked in ${focusName}`,
		});

		assert.equal(
			catalog.checkSecretBlock("explore", toolCall("demo", { path: ".env" })),
			"secret blocked in explore",
		);
		assert.equal(
			catalog.checkSecretBlock(
				"explore",
				toolCall("demo", { path: "README.md" }),
			),
			undefined,
		);
	});
});
