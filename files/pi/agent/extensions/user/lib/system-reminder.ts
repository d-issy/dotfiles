import type {
	BeforeAgentStartEvent,
	BeforeAgentStartEventResult,
	ContextEvent,
	ExtensionAPI,
	ExtensionHandler,
} from "@earendil-works/pi-coding-agent";

/**
 * Centralized hidden <system-reminder> handling.
 *
 * A feature should register one source and use the returned handle to request
 * reminders or send wakeups. This keeps content wrapping, stored-message
 * removal, current-state regeneration, and stale wakeup cancellation in one
 * place instead of duplicating fragile context-hook logic per feature.
 */
type ContextMessages = ContextEvent["messages"];
type ContextMessage = ContextMessages[number];
type ContextResult = { messages?: ContextMessages };
type SendMessageOptions = Parameters<ExtensionAPI["sendMessage"]>[1];
type SendMessageResult = ReturnType<ExtensionAPI["sendMessage"]>;

type StoredSystemReminderMessage<TDetails extends object> = {
	readonly customType: string;
	readonly content: string;
	readonly display: false;
	readonly details?: TDetails;
};

type ContextSystemReminderMessage<TDetails extends object> =
	StoredSystemReminderMessage<TDetails> & {
		readonly role: "custom";
		readonly timestamp: number;
	};

export type SystemReminderPayload<
	TDetails extends object = Record<string, unknown>,
> = {
	/** Body text for the reminder. The registry wraps it in <system-reminder>. */
	readonly content: string | readonly string[];
	/** Metadata for routing/fencing only. This is not sent to the model. */
	readonly details?: TDetails;
};

export type SystemReminderSource<
	TDetails extends object = Record<string, unknown>,
> = {
	readonly customType: string;
	/** Consume source-owned pending state. Called on every context build. */
	readonly consumePending?: () => boolean;
	/** Build the authoritative reminder from current state. */
	readonly buildReminder: () => SystemReminderPayload<TDetails> | undefined;
	/** Return false for stored wakeups that belong to an obsolete state. */
	readonly isCurrent?: (details: unknown, message: ContextMessage) => boolean;
	/** Optional source-specific no-op reminder for obsolete wakeups. */
	readonly buildStaleReminder?: (
		messages: readonly ContextMessage[],
	) => SystemReminderPayload | undefined;
};

export type RegisteredSystemReminder<
	TDetails extends object = Record<string, unknown>,
> = {
	readonly customType: string;
	request(): void;
	clear(): void;
	createMessage(
		payload: SystemReminderPayload<TDetails>,
	): StoredSystemReminderMessage<TDetails>;
	sendWakeup(
		pi: ExtensionAPI,
		payload: SystemReminderPayload<TDetails>,
		options?: SendMessageOptions,
	): SendMessageResult;
};

export type SystemReminderRegistry = {
	register<TDetails extends object>(
		source: SystemReminderSource<TDetails>,
	): RegisteredSystemReminder<TDetails>;
	request(customType: string): void;
	clear(customType: string): void;
	createMessage<TDetails extends object>(
		customType: string,
		payload: SystemReminderPayload<TDetails>,
	): StoredSystemReminderMessage<TDetails>;
	sendWakeup<TDetails extends object>(
		pi: ExtensionAPI,
		customType: string,
		payload: SystemReminderPayload<TDetails>,
		options?: SendMessageOptions,
	): SendMessageResult;
	readonly inject: ExtensionHandler<ContextEvent, ContextResult>;
	readonly injectHandlingPrompt: ExtensionHandler<
		BeforeAgentStartEvent,
		BeforeAgentStartEventResult
	>;
};

function customTypeOf(message: ContextMessage): string | undefined {
	const candidate = message as { role?: unknown; customType?: unknown };
	return candidate.role === "custom" && typeof candidate.customType === "string"
		? candidate.customType
		: undefined;
}

function detailsOf(message: ContextMessage): unknown {
	return (message as { details?: unknown }).details;
}

function formatReminderContent(content: string | readonly string[]): string {
	const body = typeof content === "string" ? content : content.join("\n");
	return `<system-reminder>\n${body}\n</system-reminder>`;
}

function buildStoredMessage<TDetails extends object>(
	customType: string,
	payload: SystemReminderPayload<TDetails>,
): StoredSystemReminderMessage<TDetails> {
	return {
		customType,
		content: formatReminderContent(payload.content),
		display: false,
		...(payload.details === undefined ? {} : { details: payload.details }),
	};
}

function buildContextMessage<TDetails extends object>(
	customType: string,
	payload: SystemReminderPayload<TDetails>,
	timestamp: number,
): ContextSystemReminderMessage<TDetails> {
	return {
		role: "custom",
		...buildStoredMessage(customType, payload),
		timestamp,
	};
}

