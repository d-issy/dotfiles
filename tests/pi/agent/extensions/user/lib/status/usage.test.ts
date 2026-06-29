import assert from "node:assert/strict";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import {
	createLiveAgentUsageTracker,
	getAssistantTotals,
} from "#pi-user/lib/status/usage";

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

	it("includes live in-flight agent cost in the displayed total", () => {
		const entries = [
			{
				type: "message",
				message: {
					role: "assistant",
					usage: { input: 10, output: 20, cost: { total: 0.1 } },
				},
			},
		] as unknown as SessionEntry[];

		assert.deepEqual(getAssistantTotals(entries, new Map([["call-1", 0.23]])), {
			input: 10,
			output: 20,
			cacheRead: 0,
			cacheWrite: 0,
			cost: 0.33,
			latestCacheHitRate: undefined,
		});
	});

	it("does not double count live agent cost once the final tool result exists", () => {
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
					toolCallId: "call-1",
					toolName: "agent",
					details: { usage: { cost: 0.23 } },
				},
			},
		] as unknown as SessionEntry[];

		assert.deepEqual(
			getAssistantTotals(
				entries,
				new Map([
					["call-1", 0.23],
					["call-2", 0.04],
				]),
			),
			{
				input: 10,
				output: 20,
				cacheRead: 0,
				cacheWrite: 0,
				cost: 0.37,
				latestCacheHitRate: undefined,
			},
		);
	});

	it("tracks live agent cost from tool execution updates and clears after tool result", () => {
		const tracker = createLiveAgentUsageTracker();

		assert.equal(
			tracker.handleToolExecutionUpdate({
				type: "tool_execution_update",
				toolCallId: "call-1",
				toolName: "agent",
				partialResult: { details: { usage: { cost: 0.12 } } },
			}),
			true,
		);
		assert.deepEqual([...tracker.snapshot()], [["call-1", 0.12]]);
		assert.equal(
			tracker.handleToolExecutionUpdate({
				type: "tool_execution_update",
				toolCallId: "call-1",
				toolName: "agent",
				partialResult: { details: { usage: { cost: 0.12 } } },
			}),
			false,
		);
		assert.equal(
			tracker.handleMessageEnd({
				type: "message_end",
				message: {
					role: "toolResult",
					toolCallId: "call-1",
					toolName: "agent",
				},
			}),
			true,
		);
		assert.deepEqual([...tracker.snapshot()], []);
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
