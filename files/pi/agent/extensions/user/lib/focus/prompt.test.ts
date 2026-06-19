import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import type { SystemReminderRegistry } from "../system-reminder";
import type { FocusController } from "./controller";
import {
	ENTER_FOCUS_TOOL,
	EXIT_FOCUS_TOOL,
	FOCUS_TRANSITION,
	type FocusDefinition,
} from "./definitions";
import {
	type FocusReminderDetails,
	injectFocusRestorePrompt,
	registerFocusReminderSource,
} from "./prompt";
import { createFocusRuntime } from "./runtime";

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
			{ name: ENTER_FOCUS_TOOL, description: "Enter focus", parameters: {} },
			{ name: EXIT_FOCUS_TOOL, description: "Exit focus", parameters: {} },
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
		allowedToolNames: () =>
			new Set(options.allowed ?? ["read", ENTER_FOCUS_TOOL]),
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
				[ENTER_FOCUS_TOOL]: "Enter focus",
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
			focusController({ allowed: [ENTER_FOCUS_TOOL] }),
			runtime,
		)(beforeAgentEvent(baseSystemPrompt) as never, undefined as never);

		assert.match(result?.systemPrompt ?? "", /- enter_focus: Enter focus/u);
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
				allowed: [ENTER_FOCUS_TOOL],
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
			allowed: ["read", ENTER_FOCUS_TOOL, EXIT_FOCUS_TOOL],
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
			focusController({ allowed: [ENTER_FOCUS_TOOL] }),
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
				"Follow the focus routing instructions.",
				"",
				"Focus routing instructions:",
				"[FOCUS]",
				"Use focuses to solve the user's request.",
				"",
				"Focus rules:",
				"- A focus is an operational mode that controls available tools and instructions.",
				"- Use the descriptions below to choose when to enter each focus.",
				"- Enter the appropriate focus before doing substantive work.",
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
							name: ENTER_FOCUS_TOOL,
							description: "Enter focus",
							parameters: {},
						},
					],
					null,
					2,
				),
				"```",
			].join("\n"),
		);
	});
});
