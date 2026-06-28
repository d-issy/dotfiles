import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import { notifyUserInputNeeded } from "../lib/tmux-notice";

function register(pi: ExtensionAPI): void {
	pi.on("agent_end", async () => {
		await notifyUserInputNeeded();
	});
}

export function createTmuxNoticeFeature(): Feature {
	return { name: "tmux-notice", register };
}

export default createTmuxNoticeFeature();
