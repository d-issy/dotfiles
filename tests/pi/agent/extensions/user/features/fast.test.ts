import assert from "node:assert/strict";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { describe, it, vi } from "vitest";
import {
	OPENROUTER_FAST_MODEL_IDS,
	OPENROUTER_ULTRAFAST_MODEL_IDS,
	addAnthropicFastBeta,
	adjustFastCost,
	enableFastPayload,
	registerFastFeature,
	supportsFast,
	supportsUltrafast,
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

describe("gateway speed modes", () => {
	it.each([...OPENROUTER_FAST_MODEL_IDS])(
		"requests OpenRouter Priority for %s",
		(id) => {
			const model = fastModel("openrouter", id);
			assert.equal(supportsFast(model), true);
			assert.deepEqual(
				enableFastPayload(
					{ model: id, provider: { order: ["openai"] } },
					model,
				),
				{
					model: id,
					provider: { order: ["openai"] },
					service_tier: "priority",
				},
			);
			const message = assistant("openrouter", id);
			assert.equal(adjustFastCost(message, model), message);
		},
	);

	it.each([...OPENROUTER_ULTRAFAST_MODEL_IDS])(
		"requests OpenRouter Ultrafast for %s",
		(id) => {
			const model = fastModel("openrouter", id);
			assert.equal(supportsUltrafast(model), true);
			assert.deepEqual(enableFastPayload({ model: id }, model, "ultrafast"), {
				model: id,
				service_tier: "ultrafast",
			});
			const message = assistant("openrouter", id);
			assert.equal(adjustFastCost(message, model, "ultrafast"), message);
		},
	);

	it.each(["gpt-6-luna", "gpt-5.6-luna", "grok-4.7", "grok-4.6"])(
		"forwards Priority for OpenCode Go %s",
		(id) => {
			const model = fastModel("opencode-go", id);
			assert.equal(supportsFast(model), true);
			assert.deepEqual(enableFastPayload({ model: id }, model), {
				model: id,
				service_tier: "priority",
			});
			assert.equal(supportsUltrafast(model), false);
			const message = assistant("opencode-go", id);
			assert.equal(adjustFastCost(message, model), message);
		},
	);

	it("covers all audited gateway families without enabling unknown models or batch variants", () => {
		assert.equal(OPENROUTER_FAST_MODEL_IDS.size, 49);
		for (const id of [
			"openai/gpt-6.1-sol-pro",
			"anthropic/claude-opus-5.5",
			"google/gemini-3.8-flash",
			"x-ai/grok-4.7",
			"deepseek/deepseek-v4.1-flash",
			"z-ai/glm-5.3",
			"moonshotai/kimi-k3",
		])
			assert.equal(supportsFast({ provider: "openrouter", id }), true);
		for (const id of [
			"openai/unknown",
			"openai/gpt-6-luna:batch",
			"anthropic/claude-opus-4.7",
		])
			assert.equal(supportsFast({ provider: "openrouter", id }), false);
		assert.equal(
			supportsUltrafast({ provider: "openrouter", id: "openai/gpt-6.1-sol" }),
			false,
		);
		assert.equal(
			supportsFast({ provider: "opencode-go", id: "gpt-6-astra" }),
			false,
		);
	});

	it("keeps gateway Fast and Ultrafast active through controller events", () => {
		for (const [provider, id, mode] of [
			["openrouter", "anthropic/claude-opus-5.5", "fast"],
			["openrouter", "openai/gpt-6-astra", "ultrafast"],
			["opencode-go", "gpt-6-luna", "fast"],
		] as const) {
			type EventHandler = (
				event: Record<string, unknown>,
				ctx: ExtensionContext,
			) => unknown;
			const handlers = new Map<string, EventHandler>();
			const pi = {
				registerCommand: vi.fn(),
				on: (name: string, handler: EventHandler) =>
					handlers.set(name, handler),
			} as unknown as ExtensionAPI;
			const model = fastModel(provider, id);
			const controller = registerFastFeature(pi);
			controller.setMode(mode, model);
			assert.equal(controller.getMode(model), mode);
			assert.deepEqual(
				handlers.get("before_provider_request")!({ payload: { model: id } }, {
					model,
				} as ExtensionContext),
				{ model: id, service_tier: mode === "fast" ? "priority" : "ultrafast" },
			);
		}
	});
});

describe("OpenAI provider migration", () => {
	it.each([
		"gpt-6.1-sol",
		"gpt-6-astra",
		"gpt-6-sol",
		"gpt-6-luna",
		"gpt-5.6-terra",
		"gpt-5.6-sol",
		"gpt-5.6-luna",
		"gpt-5.5",
		"gpt-5.4",
	])("supports Fast for %s on OpenAI", (id) => {
		const model = fastModel("openai", id);
		assert.equal(supportsFast(model), true);
		assert.deepEqual(enableFastPayload({ model: id }, model), {
			model: id,
			service_tier: "priority",
		});
		const message = assistant("openai", id);
		const adjusted = adjustFastCost(message, model);
		assert.equal(adjusted.usage.cost.input, id === "gpt-5.5" ? 2.5 : 2);
	});

	it("supports Astra Ultrafast on OpenAI without enabling it for Sol", () => {
		const model = fastModel("openai", "gpt-6-astra");
		assert.equal(supportsUltrafast(model), true);
		assert.deepEqual(
			enableFastPayload({ model: model.id }, model, "ultrafast"),
			{ model: model.id, service_tier: "ultrafast" },
		);
		assert.equal(
			adjustFastCost(assistant("openai", model.id), model, "ultrafast").usage
				.cost.input,
			6,
		);
		assert.equal(
			supportsUltrafast({ provider: "openai", id: "gpt-6.1-sol" }),
			false,
		);
		assert.equal(
			supportsFast({ provider: "openai", id: "gpt-5.4-mini" }),
			false,
		);
	});
});

describe("supportsFast", () => {
	it.each([
		"gpt-6.1-sol",
		"gpt-6-astra",
		"gpt-6-sol",
		"gpt-6-luna",
		"gpt-5.6-terra",
		"gpt-5.6-sol",
		"gpt-5.6-luna",
		"gpt-5.5",
		"gpt-5.4",
	])("supports %s through ChatGPT", (id) => {
		assert.equal(supportsFast({ provider: "openai-codex", id }), true);
	});

	it.each(["claude-opus-5-5", "claude-opus-5", "claude-opus-4-8"])(
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
		assert.equal(
			supportsFast({ provider: "openrouter", id: "gpt-5.5" }),
			false,
		);
		assert.equal(
			supportsFast({ provider: "anthropic", id: "claude-opus-4-7" }),
			false,
		);
		assert.equal(
			supportsFast({ provider: "anthropic", id: "claude-sonnet-5-5" }),
			false,
		);
	});
});

