import assert from "node:assert/strict";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import {
	addAnthropicFastBeta,
	adjustFastCost,
	enableFastPayload,
	supportsFast,
} from "#pi-user/features/fast";

function fastModel(
	provider: string,
	id: string,
): NonNullable<ExtensionContext["model"]> {
	return {
		provider,
		id,
		cost: {
			input: 10_000,
			output: 100_000,
			cacheRead: 10_000,
			cacheWrite: 25_000,
		},
	} as unknown as NonNullable<ExtensionContext["model"]>;
}

function assistant(provider: string, model: string): AssistantMessage {
	return {
		role: "assistant",
		content: [],
		api:
			provider === "anthropic"
				? "anthropic-messages"
				: "openai-codex-responses",
		provider,
		model,
		usage: {
			input: 100,
			output: 20,
			cacheRead: 50,
			cacheWrite: 10,
			totalTokens: 180,
			cost: {
				input: 1,
				output: 2,
				cacheRead: 0.5,
				cacheWrite: 0.25,
				total: 3.75,
			},
		},
		stopReason: "stop",
		timestamp: 0,
	};
}

describe("supportsFast", () => {
	it.each([
		"gpt-5.4",
		"gpt-5.5",
		"gpt-5.6-luna",
		"gpt-5.6-sol",
		"gpt-5.6-terra",
	])("supports %s through ChatGPT", (id) => {
		assert.equal(supportsFast({ provider: "openai-codex", id }), true);
	});

	it.each(["claude-opus-4-8", "claude-opus-5"])(
		"supports %s through Anthropic",
		(id) => {
			assert.equal(supportsFast({ provider: "anthropic", id }), true);
		},
	);

	it("rejects unsupported models and providers", () => {
		assert.equal(
			supportsFast({ provider: "openai-codex", id: "gpt-5.4-mini" }),
			false,
		);
		assert.equal(supportsFast({ provider: "openai", id: "gpt-5.5" }), false);
		assert.equal(
			supportsFast({ provider: "anthropic", id: "claude-opus-4-7" }),
			false,
		);
	});
});

describe("enableFastPayload", () => {
	it("adds the priority service tier to OpenAI Codex payloads", () => {
		const payload = { model: "gpt-5.5", stream: true };

		assert.deepEqual(
			enableFastPayload(payload, {
				provider: "openai-codex",
				id: "gpt-5.5",
			}),
			{
				model: "gpt-5.5",
				stream: true,
				service_tier: "priority",
			},
		);
		assert.deepEqual(payload, { model: "gpt-5.5", stream: true });
	});

	it("adds fast speed to Anthropic payloads", () => {
		assert.deepEqual(
			enableFastPayload(
				{ model: "claude-opus-5" },
				{ provider: "anthropic", id: "claude-opus-5" },
			),
			{ model: "claude-opus-5", speed: "fast" },
		);
	});

	it("does not modify a request for a different model", () => {
		assert.equal(
			enableFastPayload(
				{ model: "gpt-5.4-mini" },
				{ provider: "openai-codex", id: "gpt-5.5" },
			),
			undefined,
		);
	});
});

describe("adjustFastCost", () => {
	it("applies the Codex Fast multiplier", () => {
		const message = assistant("openai-codex", "gpt-5.5");
		const adjusted = adjustFastCost(
			message,
			fastModel("openai-codex", "gpt-5.5"),
		);

		assert.deepEqual(adjusted.usage.cost, {
			input: 2.5,
			output: 5,
			cacheRead: 1.25,
			cacheWrite: 0.625,
			total: 9.375,
		});
		assert.equal(message.usage.cost.total, 3.75);
	});

	it("applies the Anthropic Fast multiplier", () => {
		const adjusted = adjustFastCost(
			assistant("anthropic", "claude-opus-5"),
			fastModel("anthropic", "claude-opus-5"),
		);

		assert.equal(adjusted.usage.cost.total, 7.5);
	});

	it("does not adjust a response from a different model", () => {
		const message = assistant("openai-codex", "gpt-5.4-mini");

		assert.equal(
			adjustFastCost(message, fastModel("openai-codex", "gpt-5.5")),
			message,
		);
	});
});

describe("addAnthropicFastBeta", () => {
	it("preserves existing beta features and appends Fast mode once", () => {
		const headers = { "Anthropic-Beta": "oauth-2025-04-20" };

		addAnthropicFastBeta(headers);
		addAnthropicFastBeta(headers);

		assert.equal(
			headers["Anthropic-Beta"],
			"oauth-2025-04-20,fast-mode-2026-02-01",
		);
	});
});
