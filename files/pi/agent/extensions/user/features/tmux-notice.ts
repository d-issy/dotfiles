import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";

const execFileAsync = promisify(execFile);

const DONE_ICONS = ["π", " "] as const;
const DONE_ICON = DONE_ICONS[0];
const WINDOW_NOTICE_OPTION = "@window_notice";
const DONE_TOGGLE_INTERVAL_MS = 500;

// Capture the pane at extension load. Using the active pane at completion time
// would update whichever pane the user is looking at, not the pane running Pi.
const tmuxPane = process.env.TMUX_PANE;
const isInsideTmux = Boolean(process.env.TMUX);

let originalTitle: string | undefined;
let doneTitleIndex = 0;
let cancelDoneBlink: (() => void) | undefined;

// Self-rescheduling async interval with a single re-entrancy guard, returning a
// canceller for the done-blink timer.
function startInterval(ms: number, tick: () => Promise<void>): () => void {
	let running = false;
	const timer = setInterval(() => {
		if (running) return;
		running = true;
		void tick().finally(() => {
			running = false;
		});
	}, ms);
	timer.unref?.();
	return () => clearInterval(timer);
}

function stopDoneBlink(): void {
	cancelDoneBlink?.();
	cancelDoneBlink = undefined;
}

async function getTmuxPaneFormat(format: string): Promise<string | undefined> {
	if (!tmuxPane) return undefined;

	try {
		const { stdout } = await execFileAsync("tmux", [
			"display-message",
			"-p",
			"-t",
			tmuxPane,
			format,
		]);
		return String(stdout).trimEnd();
	} catch {
		return undefined;
	}
}

async function getTmuxPaneTitle(): Promise<string | undefined> {
	return getTmuxPaneFormat("#{pane_title}");
}

async function isTmuxPaneVisibleActive(): Promise<boolean> {
	return (await getTmuxPaneFormat("#{pane_active}:#{window_active}")) === "1:1";
}

async function setTmuxPaneTitle(title: string): Promise<boolean> {
	if (!tmuxPane) return false;

	try {
		await execFileAsync("tmux", ["select-pane", "-t", tmuxPane, "-T", title]);
		return true;
	} catch {
		return false;
	}
}

async function setTmuxWindowNotice(notice: string | undefined): Promise<void> {
	if (!tmuxPane) return;

	try {
		await execFileAsync("tmux", [
			"set-option",
			"-w",
			"-t",
			tmuxPane,
			WINDOW_NOTICE_OPTION,
			notice ?? "",
		]);
	} catch {
		// Ignore: pane title updates are the primary signal.
	}
}

async function restoreOriginalTmuxPaneTitle(): Promise<boolean> {
	await setTmuxWindowNotice(undefined);
	if (originalTitle === undefined) return false;
	return setTmuxPaneTitle(originalTitle);
}

async function setPaneTitle(
	ctx: ExtensionContext,
	title: string,
): Promise<void> {
	const updatedTmux = await setTmuxPaneTitle(title);
	if (updatedTmux) return;

	// Do not fall back to terminal-title escapes inside tmux: depending on the
	// terminal/tmux path they can appear to affect the active pane/window.
	if (!isInsideTmux && ctx.hasUI) ctx.ui.setTitle(title);
}

function renderDonePaneTitle(icon: (typeof DONE_ICONS)[number]): string {
	if (!originalTitle) return icon;

	// If the original title already starts with the Pi icon, reuse that slot so
	// only the notification icon blinks and the rest of the title stays stable.
	if (originalTitle.startsWith(DONE_ICON)) {
		return `${icon}${originalTitle.slice(DONE_ICON.length)}`;
	}

	return `${icon} ${originalTitle}`;
}

function startDoneBlinkUntilActive(): void {
	stopDoneBlink();

	doneTitleIndex = 0;
	cancelDoneBlink = startInterval(DONE_TOGGLE_INTERVAL_MS, async () => {
		if (await isTmuxPaneVisibleActive()) {
			await restoreOriginalTmuxPaneTitle();
			stopDoneBlink();
			return;
		}

		doneTitleIndex = (doneTitleIndex + 1) % DONE_ICONS.length;
		const icon = DONE_ICONS[doneTitleIndex];
		await Promise.all([
			setTmuxPaneTitle(renderDonePaneTitle(icon)),
			setTmuxWindowNotice(icon),
		]);
	});
}

function isPiStatusTitle(title: string): boolean {
	return (
		title === DONE_ICON ||
		title === DONE_ICONS[1] ||
		/^(?:π| ).*↑.*↓/u.test(title)
	);
}

function register(pi: ExtensionAPI): void {
	pi.on("agent_start", async () => {
		stopDoneBlink();

		// Clearing the stale notice is independent of reading the current title.
		const [, currentTitle] = await Promise.all([
			setTmuxWindowNotice(undefined),
			getTmuxPaneTitle(),
		]);
		if (currentTitle === undefined) return;

		if (isPiStatusTitle(currentTitle)) {
			await restoreOriginalTmuxPaneTitle();
		} else {
			originalTitle = currentTitle;
		}
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (await isTmuxPaneVisibleActive()) {
			await restoreOriginalTmuxPaneTitle();
			return;
		}

		await Promise.all([
			setPaneTitle(ctx, renderDonePaneTitle(DONE_ICON)),
			setTmuxWindowNotice(DONE_ICON),
		]);
		if (tmuxPane) startDoneBlinkUntilActive();
	});

	pi.on("session_shutdown", async () => {
		stopDoneBlink();
		await restoreOriginalTmuxPaneTitle();
	});
}

export default { name: "tmux-notice", register } satisfies Feature;