describe("Ultrafast", () => {
	it("supports only Astra through ChatGPT and sends the Ultrafast tier", () => {
		const model = { provider: "openai-codex", id: "gpt-6-astra" };
		assert.equal(supportsUltrafast(model), true);
		const payload = { model: model.id, stream: true };
		assert.deepEqual(enableFastPayload(payload, model, "ultrafast"), {
			...payload,
			service_tier: "ultrafast",
		});
		assert.equal("service_tier" in payload, false);
		for (const unsupported of [
			undefined,
			{ ...model, id: "gpt-6.1-sol" },
			{ ...model, id: "gpt-6-luna" },
			{ ...model, provider: "openrouter" },
			{ provider: "anthropic", id: "claude-opus-5-5" },
		]) {
			assert.equal(supportsUltrafast(unsupported), false);
			assert.equal(
				enableFastPayload(payload, unsupported, "ultrafast"),
				undefined,
			);
		}
		assert.equal(
			enableFastPayload({ model: "gpt-6-sol" }, model, "ultrafast"),
			undefined,
		);
	});

	it("applies the sixfold purchased-credit rate without mutating usage", () => {
		const message = assistant("openai-codex", "gpt-6-astra");
		const adjusted = adjustFastCost(
			message,
			fastModel("openai-codex", "gpt-6-astra"),
			"ultrafast",
		);
		assert.deepEqual(adjusted.usage.cost, {
			input: 6,
			output: 12,
			cacheRead: 3,
			cacheWrite: 1.5,
			total: 22.5,
		});
		assert.equal(message.usage.cost.total, 3.75);
		assert.equal(
			adjustFastCost(
				message,
				fastModel("openai-codex", "gpt-6-sol"),
				"ultrafast",
			),
			message,
		);
	});

	it("toggles modes exclusively and keeps the request's rate after a mode change", async () => {
		type Handler = (args: string, ctx: ExtensionContext) => Promise<void>;
		type EventHandler = (
			event: Record<string, unknown>,
			ctx: ExtensionContext,
		) => unknown;
		const commands = new Map<string, Handler>();
		const events = new Map<string, EventHandler>();
		const pi = {
			registerCommand: (name: string, command: { handler: Handler }) =>
				commands.set(name, command.handler),
			on: (name: string, handler: EventHandler) => events.set(name, handler),
		} as unknown as ExtensionAPI;
		const controller = registerFastFeature(pi);
		const notify = vi.fn();
		const ctx = {
			model: fastModel("openai-codex", "gpt-6-astra"),
			ui: { notify },
		} as unknown as ExtensionContext;
		await commands.get("fast")!("", ctx);
		assert.equal(controller.getMode(ctx.model), "fast");
		await commands.get("ultrafast")!("", ctx);
		assert.equal(controller.getMode(ctx.model), "ultrafast");
		assert.equal(controller.isEnabled(ctx.model), false);
		assert.deepEqual(
			events.get("before_provider_request")!(
				{ payload: { model: ctx.model!.id } },
				ctx,
			),
			{ model: "gpt-6-astra", service_tier: "ultrafast" },
		);
		await commands.get("fast")!("", ctx);
		const result = events.get("message_end")!(
			{ message: assistant("openai-codex", "gpt-6-astra") },
			ctx,
		) as { message: AssistantMessage };
		assert.equal(result.message.usage.cost.total, 22.5);
		await commands.get("ultrafast")!("", ctx);
		await commands.get("ultrafast")!("", ctx);
		assert.equal(controller.getMode(ctx.model), undefined);
		await commands.get("ultrafast")!("", ctx);
		events.get("model_select")!(
			{ model: fastModel("openai-codex", "gpt-6-sol") },
			ctx,
		);
		assert.equal(controller.getMode(ctx.model), undefined);
		assert.match(notify.mock.calls.at(-1)![0], /Ultrafast mode disabled/u);
		ctx.model = fastModel("openai-codex", "gpt-6-sol");
		await commands.get("ultrafast")!("", ctx);
		assert.match(notify.mock.calls.at(-1)![0], /not available/u);
		await commands.get("ultrafast")!("on", ctx);
		assert.equal(notify.mock.calls.at(-1)![0], "Usage: /ultrafast");
	});
});

