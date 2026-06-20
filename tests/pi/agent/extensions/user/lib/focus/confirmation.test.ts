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

		rememberFocusTransitionDecision("edit", "allow-session");
		assert.equal(isFocusAllowedForSession("edit"), true);
		assert.equal(isFocusDeniedForSession("edit"), false);

		rememberFocusTransitionDecision("edit", "deny-session");
		assert.equal(isFocusAllowedForSession("edit"), false);
		assert.equal(isFocusDeniedForSession("edit"), true);

		clearFocusTransitionDecisions();
		assert.equal(isFocusAllowedForSession("edit"), false);
		assert.equal(isFocusDeniedForSession("edit"), false);
	});

	it("selects enter-focus decisions from printable shortcuts and cancel keys", async () => {
		assert.equal(
			await confirmFocusTransition(
				context({ inputs: ["a"] }),
				"edit",
				"Need changes",
			),
			"allow-session",
		);
		assert.equal(
			await confirmFocusTransition(
				context({ inputs: ["esc"] }),
				"edit",
				"Need changes",
			),
			undefined,
		);
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
		assert.equal(
			await confirmFocusTransition(
				context({
					inputs: ["a"],
					renderWidth: 32,
					onRender: (lines) => enterLines.push(lines),
				}),
				"edit",
				"need focused edits before running checks",
			),
			"allow-session",
		);
		assert.deepEqual(enterLines[0]?.slice(2, 4), [
			" Reason: need focused edits     ",
			"         before running checks  ",
		]);
	});
});
