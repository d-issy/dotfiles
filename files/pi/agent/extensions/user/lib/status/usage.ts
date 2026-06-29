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

export type LiveAgentCostSnapshot = ReadonlyMap<string, number>;

export type LiveAgentUsageTracker = {
	snapshot(): LiveAgentCostSnapshot;
	handleToolExecutionUpdate(event: unknown): boolean;
	handleMessageEnd(event: unknown): boolean;
	clear(): void;
};

type UsageCost = {
	usage?: {
		cost?: unknown;
	};
};

type SubagentDetails = {
	results?: unknown;
};

type ToolExecutionUpdateLike = {
	type?: unknown;
	toolCallId?: unknown;
	toolName?: unknown;
	partialResult?: {
		details?: unknown;
	};
};

type MessageEndLike = {
	type?: unknown;
	message?: {
		role?: unknown;
		toolCallId?: unknown;
		toolName?: unknown;
	};
};

function isUsageCost(value: unknown): value is UsageCost {
	return typeof value === "object" && value !== null;
}

function getFiniteCost(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getLiveAgentCost(details: unknown): number | undefined {
	if (!isUsageCost(details)) return undefined;
	const cost = details.usage?.cost;
	return typeof cost === "number" && Number.isFinite(cost) ? cost : undefined;
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

function getToolCallId(message: ToolResultMessage): string | undefined {
	return typeof message.toolCallId === "string"
		? message.toolCallId
		: undefined;
}

export function createLiveAgentUsageTracker(): LiveAgentUsageTracker {
	const costs = new Map<string, number>();

	return {
		snapshot() {
			return new Map(costs);
		},
		handleToolExecutionUpdate(event: unknown) {
			const ev = event as ToolExecutionUpdateLike;
			if (ev.type !== "tool_execution_update") return false;
			if (ev.toolName !== "agent" || typeof ev.toolCallId !== "string") {
				return false;
			}

			const cost = getLiveAgentCost(ev.partialResult?.details);
			if (cost === undefined) return false;

			const previous = costs.get(ev.toolCallId);
			costs.set(ev.toolCallId, cost);
			return previous !== cost;
		},
		handleMessageEnd(event: unknown) {
			const ev = event as MessageEndLike;
			if (ev.type !== "message_end") return false;
			const message = ev.message;
			if (
				message?.role !== "toolResult" ||
				message.toolName !== "agent" ||
				typeof message.toolCallId !== "string"
			) {
				return false;
			}

			const existed = costs.delete(message.toolCallId);
			return existed;
		},
		clear() {
			costs.clear();
		},
	};
}

export function getAssistantTotals(
	entries: readonly SessionEntry[],
	liveAgentCosts?: LiveAgentCostSnapshot,
): Totals {
	const totals: Totals = {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		cost: 0,
		latestCacheHitRate: undefined,
	};
	const finalizedAgentToolCallIds = liveAgentCosts
		? new Set<string>()
		: undefined;

	for (const entry of entries) {
		if (entry.type !== "message") continue;

		if (entry.message.role === "toolResult") {
			const message = entry.message as ToolResultMessage;
			totals.cost += getChildAgentCost(message);
			if (message.toolName === "agent") {
				const toolCallId = getToolCallId(message);
				if (toolCallId) finalizedAgentToolCallIds?.add(toolCallId);
			}
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

	if (liveAgentCosts) {
		for (const [toolCallId, cost] of liveAgentCosts) {
			if (finalizedAgentToolCallIds?.has(toolCallId)) continue;
			totals.cost += getFiniteCost(cost);
		}
	}

	return totals;
}
