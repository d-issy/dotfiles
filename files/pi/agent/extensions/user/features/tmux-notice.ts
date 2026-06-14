import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";

const execFileAsync = promisify(execFile);
const TMUX_NOTICE = process.env.TMUX_NOTICE ?? "tmux-notice";

async function tmuxNotice(args: readonly string[]): Promise<void> {
	try {
		await execFileAsync(TMUX_NOTICE, [...args]);
	} catch {
		// Ignore: tmux-notice is best-effort and may be unavailable outside tmux.
	}
}

function register(pi: ExtensionAPI): void {
	pi.on("agent_end", async () => {
		await tmuxNotice(["on", "pi-wait"]);
	});
}

export function createTmuxNoticeFeature(): Feature {
	return { name: "tmux-notice", register };
}

export default createTmuxNoticeFeature();