describe("enableFastPayload", () => {
	it.each(["gpt-6-astra", "gpt-6.1-sol", "gpt-6-sol", "gpt-6-luna", "gpt-5.5"])(
		"adds the priority service tier to %s payloads",
		(id) => {
			const payload = { model: id, stream: true };

			assert.deepEqual(
				enableFastPayload(payload, { provider: "openai-codex", id }),
				{ model: id, stream: true, service_tier: "priority" },
			);
			assert.deepEqual(payload, { model: id, stream: true });
		},
	);

	it.each(["claude-opus-5-5", "claude-opus-5"])(
		"adds fast speed to %s payloads",
		(id) => {
			assert.deepEqual(
				enableFastPayload({ model: id }, { provider: "anthropic", id }),
				{ model: id, speed: "fast" },
			);
		},
	);

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

	it.each(["gpt-6-astra", "gpt-6.1-sol"])(
		"applies the %s Fast multiplier",
		(id) => {
			const message = assistant("openai-codex", id);
			const adjusted = adjustFastCost(message, fastModel("openai-codex", id));

			assert.deepEqual(adjusted.usage.cost, {
				input: 2,
				output: 4,
				cacheRead: 1,
				cacheWrite: 0.5,
				total: 7.5,
			});
			assert.equal(message.usage.cost.total, 3.75);
		},
	);

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
