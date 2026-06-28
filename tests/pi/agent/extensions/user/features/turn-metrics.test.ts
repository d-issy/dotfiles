import assert from "node:assert/strict";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { afterEach, describe, it, vi } from "vitest";
import { createTurnMetricsFeature } from "#pi-user/features/turn-metrics";

type Handler = (
	event: Record<string, unknown>,
	ctx: ExtensionContext,
) => Promise<void>;
type Harness = {
	readonly workingMessages: Array<string | undefined>;
	readonly widgets: Array<string[] | undefined>;
	readonly workingIndicators: unknown[];
	readonly emit: (
		event: string,
		payload?: Record<string, unknown>,
	) => Promise<void>;
};

function createHarness(): Harness {
	const handlers = new Map<string, Handler>();
	const workingMessages: Array<string | undefined> = [];
	const widgets: Array<string[] | undefined> = [];
	const workingIndicators: unknown[] = [];
	const pi = {
		on: (event: string, handler: Handler) => {
			handlers.set(event, handler);
		},
	} as unknown as ExtensionAPI;
	const ctx = {
		hasUI: true,
		ui: {
			theme: {
				fg: (_name: string, text: string) => text,
				bold: (text: string) => text,
			},
			setWidget: (_key: string, lines: string[] | undefined) => {
				widgets.push(lines);
			},
			setWorkingMessage: (message?: string) => {
				workingMessages.push(message);
			},
			setWorkingIndicator: (indicator?: unknown) => {
				workingIndicators.push(indicator);
			},
		},
	} as unknown as ExtensionContext;

	createTurnMetricsFeature().register(pi, {} as never);

	return {
		workingMessages,
		widgets,
		workingIndicators,
		async emit(event: string, payload: Record<string, unknown> = {}) {
			const handler = handlers.get(event);
			assert.ok(handler, `handler registered for ${event}`);
			await handler(payload, ctx);
		},
	};
}

function assistantMessage(content: unknown[]): Record<string, unknown> {
	return { message: { role: "assistant", content } };
}

describe("turn metrics feature", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("renders completed elapsed time without fractional seconds", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const h = createHarness();

		await h.emit("before_agent_start");
		vi.setSystemTime(9_200);
		await h.emit(
			"message_end",
			assistantMessage([{ type: "text", text: "done" }]),
		);

		const line = h.widgets.at(-1)?.[0] ?? "";
		assert.match(line, /Worked for 9s/u);
		assert.doesNotMatch(line, /9\.2s/u);
	});

	it("renders live elapsed time with fractional seconds only under one minute", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const h = createHarness();

		await h.emit("before_agent_start");
		vi.setSystemTime(9_200);
		await h.emit(
			"message_update",
			assistantMessage([{ type: "text", text: "working" }]),
		);
		assert.match(h.workingMessages.at(-1) ?? "", /9\.2s/u);

		vi.setSystemTime(72_300);
		await h.emit(
			"message_update",
			assistantMessage([{ type: "text", text: "still working" }]),
		);
		const line = h.workingMessages.at(-1) ?? "";
		assert.match(line, /1m 12s/u);
		assert.doesNotMatch(line, /72\.3s/u);
	});

	it("renders thinking metrics with both total and thinking elapsed time", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const h = createHarness();

		await h.emit("before_agent_start");
		vi.setSystemTime(9_200);
		await h.emit(
			"message_update",
			assistantMessage([{ type: "thinking", thinking: "reasoning" }]),
		);
		vi.setSystemTime(18_400);
		await h.emit(
			"message_update",
			assistantMessage([{ type: "thinking", thinking: "still reasoning" }]),
		);

		const line = h.workingMessages.at(-1) ?? "";
		assert.match(line, /18\.4s total/u);
		assert.match(line, /9\.2s thinking/u);
	});
	it("displays thought metrics for 1 second after thinking phase ends", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const h = createHarness();

		await h.emit("before_agent_start");
		vi.setSystemTime(10_000);
		await h.emit(
			"message_update",
			assistantMessage([{ type: "thinking", thinking: "reasoning" }]),
		);
		// Now in Thinking phase at T=10s

		vi.setSystemTime(15_000); // 5s of thinking
		await h.emit(
			"message_update",
			assistantMessage([{ type: "text", text: "now working" }]),
		);
		// Just transitioned to Working, thought display active until T=16s

		const thoughtLine = h.workingMessages.at(-1) ?? "";
		assert.match(thoughtLine, /15\.0s total/u);
		assert.match(thoughtLine, /5\.0s thought/u);
		assert.doesNotMatch(thoughtLine, /Thought for/u);

		// Advance past the 1-second thought display window
		vi.setSystemTime(16_001);
		await h.emit(
			"message_update",
			assistantMessage([{ type: "text", text: "still working" }]),
		);

		const normalLine = h.workingMessages.at(-1) ?? "";
		assert.match(normalLine, /16\.0s/u);
		assert.doesNotMatch(normalLine, /thought/u);
		assert.doesNotMatch(normalLine, /total/u);
		assert.doesNotMatch(normalLine, /Thought/u);
	});
	it("clears thought display when going back to thinking", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const h = createHarness();

		await h.emit("before_agent_start");
		vi.setSystemTime(10_000);
		await h.emit(
			"message_update",
			assistantMessage([{ type: "thinking", thinking: "reasoning" }]),
		);

		vi.setSystemTime(15_000);
		await h.emit(
			"message_update",
			assistantMessage([{ type: "text", text: "now working" }]),
		);
		// In thought display window
		const thoughtLine = h.workingMessages.at(-1) ?? "";
		assert.match(thoughtLine, /15\.0s total/u);
		assert.match(thoughtLine, /5\.0s thought/u);
		assert.doesNotMatch(thoughtLine, /Thought for/u);
		// Go back to thinking while still in thought window
		vi.setSystemTime(15_500);
		await h.emit(
			"message_update",
			assistantMessage([{ type: "thinking", thinking: "reasoning again" }]),
		);

		const thinkingLine = h.workingMessages.at(-1) ?? "";
		assert.match(thinkingLine, /total/u);
		assert.match(thinkingLine, /thinking/u);
		assert.doesNotMatch(thinkingLine, /Thought/u);
	});
});
