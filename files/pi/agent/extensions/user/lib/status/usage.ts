import type { SessionEntry } from "@earendil-works/pi-coding-agent";

export type UsageTotals = {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	latestCacheHitRate: number | undefined;
};

type RecordLike = Record<string, unknown>;

type UsageLike = {
	input?: unknown;
	output?: unknown;
	cacheRead?: unknown;
	cacheWrite?: unknown;
	cost?: unknown;
};

function isRecord(value: unknown): value is RecordLike {
	return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getUsage(value: unknown): UsageLike | undefined {
	if (!isRecord(value) || !isRecord(value.usage)) return undefined;
	return value.usage as UsageLike;
}

function addUsage(totals: UsageTotals, usage: UsageLike): void {
	totals.input += finiteNumber(usage.input);
	totals.output += finiteNumber(usage.output);
	totals.cacheRead += finiteNumber(usage.cacheRead);
	totals.cacheWrite += finiteNumber(usage.cacheWrite);

	if (isRecord(usage.cost)) totals.cost += finiteNumber(usage.cost.total);
}

export function getUsageTotals(entries: readonly SessionEntry[]): UsageTotals {
	const totals: UsageTotals = {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		cost: 0,
		latestCacheHitRate: undefined,
	};

	for (const entry of entries) {
		if (!isRecord(entry)) continue;

		if (entry.type === "message" && isRecord(entry.message)) {
			if (
				entry.message.role !== "assistant" &&
				entry.message.role !== "toolResult"
			) {
				continue;
			}

			const usage = getUsage(entry.message);
			if (!usage) continue;

			addUsage(totals, usage);
			if (entry.message.role !== "assistant") continue;

			const promptTokens =
				finiteNumber(usage.input) +
				finiteNumber(usage.cacheRead) +
				finiteNumber(usage.cacheWrite);
			totals.latestCacheHitRate =
				promptTokens > 0
					? (finiteNumber(usage.cacheRead) / promptTokens) * 100
					: undefined;
			continue;
		}

		if (entry.type === "compaction" || entry.type === "branch_summary") {
			const usage = getUsage(entry);
			if (usage) addUsage(totals, usage);
		}
	}

	return totals;
}
