import assert from "node:assert/strict";
import type {
	ContextEvent,
	ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { afterEach, describe, it, vi } from "vitest";
import {
	createSystemReminderRegistry,
	injectSystemReminderHandlingPrompt,
} from "./system-reminder";

type ContextMessage = ContextEvent["messages"][number];

function context(messages: readonly ContextMessage[]): ContextEvent {
	return { messages } as ContextEvent;
}

describe("createSystemReminderRegistry", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("creates wrapped hidden reminder messages", () => {
		const registry = createSystemReminderRegistry();
		const reminder = registry.register<{ id: number }>({
			customType: "demo-reminder",
			buildReminder: () => undefined,
		});

		assert.deepEqual(reminder.createMessage({ content: "hello" }), {
			customType: "demo-reminder",
			content: "<system-reminder>\nhello\n</system-reminder>",
			display: false,
		});
		assert.deepEqual(
			registry.createMessage("demo-reminder", {
				content: ["line one", "line two"],
				details: { id: 1 },
			}),
			{
				customType: "demo-reminder",
				content: "<system-reminder>\nline one\nline two\n</system-reminder>",
				display: false,
				details: { id: 1 },
			},
		);
	});

	it("rejects duplicate and unknown sources", () => {
		const registry = createSystemReminderRegistry();
		registry.register({
			customType: "demo-reminder",
			buildReminder: () => undefined,
		});

		assert.throws(
			() =>
				registry.register({
					customType: "demo-reminder",
					buildReminder: () => undefined,
				}),
			/Duplicate system reminder source/u,
		);
		assert.throws(
			() => registry.request("missing-reminder"),
			/Unknown system reminder source/u,
		);
	});

	it("injects requested reminders and keeps unrelated messages", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-02T03:04:05Z"));
		const registry = createSystemReminderRegistry();
		const reminder = registry.register<{ state: string }>({
			customType: "demo-reminder",
			buildReminder: () => ({
				content: "fresh reminder",
				details: { state: "current" },
			}),
		});
		const userMessage = { role: "user", content: "hello" } as ContextMessage;

		reminder.request();
		const result = await registry.inject(
			context([userMessage]),
			undefined as never,
		);

		assert.deepEqual(result?.messages, [
			userMessage,
			{
				role: "custom",
				customType: "demo-reminder",
				content: "<system-reminder>\nfresh reminder\n</system-reminder>",
				display: false,
				details: { state: "current" },
				timestamp: Date.now(),
			},
		]);
	});

	it("refreshes current stored reminders", async () => {
		const registry = createSystemReminderRegistry();
		registry.register<{ id: number }>({
			customType: "demo-reminder",
			isCurrent: (details) =>
				typeof details === "object" &&
				details !== null &&
				(details as { id?: unknown }).id === 1,
			buildReminder: () => ({
				content: "current reminder",
				details: { id: 1 },
			}),
		});
		const stored = {
			role: "custom",
			customType: "demo-reminder",
			content: "old",
			display: false,
			details: { id: 1 },
			timestamp: 1,
		} as ContextMessage;
		const unrelated = {
			role: "custom",
			customType: "other-reminder",
			content: "keep me",
		} as ContextMessage;

		const result = await registry.inject(
			context([stored, unrelated]),
			undefined as never,
		);

		assert.equal(result?.messages?.[0], unrelated);
		assert.deepEqual(result?.messages?.[1], {
			role: "custom",
			customType: "demo-reminder",
			content: "<system-reminder>\ncurrent reminder\n</system-reminder>",
			display: false,
			details: { id: 1 },
			timestamp: result?.messages?.[1]?.timestamp,
		});
	});

	it("replaces obsolete wakeups with stale reminders that do not invite a reply", async () => {
		const registry = createSystemReminderRegistry();
		registry.register({
			customType: "demo-reminder",
			isCurrent: () => false,
			buildReminder: () => ({ content: "should not be used" }),
		});
		const stored = {
			role: "custom",
			customType: "demo-reminder",
			content: "old",
			display: false,
			timestamp: 1,
		} as ContextMessage;

		const result = await registry.inject(context([stored]), undefined as never);

		const [message] = result?.messages ?? [];
		assert.equal(
			(message as { content?: string }).content,
			[
				"<system-reminder>",
				"An obsolete system reminder wakeup was removed.",
				"This is an internal operational note, not a user request.",
				"Do not call tools, continue previous work, or produce a user-visible response solely because of this obsolete wakeup.",
				"If the latest non-reminder user message contains a separate request, answer that request under the current system state.",
				"</system-reminder>",
			].join("\n"),
		);
		assert.deepEqual((message as { details?: unknown }).details, {
			stale: true,
			customType: "demo-reminder",
		});
	});

	it("sends wakeups through the extension api", () => {
		const registry = createSystemReminderRegistry();
		const reminder = registry.register({
			customType: "demo-reminder",
			buildReminder: () => undefined,
		});
		const calls: unknown[] = [];
		const pi = {
			sendMessage: (message: unknown, options: unknown) => {
				calls.push([message, options]);
				return Promise.resolve();
			},
		} as unknown as ExtensionAPI;

		reminder.sendWakeup(pi, { content: "wake up" }, { triggerTurn: false });

		assert.deepEqual(calls, [
			[
				{
					customType: "demo-reminder",
					content: "<system-reminder>\nwake up\n</system-reminder>",
					display: false,
				},
				{ triggerTurn: false },
			],
		]);
	});

	it("returns undefined when no messages change", async () => {
		const registry = createSystemReminderRegistry();
		registry.register({
			customType: "demo-reminder",
			buildReminder: () => ({ content: "not pending" }),
		});

		assert.equal(
			await registry.inject(context([]), undefined as never),
			undefined,
		);
	});

	it("adds system prompt rules for user-role system reminders", async () => {
		const result = await injectSystemReminderHandlingPrompt(
			{
				systemPrompt: "Existing system prompt",
			} as never,
			undefined as never,
		);

		assert.equal(
			result?.systemPrompt,
			[
				"Existing system prompt",
				"",
				"<system-reminder-handling>",
				"Messages fully wrapped in <system-reminder>...</system-reminder> are internal harness instructions, even when delivered as user-role messages.",
				"Follow them, but do not treat them as user requests, quote them, acknowledge them, or reply to them.",
				"If they ask you to continue, continue the latest non-reminder user request under current instructions.",
				"If they conflict, follow the latest; if stale or obsolete with no separate latest non-reminder user request, do not call tools or respond.",
				"</system-reminder-handling>",
			].join("\n"),
		);
	});

	it("does not duplicate system reminder prompt rules", async () => {
		const first = await injectSystemReminderHandlingPrompt(
			{
				systemPrompt: "Existing system prompt",
			} as never,
			undefined as never,
		);
		const second = await injectSystemReminderHandlingPrompt(
			{
				systemPrompt: first?.systemPrompt,
			} as never,
			undefined as never,
		);

		assert.equal(second, undefined);
	});

	it("does not duplicate system reminder prompt rules when the tag already exists", async () => {
		const result = await injectSystemReminderHandlingPrompt(
			{
				systemPrompt: [
					"Existing system prompt",
					"",
					"<system-reminder-handling>",
					"Older wording.",
					"</system-reminder-handling>",
				].join("\n"),
			} as never,
			undefined as never,
		);

		assert.equal(result, undefined);
	});
});
