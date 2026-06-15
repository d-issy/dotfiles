import type {
	ExtensionAPI,
	ExtensionHandler,
	ToolCallEvent,
	ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import { policyRegistry } from "../policy";
import type { FocusController } from "./controller";

type BlockedToolCall = { block: true; reason: string };

function block(reason: string): BlockedToolCall {
	return { block: true, reason };
}

export const guardToolCall =
	(
		pi: ExtensionAPI,
		focus: FocusController,
	): ExtensionHandler<ToolCallEvent, ToolCallEventResult> =>
	async (event) => {
		const notAllowed = policyRegistry.checkToolAllowed(
			focus.current,
			focus.allowedToolNames(pi),
			event,
		);
		if (notAllowed) return block(notAllowed);

		const secret = policyRegistry.checkSecretBlock(focus.current, event);
		if (secret) return block(secret);
	};
