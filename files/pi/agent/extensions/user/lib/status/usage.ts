import type {
	AssistantMessage,
	ToolResultMessage,
} from "@earendil-works/pi-ai";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";

export type Totals = {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	latestCacheHitRate: number | undefined;
};

type UsageCost = {
	usage?: {
		cost?: unknown;
	};
};

type SubagentDetails = {
	results?: unknown;
};

function isUsageCost(value: unknown): value is UsageCost {
	return typeof value === "object" && value !== null;
}

function getFiniteCost(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getChildAgentCost(message: ToolResultMessage): number {
	if (message.toolName === "agent") {
		const details = message.details;
		return isUsageCost(details) ? getFiniteCost(details.usage?.cost) : 0;
	}

	if (message.toolName !== "subagent") return 0;

	const details = message.details as SubagentDetails | undefined;
	if (!Array.isArray(details?.results)) return 0;

	let cost = 0;
	for (const result of details.results) {
		if (!isUsageCost(result)) continue;
		cost += getFiniteCost(result.usage?.cost);
	}
	return cost;
}

export function getAssistantTotals(entries: readonly SessionEntry[]): Totals {
	const totals: Totals = {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		cost: 0,
		latestCacheHitRate: undefined,
	};

	for (const entry of entries) {
		if (entry.type !== "message") continue;

		if (entry.message.role === "toolResult") {
			totals.cost += getChildAgentCost(entry.message as ToolResultMessage);
			continue;
		}

		if (entry.message.role !== "assistant") continue;

		const usage = (entry.message as AssistantMessage).usage;
		if (!usage) continue;

		const input = usage.input ?? 0;
		const cacheRead = usage.cacheRead ?? 0;
		const cacheWrite = usage.cacheWrite ?? 0;
		const latestPromptTokens = input + cacheRead + cacheWrite;

		totals.input += input;
		totals.output += usage.output ?? 0;
		totals.cacheRead += cacheRead;
		totals.cacheWrite += cacheWrite;
		totals.cost += usage.cost?.total ?? 0;
		const latestCacheHitRate =
			latestPromptTokens > 0 ? (cacheRead / latestPromptTokens) * 100 : 0;
		totals.latestCacheHitRate =
			latestCacheHitRate > 0 ? latestCacheHitRate : undefined;
	}

	return totals;
}
