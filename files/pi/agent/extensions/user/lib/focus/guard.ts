import type {
	ExtensionAPI,
	ExtensionHandler,
	ToolCallEvent,
	ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import type { ToolCatalog } from "../tool";
import type { FocusController } from "./controller";

type BlockedToolCall = { block: true; reason: string };

function block(reason: string): BlockedToolCall {
	return { block: true, reason };
}

export const guardToolCall =
	(
		pi: ExtensionAPI,
		focus: FocusController,
		catalog: ToolCatalog,
	): ExtensionHandler<ToolCallEvent, ToolCallEventResult> =>
	async (event) => {
		const notAllowed = catalog.checkToolAllowed(
			focus.current,
			focus.allowedToolNames(pi),
			event,
		);
		if (notAllowed) return block(notAllowed);

		const secret = catalog.checkSecretBlock(focus.current, event);
		if (secret) return block(secret);
	};
