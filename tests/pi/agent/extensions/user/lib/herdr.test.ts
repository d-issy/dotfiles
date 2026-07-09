import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, it } from "vitest";
import {
	beginHerdrBlocked,
	installHerdrAgentStateBridge,
	resetHerdrAgentStateBridgeForTests,
	withHerdrBlocked,
} from "#pi-user/lib/herdr";

type EmittedEvent = {
	readonly channel: string;
	readonly data: unknown;
};

function fakePi(events: EmittedEvent[]): ExtensionAPI {
	const handlers = new Map<string, Array<() => void>>();
	return {
		events: {
			emit: (channel: string, data: unknown) => events.push({ channel, data }),
			on: () => () => undefined,
		},
		on: (event: string, handler: () => void) => {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		},
		__emit: (event: string) => {
			for (const handler of handlers.get(event) ?? []) handler();
		},
	} as unknown as ExtensionAPI;
}

describe("herdr agent state bridge", () => {
	afterEach(() => resetHerdrAgentStateBridgeForTests());

	it("reports blocked while a user prompt is pending", async () => {
		const events: EmittedEvent[] = [];
		installHerdrAgentStateBridge(fakePi(events));

		await withHerdrBlocked("Question", async () => {
			assert.deepEqual(events, [
				{
					channel: "herdr:blocked",
					data: { active: true, label: "Question" },
				},
			]);
		});

		assert.deepEqual(events, [
			{
				channel: "herdr:blocked",
				data: { active: true, label: "Question" },
			},
			{
				channel: "herdr:blocked",
				data: { active: false, label: "Question" },
			},
		]);
	});

	it("clears outstanding blocked reports on shutdown", () => {
		const events: EmittedEvent[] = [];
		const pi = fakePi(events);
		installHerdrAgentStateBridge(pi);

		beginHerdrBlocked("A");
		beginHerdrBlocked("B");
		(pi as unknown as { __emit(event: string): void }).__emit(
			"session_shutdown",
		);

		assert.deepEqual(events, [
			{ channel: "herdr:blocked", data: { active: true, label: "A" } },
			{ channel: "herdr:blocked", data: { active: true, label: "B" } },
			{ channel: "herdr:blocked", data: { active: false } },
			{ channel: "herdr:blocked", data: { active: false } },
		]);
	});
});
