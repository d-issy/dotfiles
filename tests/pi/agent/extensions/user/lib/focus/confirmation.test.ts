import assert from "node:assert/strict";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, it } from "vitest";
import {
	clearFocusTransitionDecisions,
	confirmExitFocusTransition,
	confirmFocusTransition,
	isFocusAllowedForSession,
	isFocusDeniedForSession,
	rememberFocusTransitionDecision,
} from "#pi-user/lib/focus/confirmation";

type CustomComponent = {
	handleInput(data: string): void;
	render(width: number): string[];
	invalidate(): void;
};

function identity(value: string): string {
	return value;
}

function theme(): Record<string, unknown> {
	return { fg: (_role: string, text: string) => text, bold: identity };
}

function keybindings(): Record<string, unknown> {
	return {
		matches: (data: string, action: string) =>
			(data === "up" && action === "tui.select.up") ||
			(data === "down" && action === "tui.select.down") ||
			(data === "enter" && action === "tui.select.confirm") ||
			(data === "esc" && action === "tui.select.cancel"),
	};
}

function context(options: {
	readonly inputs: readonly string[];
	readonly editorResults?: readonly (string | undefined)[];
	readonly renderWidth?: number;
	readonly onRender?: (lines: readonly string[]) => void;
	readonly onCustomCall?: (index: number) => void;
}): ExtensionContext {
	const inputs = [...options.inputs];
	const editorResults = [...(options.editorResults ?? [])];
	let customCalls = 0;
	return {
		hasUI: true,
		ui: {
			custom: async <T>(
				build: (
					tui: { requestRender(): void },
					theme: Record<string, unknown>,
					keybindings: Record<string, unknown>,
					done: (value: T) => void,
				) => CustomComponent,
			): Promise<T> =>
				new Promise((resolve) => {
					customCalls += 1;
					options.onCustomCall?.(customCalls);
					if (customCalls > 1 && editorResults.length > 0) {
						resolve(editorResults.shift() as T);
						return;
					}
					const component = build(
						{ requestRender: () => undefined },
						theme(),
						keybindings(),
						resolve,
					);
					options.onRender?.(component.render(options.renderWidth ?? 80));
					component.invalidate();
					component.handleInput(inputs.shift() ?? "esc");
				}),
			editor: async () => editorResults.shift(),
		},
	} as unknown as ExtensionContext;
}

