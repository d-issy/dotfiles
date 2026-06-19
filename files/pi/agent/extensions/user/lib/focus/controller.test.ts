import assert from "node:assert/strict";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import { createTestPiProject } from "../test-support/pi-project";
import { BASE_FOCUS, FOCUS_STATE_TYPE } from "./definitions";
import { createFocusController } from "./controller";
import { createFocusSharedState } from "./state";

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
	readonly statuses: Record<string, string | undefined>;
	readonly notifications: string[];
} {
	const statuses: Record<string, string | undefined> = {};
	const notifications: string[] = [];
	return {
		cwd,
		hasUI: false,
		statuses,
		notifications,
		isProjectTrusted: () => true,
		ui: {
			setStatus: (key: string, value: string | undefined) => {
				statuses[key] = value;
			},
			notify: (message: string) => notifications.push(message),
		},
	} as unknown as ExtensionContext & {
		readonly statuses: Record<string, string | undefined>;
		readonly notifications: string[];
	};
}

describe("createFocusController", () => {
	it("enters, persists, restores, and leaves focuses", () => {
		const pi = fakePi();
		const sharedState = createFocusSharedState();
		const controller = createFocusController(pi, sharedState);
		const ctx = context(
			createTestPiProject({ includeUserSettings: false }).cwd,
		);

		const entered = controller.enter(ctx, "explore");

		assert.equal(entered.name, "explore");
		assert.equal(controller.current, "explore");
		assert.equal(sharedState.currentFocusName, "explore");
		assert.deepEqual(pi.entries, [
			{ customType: FOCUS_STATE_TYPE, data: { focus: "explore" } },
		]);
		assert.ok(pi.activeTools.includes("read_chunk"));
		assert.equal(typeof ctx.statuses.focus, "string");

		controller.restore(ctx, "edit");
		assert.equal(controller.current, "edit");
		assert.equal(controller.active?.name, "edit");

		controller.restore(ctx, "missing");
		assert.equal(controller.current, BASE_FOCUS);
		assert.equal(controller.active, undefined);
		assert.equal(ctx.statuses.focus, undefined);

		controller.enter(ctx, "explore", { persist: false });
		const previous = controller.leave(ctx);
		assert.equal(previous?.name, "explore");
		assert.equal(controller.current, BASE_FOCUS);
		assert.deepEqual(pi.entries.at(-1), {
			customType: FOCUS_STATE_TYPE,
			data: { focus: BASE_FOCUS },
		});
	});

	it("reloads project focuses, reports warnings, and drops stale active focus", () => {
		const pi = fakePi();
		const sharedState = createFocusSharedState();
		sharedState.setFocusState("missing", undefined, sharedState.registry);
		const controller = createFocusController(pi, sharedState);
		const project = createTestPiProject({
			rawSettings: JSON.stringify([]),
			includeStandardPiConfig: true,
		});
		const ctx = context(project.cwd);

		controller.loadProjectFocuses(ctx);

		assert.equal(controller.current, BASE_FOCUS);
		assert.equal(controller.registry.get("explore")?.name, "explore");
		assert.match(ctx.notifications.join("\n"), /must contain a JSON object/u);
		assert.deepEqual(
			controller.allowedToolNames(pi),
			new Set(["multi_tool_use.parallel", "enter_focus"]),
		);
	});

	it("does not re-enter the same focus unless forced", () => {
		const pi = fakePi();
		const controller = createFocusController(pi, createFocusSharedState());
		const ctx = context(
			createTestPiProject({ includeUserSettings: false }).cwd,
		);

		controller.enter(ctx, "explore");
		const entryCount = pi.entries.length;
		controller.enter(ctx, "explore");
		controller.enter(ctx, "explore", { force: true, persist: false });

		assert.equal(pi.entries.length, entryCount);
		assert.equal(controller.current, "explore");
	});
});
