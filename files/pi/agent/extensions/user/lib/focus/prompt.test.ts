import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import type { SystemReminderRegistry } from "../system-reminder";
import type { FocusController } from "./controller";
import {
	ENTER_FOCUS_TOOL,
	EXIT_FOCUS_TOOL,
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
		transition: "confirm",
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
}): FocusController {
	const active = options.active;
	return {
		current: options.current ?? active?.name ?? "base",
		active,
		allowedToolNames: () =>
			new Set(options.allowed ?? ["read", ENTER_FOCUS_TOOL]),
		registry: {
			search: () => [activeFocus({ name: "explore", description: "Explore" })],
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
		assert.match(payload.content, /\[ACTIVE FOCUS: edit\]/u);
		assert.match(payload.content, /"name": "read"/u);
		assert.doesNotMatch(payload.content, /"name": "write"/u);
	});
});
