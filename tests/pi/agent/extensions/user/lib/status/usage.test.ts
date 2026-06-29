import assert from "node:assert/strict";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import { getAssistantTotals } from "#pi-user/lib/status/usage";

describe("getAssistantTotals", () => {
	it("sums assistant usage and ignores other entries", () => {
		const entries = [
			{ type: "message", message: { role: "user" } },
			{ type: "tool-call" },
			{ type: "message", message: { role: "assistant" } },
			{
				type: "message",
				message: {
					role: "assistant",
					usage: { input: 10, output: 20, cost: { total: 0.125 } },
				},
			},
			{
				type: "message",
				message: {
					role: "assistant",
					usage: { input: 2, output: undefined, cost: {} },
				},
			},
		] as unknown as SessionEntry[];

		assert.deepEqual(getAssistantTotals(entries), {
			input: 12,
			output: 20,
			cacheRead: 0,
			cacheWrite: 0,
			cost: 0.125,
			latestCacheHitRate: undefined,
		});
	});

	it("tracks cache tokens and latest cache hit rate", () => {
		const entries = [
			{
				type: "message",
				message: {
					role: "assistant",
					usage: {
						input: 50,
						output: 10,
						cacheRead: 25,
						cacheWrite: 25,
						cost: { total: 0.01 },
					},
				},
			},
			{
				type: "message",
				message: {
					role: "assistant",
					usage: {
						input: 20,
						output: 5,
						cacheRead: 80,
						cacheWrite: 0,
						cost: { total: 0.02 },
					},
				},
			},
		] as unknown as SessionEntry[];

		assert.deepEqual(getAssistantTotals(entries), {
			input: 70,
			output: 15,
			cacheRead: 105,
			cacheWrite: 25,
			cost: 0.03,
			latestCacheHitRate: 80,
		});
	});

	it("includes agent tool result cost in the displayed total", () => {
		const entries = [
			{
				type: "message",
				message: {
					role: "assistant",
					usage: { input: 10, output: 20, cost: { total: 0.1 } },
				},
			},
			{
				type: "message",
				message: {
					role: "toolResult",
					toolName: "agent",
					details: {
						usage: {
							inputTokens: 100,
							outputTokens: 20,
							cacheReadTokens: 10,
							cacheWriteTokens: 0,
							totalTokens: 130,
							cost: 0.23,
						},
					},
				},
			},
		] as unknown as SessionEntry[];

		assert.deepEqual(getAssistantTotals(entries), {
			input: 10,
			output: 20,
			cacheRead: 0,
			cacheWrite: 0,
			cost: 0.33,
			latestCacheHitRate: undefined,
		});
	});

	it("includes subagent result cost in the displayed total", () => {
		const entries = [
			{
				type: "message",
				message: {
					role: "assistant",
					usage: { input: 10, output: 20, cost: { total: 0.1 } },
				},
			},
			{
				type: "message",
				message: {
					role: "toolResult",
					toolName: "subagent",
					details: {
						results: [{ usage: { cost: 0.2 } }, { usage: { cost: 0.03 } }],
					},
				},
			},
		] as unknown as SessionEntry[];

		assert.deepEqual(getAssistantTotals(entries), {
			input: 10,
			output: 20,
			cacheRead: 0,
			cacheWrite: 0,
			cost: 0.33,
			latestCacheHitRate: undefined,
		});
	});

	it("ignores malformed and non-child-agent tool result costs", () => {
		const entries = [
			{
				type: "message",
				message: {
					role: "toolResult",
					toolName: "bash",
					details: { results: [{ usage: { cost: 1 } }] },
				},
			},
			{
				type: "message",
				message: {
					role: "toolResult",
					toolName: "subagent",
					details: { results: [{ usage: { cost: "0.2" } }, {}] },
				},
			},
			{
				type: "message",
				message: {
					role: "toolResult",
					toolName: "agent",
					details: { usage: { cost: Number.NaN } },
				},
			},
		] as unknown as SessionEntry[];

		assert.deepEqual(getAssistantTotals(entries), {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			cost: 0,
			latestCacheHitRate: undefined,
		});
	});
});
