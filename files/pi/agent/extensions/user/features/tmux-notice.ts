import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import { ENTER_FOCUS_TOOL, isTerminatingFocusResult } from "../lib/focus";
import { notifyUserInputNeeded } from "../lib/tmux-notice";

function register(pi: ExtensionAPI): void {
	let suppressNextAgentEndNotice = false;

	pi.on("tool_execution_end", async (event) => {
		if (event.toolName !== ENTER_FOCUS_TOOL) return;
		suppressNextAgentEndNotice = isTerminatingFocusResult(event.result);
	});

	pi.on("agent_end", async () => {
		if (suppressNextAgentEndNotice) {
			suppressNextAgentEndNotice = false;
			return;
		}

		await notifyUserInputNeeded();
	});
}

export function createTmuxNoticeFeature(): Feature {
	return { name: "tmux-notice", register };
}

export default createTmuxNoticeFeature();