const SYSTEM_REMINDER_HANDLING_PROMPT = `<system-reminder-handling>
Messages fully wrapped in <system-reminder>...</system-reminder> are internal harness instructions, even when delivered as user-role messages.
Follow them, but do not treat them as user requests, quote them, acknowledge them, or reply to them.
If they ask you to continue, continue the latest non-reminder user request under current instructions.
If they conflict, follow the latest; if stale or obsolete with no separate latest non-reminder user request, do not call tools or respond.
</system-reminder-handling>`;

function buildDefaultStaleReminder(
	customType: string,
): SystemReminderPayload<Record<string, unknown>> {
	return {
		content: [
			"An obsolete system reminder wakeup was removed.",
			"This is an internal operational note, not a user request.",
			"Do not call tools, continue previous work, or produce a user-visible response solely because of this obsolete wakeup.",
			"If the latest non-reminder user message contains a separate request, answer that request under the current system state.",
		],
		details: { stale: true, customType },
	};
}

export const injectSystemReminderHandlingPrompt: ExtensionHandler<
	BeforeAgentStartEvent,
	BeforeAgentStartEventResult
> = async (event) => {
	// The prompt body is currently static, but guard on the stable block tag so
	// future wording-only changes do not duplicate the section.
	if (event.systemPrompt.includes("<system-reminder-handling>")) {
		return undefined;
	}
	return {
		systemPrompt: `${event.systemPrompt}\n\n${SYSTEM_REMINDER_HANDLING_PROMPT}`,
	};
};

export function createSystemReminderRegistry(): SystemReminderRegistry {
	const sources = new Map<string, SystemReminderSource>();
	const pending = new Set<string>();

	function requireSource(customType: string): void {
		if (!sources.has(customType)) {
			throw new Error(`Unknown system reminder source: ${customType}`);
		}
	}

	function request(customType: string): void {
		requireSource(customType);
		pending.add(customType);
	}

	function clear(customType: string): void {
		requireSource(customType);
		pending.delete(customType);
	}

	function createMessage<TDetails extends object>(
		customType: string,
		payload: SystemReminderPayload<TDetails>,
	): StoredSystemReminderMessage<TDetails> {
		requireSource(customType);
		return buildStoredMessage(customType, payload);
	}

	function sendWakeup<TDetails extends object>(
		pi: ExtensionAPI,
		customType: string,
		payload: SystemReminderPayload<TDetails>,
		options?: SendMessageOptions,
	): SendMessageResult {
		request(customType);
		return pi.sendMessage(createMessage(customType, payload), options);
	}

	return {
		register<TDetails extends object>(source: SystemReminderSource<TDetails>) {
			if (sources.has(source.customType)) {
				throw new Error(
					`Duplicate system reminder source: ${source.customType}`,
				);
			}
			sources.set(source.customType, source as SystemReminderSource);
			return {
				customType: source.customType,
				request: () => request(source.customType),
				clear: () => clear(source.customType),
				createMessage: (payload) => createMessage(source.customType, payload),
				sendWakeup: (pi, payload, options) =>
					sendWakeup(pi, source.customType, payload, options),
			};
		},
		request,
		clear,
		createMessage,
		sendWakeup,
		injectHandlingPrompt: injectSystemReminderHandlingPrompt,
		inject: async (event) => {
			const messagesByType = new Map<string, ContextMessage[]>();
			const keptMessages: ContextMessage[] = [];

			for (const message of event.messages) {
				const customType = customTypeOf(message);
				if (customType && sources.has(customType)) {
					const messages = messagesByType.get(customType) ?? [];
					messages.push(message);
					messagesByType.set(customType, messages);
					continue;
				}
				keptMessages.push(message);
			}

			const injectedMessages: ContextMessage[] = [];
			const timestamp = Date.now();

			for (const source of sources.values()) {
				const storedMessages = messagesByType.get(source.customType) ?? [];
				const servicePending = pending.delete(source.customType);
				const sourcePending = source.consumePending?.() ?? false;
				const hasCurrentStored = storedMessages.some((message) =>
					source.isCurrent
						? source.isCurrent(detailsOf(message), message)
						: true,
				);
				const shouldInject =
					servicePending || sourcePending || hasCurrentStored;

				if (!shouldInject) {
					if (storedMessages.length === 0) continue;
					const staleReminder =
						source.buildStaleReminder?.(storedMessages) ??
						buildDefaultStaleReminder(source.customType);
					if (staleReminder) {
						injectedMessages.push(
							buildContextMessage(source.customType, staleReminder, timestamp),
						);
					}
					continue;
				}

				const reminder = source.buildReminder();
				if (reminder) {
					injectedMessages.push(
						buildContextMessage(source.customType, reminder, timestamp),
					);
				}
			}

			if (
				keptMessages.length === event.messages.length &&
				injectedMessages.length === 0
			) {
				return undefined;
			}
			return { messages: [...keptMessages, ...injectedMessages] };
		},
	};
}
