import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import type { SystemReminderRegistry } from "#pi-user/lib/system-reminder";
import type { FocusController } from "#pi-user/lib/focus/controller";
import {
	EXIT_FOCUS_TOOL,
	FOCUS_TRANSITION,
	type FocusDefinition,
} from "#pi-user/lib/focus/definitions";
import {
	type FocusReminderDetails,
	injectFocusRestorePrompt,
	registerFocusReminderSource,
} from "#pi-user/lib/focus/prompt";
import { createFocusRuntime } from "#pi-user/lib/focus/runtime";

function activeFocus(
	overrides: Partial<FocusDefinition> = {},
): FocusDefinition {
	return {
		name: "edit",
		description: "Edit files",
		prompt: "Edit prompt",
		tools: ["read", "write"],
		transition: FOCUS_TRANSITION.CONFIRM,
		...overrides,
	};
}

function pi(): ExtensionAPI {
	return {
		getAllTools: () => [
			{
				name: "read",
				description: "Read files",
				parameters: { type: "object" },
			},
			{
				name: "write",
				description: "Write files",
				parameters: { type: "object" },
			},
			{ name: "agent", description: "Spawn agent", parameters: {} },
			{ name: EXIT_FOCUS_TOOL, description: "Exit focus", parameters: {} },
			{
				name: "edit_chunk",
				description: "Edit chunks",
				parameters: { type: "object" },
			},
		],
	} as unknown as ExtensionAPI;
}

function focusController(options: {
	readonly current?: string;
	readonly active?: FocusDefinition;
	readonly allowed?: readonly string[];
	readonly searchable?: readonly FocusDefinition[];
}): FocusController {
	const active = options.active;
	return {
		current: options.current ?? active?.name ?? "base",
		active,
		allowedToolNames: () => new Set(options.allowed ?? ["read", "agent"]),
		registry: {
			search: () =>
				options.searchable ?? [
					activeFocus({
						name: "explore",
						description: "Explore",
						transition: FOCUS_TRANSITION.AUTO,
					}),
				],
		},
	} as unknown as FocusController;
}

function beforeAgentEvent(systemPrompt: string): {
	readonly systemPrompt: string;
	readonly systemPromptOptions: {
		readonly toolSnippets: Record<string, string>;
	};
} {
	return {
		systemPrompt,
		systemPromptOptions: {
			toolSnippets: {
				read: "Read files",
				write: "Write files",
				agent: "Spawn agent",
				[EXIT_FOCUS_TOOL]: "Exit focus",
			},
		},
	};
}

const baseSystemPrompt = [
	"Available tools:",
	"old tools",
	"",
	"In addition to the tools above",
	"",
	"Guidelines:",
	"old guidelines",
	"",
	"Pi documentation",
	"",
	"The following skills provide specialized instructions for specific tasks.",
	"<available_skills>",
	"  <skill />",
	"</available_skills>",
].join("\n");

