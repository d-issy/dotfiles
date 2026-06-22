import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const TMUX_NOTICE = process.env.TMUX_NOTICE ?? "tmux-notice";

export async function tmuxNotice(args: readonly string[]): Promise<void> {
	try {
		await execFileAsync(TMUX_NOTICE, [...args]);
	} catch {
		// Ignore: tmux-notice is best-effort and may be unavailable outside tmux.
	}
}

export async function notifyUserInputNeeded(): Promise<void> {
	await tmuxNotice(["on", "pi-wait"]);
}
