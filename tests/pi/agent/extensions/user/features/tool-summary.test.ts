import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Container } from "@earendil-works/pi-tui";
import { afterEach, describe, expect, it } from "vitest";
import { registerToolSummaryFeature } from "#pi-user/features/tool-summary";

type Handler = (event: never, ctx: ExtensionContext) => void;
const originalRender = Container.prototype.render;
const stops: Array<() => void> = [];
afterEach(() => {
	for (const stop of stops.splice(0)) stop();
	expect(Container.prototype.render).toBe(originalRender);
});

function feature(): (name: string, ctx?: Partial<ExtensionContext>) => void {
	const handlers = new Map<string, Handler>();
	const pi = {
		on: (name: string, handler: Handler) => handlers.set(name, handler),
	} as unknown as ExtensionAPI;
	registerToolSummaryFeature(pi);
	const emit = (name: string, ctx: Partial<ExtensionContext> = {}): void => {
		handlers.get(name)?.(undefined as never, ctx as ExtensionContext);
	};
	stops.push(() => emit("session_shutdown"));
	return emit;
}

describe("registerToolSummaryFeature", () => {
	it("installs only for interactive TUI sessions and restores on shutdown", () => {
		const emit = feature();
		expect(Container.prototype.render).toBe(originalRender);
		emit("session_start", { hasUI: true, mode: "tui" });
		expect(Container.prototype.render).not.toBe(originalRender);
		emit("session_shutdown");
		expect(Container.prototype.render).toBe(originalRender);
	});

	it("does not stack patches across repeated session starts or reloads", () => {
		const emit = feature();
		for (let iteration = 0; iteration < 3; iteration++) {
			emit("session_start", { hasUI: true, mode: "tui" });
		}
		emit("session_shutdown");
		expect(Container.prototype.render).toBe(originalRender);
		const reloaded = feature();
		reloaded("session_start", { hasUI: true, mode: "tui" });
		reloaded("session_shutdown");
		expect(Container.prototype.render).toBe(originalRender);
	});

	it.each([
		{ hasUI: false, mode: "tui" },
		{ hasUI: true, mode: "rpc" },
		{ hasUI: false, mode: "print" },
	] as const)("leaves $mode (hasUI=$hasUI) unchanged", (ctx) => {
		const emit = feature();
		emit("session_start", ctx);
		expect(Container.prototype.render).toBe(originalRender);
	});
});
