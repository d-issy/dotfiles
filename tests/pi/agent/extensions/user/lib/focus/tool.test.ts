import assert from "node:assert/strict";
import type {
	AgentToolResult,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import { createToolCatalog } from "#pi-user/lib/tool/catalog";
import type { FocusController } from "#pi-user/lib/focus/controller";
import {
	BASE_FOCUS,
	FOCUS_EXIT_MODE,
	type FocusDefinition,
} from "#pi-user/lib/focus/definitions";
import { createFocusRuntime } from "#pi-user/lib/focus/runtime";
import { registerExitFocusTool } from "#pi-user/lib/focus/tool";

type FocusToolDefinition = {
	execute: (
		toolCallId: string,
		params: Record<string, string | undefined>,
		signal: AbortSignal | undefined,
		onUpdate: undefined,
		ctx: ExtensionContext,
	) => Promise<AgentToolResult<Record<string, unknown>>>;
};

function definition(overrides: Partial<FocusDefinition> = {}): FocusDefinition {
	return {
		name: "explore",
		description: "Explore files",
		prompt: "Explore prompt",
		tools: ["read"],
		transition: "auto",
		...overrides,
	};
}

function context(hasUI = false): ExtensionContext {
	return { hasUI } as ExtensionContext;
}

function focusController(options: {
	readonly current?: string;
	readonly active?: FocusDefinition;
	readonly definitions?: readonly FocusDefinition[];
}): FocusController & {
	readonly entered: string[];
	readonly left: string[];
} {
	let current = options.current ?? options.active?.name ?? BASE_FOCUS;
	let active = options.active;
	const definitions = options.definitions ?? [definition()];
	const entered: string[] = [];
	const left: string[] = [];
	return {
		entered,
		left,
		get current() {
			return current;
		},
		get active() {
			return active;
		},
		registry: {
			get: (name: string) => definitions.find((focus) => focus.name === name),
			list: () => definitions,
			search: () => definitions,
		},
		enter: (_ctx: ExtensionContext, name: string) => {
			const next = definitions.find((focus) => focus.name === name);
			if (!next) throw new Error(`Unknown focus: ${name}`);
			entered.push(name);
			current = next.name;
			active = next;
			return next;
		},
		leave: () => {
			const previous = active;
			left.push(previous?.name ?? BASE_FOCUS);
			current = BASE_FOCUS;
			active = undefined;
			return previous;
		},
	} as unknown as FocusController & {
		readonly entered: string[];
		readonly left: string[];
	};
}

function registerExit(
	focus: FocusController,
	runtime = createFocusRuntime(),
): FocusToolDefinition {
	const catalog = createToolCatalog();
	registerExitFocusTool(focus, runtime, catalog);
	return catalog.list()[0]?.definition as unknown as FocusToolDefinition;
}

describe("focus management tools", () => {
	it("exits base and active focuses with runtime handoff", async () => {
		const baseTool = registerExit(focusController({}));
		const base = await baseTool.execute(
			"call",
			{ reason: "done" },
			undefined,
			undefined,
			context(),
		);
		assert.equal(base.details.reason, "already-base");

		const runtime = createFocusRuntime();
		const focus = focusController({
			current: "explore",
			active: definition({ name: "explore", exitPrompt: "Exit prompt" }),
		});
		const exitTool = registerExit(focus, runtime);
		const exited = await exitTool.execute(
			"call",
			{ reason: "done" },
			undefined,
			undefined,
			context(),
		);

		assert.equal(exited.details.ok, true);
		assert.equal(exited.details.previous, "explore");
		assert.equal(exited.details.exitPrompt, "Exit prompt");
		assert.equal(exited.terminate, true);
		assert.equal(runtime.pendingAutoContinue?.focusName, BASE_FOCUS);
		assert.deepEqual(focus.left, ["explore"]);
	});

	it("blocks explicit focus exits when UI confirmation is unavailable", async () => {
		const active = definition({
			name: "interview",
			exitMode: FOCUS_EXIT_MODE.EXPLICIT,
		});
		const tool = registerExit(
			focusController({ current: "interview", active, definitions: [active] }),
		);

		const result = await tool.execute(
			"call",
			{ reason: "done" },
			undefined,
			undefined,
			context(false),
		);

		assert.equal(result.details.ok, false);
		assert.equal(result.details.reason, "confirmation-unavailable");
	});
});
