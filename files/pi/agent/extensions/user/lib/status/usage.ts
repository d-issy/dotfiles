import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";

export type Totals = {
	input: number;
	output: number;
	cost: number;
};

export function getAssistantTotals(entries: readonly SessionEntry[]): Totals {
	const totals: Totals = { input: 0, output: 0, cost: 0 };

	for (const entry of entries) {
		if (entry.type !== "message" || entry.message.role !== "assistant")
			continue;

		const usage = (entry.message as AssistantMessage).usage;
		if (!usage) continue;

		totals.input += usage.input ?? 0;
		totals.output += usage.output ?? 0;
		totals.cost += usage.cost?.total ?? 0;
	}

	return totals;
}