describe("focus confirmation", () => {
	beforeEach(() => clearFocusTransitionDecisions());

	it("records allow and deny decisions for the current session", () => {
		assert.equal(isFocusAllowedForSession("edit"), false);
		assert.equal(isFocusDeniedForSession("edit"), false);

		rememberFocusTransitionDecision("edit", { choice: "allow-session" });
		assert.equal(isFocusAllowedForSession("edit"), true);
		assert.equal(isFocusDeniedForSession("edit"), false);

		rememberFocusTransitionDecision("edit", { choice: "deny-session" });
		assert.equal(isFocusAllowedForSession("edit"), false);
		assert.equal(isFocusDeniedForSession("edit"), true);

		clearFocusTransitionDecisions();
		assert.equal(isFocusAllowedForSession("edit"), false);
		assert.equal(isFocusDeniedForSession("edit"), false);
	});

	it("selects enter-focus decisions from printable shortcuts and cancel keys", async () => {
		assert.deepEqual(
			await confirmFocusTransition(
				context({ inputs: ["a"] }),
				"enter_focus",
				"edit",
				"Need changes",
			),
			{ choice: "allow-session" },
		);
		assert.equal(
			await confirmFocusTransition(
				context({ inputs: ["esc"] }),
				"enter_focus",
				"edit",
				"Need changes",
			),
			undefined,
		);
	});

	it("does not re-prompt parallel subagents once one is allowed for the session", async () => {
		let secondRenders = 0;
		const [first, second] = await Promise.all([
			confirmFocusTransition(
				context({ inputs: ["a"] }),
				"subagent",
				"edit",
				"first request",
			),
			confirmFocusTransition(
				context({
					inputs: ["d"],
					onRender: () => {
						secondRenders += 1;
					},
				}),
				"subagent",
				"edit",
				"second request",
			),
		]);

		assert.deepEqual(first, { choice: "allow-session" });
		// The second subagent short-circuits to the first decision without showing
		// its own dialog, so its "deny-session" input is never read.
		assert.deepEqual(second, { choice: "allow-session" });
		assert.equal(secondRenders, 0);
		assert.equal(isFocusAllowedForSession("edit"), true);
	});

	it("still prompts each subagent when the decision is only allow-once", async () => {
		let secondRenders = 0;
		const [first, second] = await Promise.all([
			confirmFocusTransition(
				context({ inputs: ["y"] }),
				"subagent",
				"edit",
				"first request",
			),
			confirmFocusTransition(
				context({
					inputs: ["y"],
					onRender: () => {
						secondRenders += 1;
					},
				}),
				"subagent",
				"edit",
				"second request",
			),
		]);

		assert.deepEqual(first, { choice: "allow-once" });
		assert.deepEqual(second, { choice: "allow-once" });
		// "Allow once" is not remembered, so the second subagent still prompts.
		assert.ok(secondRenders > 0);
		assert.equal(isFocusAllowedForSession("edit"), false);
	});

	it("does not interleave another subagent confirmation before reject reason input", async () => {
		const events: string[] = [];
		const [first, second] = await Promise.all([
			confirmFocusTransition(
				context({
					inputs: ["r"],
					editorResults: ["needs details"],
					onCustomCall: (index) => events.push(`first:${index}`),
				}),
				"subagent",
				"edit",
				"first request",
				"first prompt",
			),
			confirmFocusTransition(
				context({
					inputs: ["y"],
					onCustomCall: (index) => events.push(`second:${index}`),
				}),
				"subagent",
				"edit",
				"second request",
				"second prompt",
			),
		]);

		assert.deepEqual(first, {
			choice: "deny-once",
			rejectReason: "needs details",
		});
		assert.deepEqual(second, { choice: "allow-once" });
		assert.deepEqual(events, ["first:1", "first:2", "second:1"]);
	});
	it("supports exit denial with an edited reject reason", async () => {
		assert.deepEqual(
			await confirmExitFocusTransition(
				context({ inputs: ["r"], editorResults: [" needs tests "] }),
				"interview",
				"requirements complete",
			),
			{ confirmed: false, rejectReason: "needs tests" },
		);
	});

	it("returns to the exit confirmation when reason editing is cancelled", async () => {
		assert.deepEqual(
			await confirmExitFocusTransition(
				context({ inputs: ["r", "y"], editorResults: [undefined] }),
				"interview",
				"requirements complete",
			),
			{ confirmed: true },
		);
	});

	it("wraps and pads focus transition reasons", async () => {
		const exitLines: Array<readonly string[]> = [];
		assert.deepEqual(
			await confirmExitFocusTransition(
				context({
					inputs: ["y"],
					renderWidth: 32,
					onRender: (lines) => exitLines.push(lines),
				}),
				"interview",
				"requirements are now complete and the user approved proceeding",
			),
			{ confirmed: true },
		);
		assert.deepEqual(exitLines[0]?.slice(2, 5), [
			" Reason: requirements are now   ",
			"         complete and the user  ",
			"         approved proceeding    ",
		]);

		const enterLines: Array<readonly string[]> = [];
		assert.deepEqual(
			await confirmFocusTransition(
				context({
					inputs: ["a"],
					renderWidth: 32,
					onRender: (lines) => enterLines.push(lines),
				}),
				"enter_focus",
				"edit",
				"need focused edits before running checks",
			),
			{ choice: "allow-session" },
		);
		assert.deepEqual(enterLines[0]?.slice(2, 4), [
			" Reason: need focused edits     ",
			"         before running checks  ",
		]);
	});
});
