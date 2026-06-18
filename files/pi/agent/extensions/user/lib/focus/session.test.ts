import assert from "node:assert/strict";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import { createTestPiProject } from "../test-support/pi-project";
import { BASE_FOCUS, FOCUS_STATE_TYPE } from "./definitions";
import { createFocusController } from "./controller";
import { createFocusRuntime } from "./runtime";
import { createFocusSharedState } from "./state";
import { persistFocusBeforeNew, restoreFocus } from "./session";

function fakePi(): ExtensionAPI & {
	readonly entries: { customType: string; data: unknown }[];
	activeTools: string[];
} {
	const entries: { customType: string; data: unknown }[] = [];
	const api = {
		entries,
		activeTools: [] as string[],
		getAllTools: () =>
			[
				"multi_tool_use.parallel",
				"enter_focus",
				"exit_focus",
				"read",
				"grep",
				"find",
				"ls",
				"write",
				"edit",
				"mv",
				"rm",
			].map((name) => ({ name })),
		setActiveTools: (tools: string[]) => {
			api.activeTools = tools;
		},
		appendEntry: (customType: string, data: unknown) => {
			entries.push({ customType, data });
		},
	};
	return api as unknown as ExtensionAPI & {
		readonly entries: { customType: string; data: unknown }[];
		activeTools: string[];
	};
}

function context(cwd: string): ExtensionContext & {
	readonly notifications: string[];
} {
	const notifications: string[] = [];
	return {
		cwd,
		hasUI: false,
		isProjectTrusted: () => true,
		sessionManager: { getEntries: () => [] },
		ui: {
			setStatus: () => undefined,
			notify: (message: string) => notifications.push(message),
		},
		notifications,
	} as unknown as ExtensionContext & { readonly notifications: string[] };
}

describe("focus session lifecycle", () => {
	it("locks to --focus without persisting or exposing focus management tools", async () => {
		const pi = fakePi();
		const runtime = createFocusRuntime();
		const sharedState = createFocusSharedState();
		const focus = createFocusController(pi, sharedState);
		const ctx = context(
			createTestPiProject({ includeUserSettings: false }).cwd,
		);

		await restoreFocus(focus, runtime, {
			getLockedFocusName: () => "explore",
			onLockedFocusName: (name) => sharedState.setLockedFocusName(name),
		})(undefined as never, ctx);

		assert.equal(runtime.lockedFocusName, "explore");
		assert.equal(sharedState.lockedFocusName, "explore");
		assert.equal(focus.current, "explore");
		assert.deepEqual(pi.entries, []);
		assert.deepEqual(pi.activeTools, [
			"multi_tool_use.parallel",
			"read",
			"grep",
			"find",
			"ls",
		]);
	});

	it("reports unknown locked focuses", async () => {
		const pi = fakePi();
		const runtime = createFocusRuntime();
		const focus = createFocusController(pi, createFocusSharedState());
		const ctx = context(
			createTestPiProject({ includeUserSettings: false }).cwd,
		);

		await assert.rejects(async () => {
			await restoreFocus(focus, runtime, {
				getLockedFocusName: () => "missing",
			})(undefined as never, ctx);
		}, /Unknown --focus 'missing'/u);
		assert.equal(focus.current, BASE_FOCUS);
	});

	it("does not persist focus across new sessions when locked", async () => {
		const pi = fakePi();
		const runtime = createFocusRuntime();
		const focus = createFocusController(pi, createFocusSharedState());
		const ctx = context(
			createTestPiProject({ includeUserSettings: false }).cwd,
		);

		focus.enter(ctx, "explore");
		const entryCount = pi.entries.length;
		await persistFocusBeforeNew(
			pi,
			focus,
			runtime,
		)({ reason: "new" } as never, ctx);
		assert.deepEqual(pi.entries.at(-1), {
			customType: FOCUS_STATE_TYPE,
			data: { focus: "explore" },
		});

		runtime.setLockedFocusName("explore");
		await persistFocusBeforeNew(
			pi,
			focus,
			runtime,
		)({ reason: "new" } as never, ctx);
		assert.equal(pi.entries.length, entryCount + 1);
	});
});
