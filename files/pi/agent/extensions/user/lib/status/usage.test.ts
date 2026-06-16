import assert from "node:assert/strict";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import { getAssistantTotals } from "./usage";

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
			cost: 0.125,
		});
	});
});
