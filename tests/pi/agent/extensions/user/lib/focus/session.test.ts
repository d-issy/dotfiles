import assert from "node:assert/strict";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import { createTestPiProject } from "../test-support/pi-project";
import { BASE_FOCUS, FOCUS_STATE_TYPE } from "#pi-user/lib/focus/definitions";
import { createFocusController } from "#pi-user/lib/focus/controller";
import { createFocusRuntime } from "#pi-user/lib/focus/runtime";
import { createFocusSharedState } from "#pi-user/lib/focus/state";
import type {
	RegisteredSystemReminder,
	SystemReminderPayload,
} from "#pi-user/lib/system-reminder";
import type { FocusReminderDetails } from "#pi-user/lib/focus/prompt";
import {
	autoContinueAfterFocusTransition,
	persistFocusBeforeNew,
	restoreFocus,
} from "#pi-user/lib/focus/session";

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
				"read_chunk",
				"grep",
				"find",
				"ls",
				"write",
				"edit",
				"edit_chunk",
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
			"read_chunk",
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
	it("sends no-focus auto-continue message after focus exit", async () => {
		const pi = fakePi();
		const runtime = createFocusRuntime();
		runtime.scheduleAutoContinue(BASE_FOCUS);

		const focus = {
			current: BASE_FOCUS,
			active: undefined,
		};

		let capturedContent: readonly string[] | undefined;
		const reminder: RegisteredSystemReminder<FocusReminderDetails> = {
			sendWakeup: (
				_pi: never,
				payload: SystemReminderPayload<FocusReminderDetails>,
			) => {
				capturedContent = Array.isArray(payload.content)
					? payload.content
					: [payload.content];
				return { message: undefined, delivered: true };
			},
		} as unknown as RegisteredSystemReminder<FocusReminderDetails>;

		await autoContinueAfterFocusTransition(
			pi as unknown as ExtensionAPI,
			focus as never,
			runtime,
			reminder,
		)(undefined as never, undefined as never);

		assert.ok(capturedContent, "sendWakeup should have been called");
		assert.equal(
			capturedContent[0],
			"No focus is active. Previous focus instructions and tool definitions are no longer active.",
		);
		assert.equal(
			capturedContent[2],
			"Use only the tool definitions in the latest reminder. If focus-scoped tools are needed, call enter_focus to do the work yourself, or subagent with the target focus to delegate it without entering.",
		);
	});
});