describe("focus prompt injection", () => {
	it("rewrites visible tools and appends routing instructions in base focus", async () => {
		const runtime = createFocusRuntime();
		const result = await injectFocusRestorePrompt(
			pi(),
			focusController({ allowed: ["agent"] }),
			runtime,
		)(beforeAgentEvent(baseSystemPrompt) as never, undefined as never);

		assert.match(result?.systemPrompt ?? "", /- agent: Spawn agent/u);
		assert.doesNotMatch(result?.systemPrompt ?? "", /enter_focus/u);
		assert.doesNotMatch(result?.systemPrompt ?? "", /- read: Read files/u);
		assert.doesNotMatch(result?.systemPrompt ?? "", /<available_skills>/u);
		assert.match(result?.systemPrompt ?? "", /\[FOCUS\]/u);
		assert.match(result?.systemPrompt ?? "", /explore: Explore/u);
	});

	it("marks confirmation-required focuses in routing instructions", async () => {
		const runtime = createFocusRuntime();
		const result = await injectFocusRestorePrompt(
			pi(),
			focusController({
				allowed: ["agent"],
				searchable: [
					activeFocus({
						name: "explore",
						description: "Explore",
						transition: FOCUS_TRANSITION.AUTO,
					}),
					activeFocus({
						name: "edit",
						description: "Edit files",
						transition: FOCUS_TRANSITION.CONFIRM,
					}),
				],
			}),
			runtime,
		)(beforeAgentEvent(baseSystemPrompt) as never, undefined as never);

		assert.match(result?.systemPrompt ?? "", /- explore: Explore/u);
		assert.match(
			result?.systemPrompt ?? "",
			/- edit \(reason required\): Edit files/u,
		);
	});

	it("injects restore prompts once for restored active focuses", async () => {
		const runtime = createFocusRuntime();
		runtime.setRestorePromptPending(true);
		const focus = focusController({ active: activeFocus(), allowed: ["read"] });

		const first = await injectFocusRestorePrompt(
			pi(),
			focus,
			runtime,
		)(beforeAgentEvent(baseSystemPrompt) as never, undefined as never);
		const second = await injectFocusRestorePrompt(
			pi(),
			focus,
			runtime,
		)(beforeAgentEvent(baseSystemPrompt) as never, undefined as never);

		assert.match(first?.systemPrompt ?? "", /\[FOCUS RESTORED: edit\]/u);
		assert.match(second?.systemPrompt ?? "", /\[ACTIVE FOCUS: edit\]/u);
		assert.doesNotMatch(second?.systemPrompt ?? "", /\[FOCUS RESTORED/u);
	});

	it("hides focus management tools and adds lock guidance in locked focus mode", async () => {
		const runtime = createFocusRuntime();
		runtime.setLockedFocusName("edit");
		const focus = focusController({
			active: activeFocus(),
			allowed: ["read", EXIT_FOCUS_TOOL],
		});

		const result = await injectFocusRestorePrompt(
			pi(),
			focus,
			runtime,
		)(beforeAgentEvent(baseSystemPrompt) as never, undefined as never);

		assert.match(result?.systemPrompt ?? "", /\[FOCUS LOCKED: edit\]/u);
		assert.match(result?.systemPrompt ?? "", /- read: Read files/u);
		assert.doesNotMatch(result?.systemPrompt ?? "", /enter_focus/u);
		assert.doesNotMatch(result?.systemPrompt ?? "", /exit_focus/u);
	});

	it("builds current reminder payloads and rejects stale reminder details", () => {
		const runtime = createFocusRuntime();
		const transition = runtime.recordFocusChange("edit");
		runtime.requestFocusReminder();
		const registered: Parameters<SystemReminderRegistry["register"]>[0][] = [];
		const reminders = {
			register: (source: Parameters<SystemReminderRegistry["register"]>[0]) => {
				registered.push(source);
				return { sendWakeup: () => undefined };
			},
		} as unknown as SystemReminderRegistry;

		registerFocusReminderSource(
			pi(),
			focusController({ active: activeFocus(), allowed: ["read"] }),
			runtime,
			reminders,
		);
		const source = registered[0] as unknown as {
			consumePending: () => boolean;
			isCurrent: (details: unknown, message: never) => boolean;
			buildReminder: () => {
				content: string;
				details: FocusReminderDetails;
			};
		};
		const payload = source.buildReminder();

		assert.equal(source.consumePending(), true);
		assert.equal(source.consumePending(), false);
		assert.equal(
			source.isCurrent({ transitionId: transition.id }, undefined as never),
			true,
		);
		assert.equal(
			source.isCurrent({ transitionId: transition.id - 1 }, undefined as never),
			false,
		);
		assert.equal(payload.details.focus, "edit");
		assert.equal(
			payload.content,
			[
				"Current focus: edit. Follow the focus instructions.",
				"",
				"Focus instructions:",
				"[ACTIVE FOCUS: edit]",
				"Edit prompt",
				"",
				"Available tool definitions:",
				"```json",
				JSON.stringify(
					[
						{
							name: "read",
							description: "Read files",
							parameters: { type: "object" },
						},
					],
					null,
					2,
				),
				"```",
			].join("\n"),
		);
	});

	it("does not describe base as the current mode in reminder payloads", () => {
		const runtime = createFocusRuntime();
		runtime.recordFocusChange("base");
		runtime.requestFocusReminder();
		const registered: Parameters<SystemReminderRegistry["register"]>[0][] = [];
		const reminders = {
			register: (source: Parameters<SystemReminderRegistry["register"]>[0]) => {
				registered.push(source);
				return { sendWakeup: () => undefined };
			},
		} as unknown as SystemReminderRegistry;

		registerFocusReminderSource(
			pi(),
			focusController({ allowed: ["agent"] }),
			runtime,
			reminders,
		);
		const source = registered[0] as unknown as {
			buildReminder: () => {
				content: string;
				details: FocusReminderDetails;
			};
		};
		const payload = source.buildReminder();

		assert.equal(payload.details.focus, "base");
		assert.equal(
			payload.content,
			[
				"No focus is active.",
				"Previous focus instructions and tool definitions are no longer active.",
				"Use only the tool definitions in this latest reminder.",
				"If focus-scoped tools are needed, call agent with the target focus to delegate it.",
				"",
				"Focus routing instructions:",
				"[FOCUS]",
				"Use focuses to solve the user's request.",
				"",
				"Focus rules:",
				"- A focus is an operational mode that controls available tools and instructions.",
				"- Use the descriptions below to choose which focus a task needs.",
				"- Before substantive work, delegate focus-scoped work with agent using the target focus parameter.",
				"- Prefer agent when focus-scoped tools are needed; it keeps this context clean and can run work in parallel.",
				"- Auto focuses may be entered without asking the user.",
				"- Do not ask the user for information that can be discovered after entering an appropriate focus.",
				"- If a needed capability is not visible, first check whether another available focus exposes it.",
				"",
				"Available focuses:",
				"- explore: Explore",
				"",
				"Available tool definitions:",
				"```json",
				JSON.stringify(
					[
						{
							name: "agent",
							description: "Spawn agent",
							parameters: {},
						},
					],
					null,
					2,
				),
				"```",
			].join("\n"),
		);
		assert.doesNotMatch(payload.content, /edit_chunk/u);
	});
});
