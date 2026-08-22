import assert from "node:assert/strict";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import { getUsageTotals } from "#pi-user/lib/status/usage";

describe("getUsageTotals", () => {
	it("sums session usage and calculates the latest cache hit rate", () => {
		const entries = [
			{
				type: "message",
				message: {
					role: "user",
					content: [{ type: "text", text: "hello" }],
				},
			},
			{
				type: "message",
				message: {
					role: "assistant",
					usage: {
						input: 100,
						output: 20,
						cacheRead: 0,
						cacheWrite: 50,
						cost: { total: 0.01 },
					},
				},
			},
			{
				type: "message",
				message: {
					role: "toolResult",
					usage: {
						input: 0,
						output: 0,
						cacheRead: 0,
						cacheWrite: 0,
						cost: { total: 0.02 },
					},
				},
			},
			{
				type: "message",
				message: {
					role: "assistant",
					usage: {
						input: 12_444,
						output: 5_000,
						cacheRead: 202_000,
						cacheWrite: 0,
						cost: { total: 0.021 },
					},
				},
			},
		] as unknown as SessionEntry[];

		const totals = getUsageTotals(entries);
		assert.equal(totals.input, 12_544);
		assert.equal(totals.output, 5_020);
		assert.equal(totals.cacheRead, 202_000);
		assert.equal(totals.cacheWrite, 50);
		assert.ok(Math.abs(totals.cost - 0.051) < Number.EPSILON);
		assert.ok(
			Math.abs((totals.latestCacheHitRate ?? 0) - 94.19708641883196) <
				Number.EPSILON,
		);
	});

	it("includes usage from compaction and branch summaries", () => {
		const entries = [
			{
				type: "compaction",
				usage: { input: 1_000, output: 100, cost: { total: 0.03 } },
			},
			{
				type: "branch_summary",
				usage: { input: 2_000, output: 200, cost: { total: 0.04 } },
			},
		] as unknown as SessionEntry[];

		assert.deepEqual(getUsageTotals(entries), {
			input: 3_000,
			output: 300,
			cacheRead: 0,
			cacheWrite: 0,
			cost: 0.07,
			latestCacheHitRate: undefined,
		});
	});
});
