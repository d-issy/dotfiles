import type {
	ExtensionAPI,
	ExtensionHandler,
	ToolCallEvent,
	ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import type { ToolCatalog } from "../tool";
import type { FocusController } from "./controller";
import type { FocusRuntime } from "./runtime";

type BlockedToolCall = { block: true; reason: string };

function block(reason: string): BlockedToolCall {
	return { block: true, reason };
}

export const guardToolCall =
	(
		pi: ExtensionAPI,
		focus: FocusController,
		catalog: ToolCatalog,
		runtime?: FocusRuntime,
	): ExtensionHandler<ToolCallEvent, ToolCallEventResult> =>
	async (event) => {
		const focusName = focus.active ? focus.current : undefined;
		const notAllowed = catalog.checkToolAllowed(
			focusName,
			focus.allowedToolNames(pi, {
				includeManagementTools: runtime?.lockedFocusName === undefined,
			}),
			event,
		);
		if (notAllowed) return block(notAllowed);

		const secret = catalog.checkSecretBlock(focusName, event);
		if (secret) return block(secret);
	};
