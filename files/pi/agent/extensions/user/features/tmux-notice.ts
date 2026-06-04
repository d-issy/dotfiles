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
const STATUS_NOTICE_ICON_OPTION = "@status_notice_icon";
const PANE_NOTICE_ICON_OPTION = "@pane_notice_icon";
const PANE_NOTICE_TITLE_OPTION = "@pane_notice_title";
const LEGACY_WINDOW_NOTICE_OPTION = "@window_notice";
const LEGACY_PI_WAITING_OPTION = "@pi_waiting";
const DONE_TOGGLE_INTERVAL_MS = 500;
const STATUS_NOTICE_PULSE_INTERVAL_MS = 900;

// Capture the pane at extension load. Using the active pane at completion time
// would update whichever pane the user is looking at, not the pane running Pi.
const tmuxPane = process.env.TMUX_PANE;
const isInsideTmux = Boolean(process.env.TMUX);

let originalTitle: string | undefined;
let doneTitleIndex = 0;
let cancelDoneBlink: (() => void) | undefined;
let cancelStatusNoticePulse: (() => void) | undefined;

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

function stopStatusNoticePulse(): void {
	cancelStatusNoticePulse?.();
	cancelStatusNoticePulse = undefined;
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

async function setTmuxOption(
	scope: "-w" | "-p",
	option: string,
	value: string | undefined,
): Promise<void> {
	if (!tmuxPane) return;

	try {
		await execFileAsync("tmux", [
			"set-option",
			scope,
			"-t",
			tmuxPane,
			option,
			value ?? "",
		]);
	} catch {
		// Ignore: pane title updates are the primary signal.
	}
}

function setTmuxWindowOption(
	option: string,
	value: string | undefined,
): Promise<void> {
	return setTmuxOption("-w", option, value);
}

function setTmuxPaneOption(
	option: string,
	value: string | undefined,
): Promise<void> {
	return setTmuxOption("-p", option, value);
}

function setTmuxPaneNoticeIcon(icon: string | undefined): Promise<void> {
	return setTmuxPaneOption(PANE_NOTICE_ICON_OPTION, icon);
}

function setTmuxPaneNoticeTitle(title: string | undefined): Promise<void> {
	return setTmuxPaneOption(PANE_NOTICE_TITLE_OPTION, title);
}

async function setTmuxStatusNoticeIcon(
	icon: string | undefined,
): Promise<void> {
	await Promise.all([
		setTmuxPaneOption(STATUS_NOTICE_ICON_OPTION, icon),
		// Clear the legacy Pi-specific markers so generic status aggregation
		// cannot be polluted by an older Pi process/config.
		setTmuxPaneOption(LEGACY_PI_WAITING_OPTION, undefined),
		setTmuxWindowOption(LEGACY_WINDOW_NOTICE_OPTION, undefined),
		setTmuxWindowOption(LEGACY_PI_WAITING_OPTION, undefined),
	]);
}

async function refreshTmuxStatus(): Promise<void> {
	try {
		await execFileAsync("tmux", ["refresh-client", "-S"]);
	} catch {
		// Ignore: tmux will refresh on its regular status interval.
	}
}

function startStatusNoticePulse(): void {
	stopStatusNoticePulse();

	void refreshTmuxStatus();
	cancelStatusNoticePulse = startInterval(
		STATUS_NOTICE_PULSE_INTERVAL_MS,
		refreshTmuxStatus,
	);
}

function clearAllTmuxNotices(): Promise<unknown> {
	return Promise.all([
		setTmuxStatusNoticeIcon(undefined),
		setTmuxPaneNoticeIcon(undefined),
		setTmuxPaneNoticeTitle(undefined),
	]);
}

async function restoreOriginalTmuxPaneTitle(): Promise<boolean> {
	stopStatusNoticePulse();
	await clearAllTmuxNotices();
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

function renderPaneNoticeTitle(): string | undefined {
	return originalTitle?.replace(/^π\s*/u, "");
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
		await setTmuxPaneNoticeIcon(icon);
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
		stopStatusNoticePulse();

		await clearAllTmuxNotices();

		const currentTitle = await getTmuxPaneTitle();
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
			tmuxPane
				? Promise.resolve()
				: setPaneTitle(ctx, renderDonePaneTitle(DONE_ICON)),
			setTmuxStatusNoticeIcon(DONE_ICON),
			setTmuxPaneNoticeIcon(DONE_ICON),
			setTmuxPaneNoticeTitle(renderPaneNoticeTitle()),
		]);
		if (tmuxPane) {
			startDoneBlinkUntilActive();
			startStatusNoticePulse();
		}
	});

	pi.on("session_shutdown", async () => {
		stopDoneBlink();
		stopStatusNoticePulse();
		await restoreOriginalTmuxPaneTitle();
	});
}

export default { name: "tmux-notice", register } satisfies Feature;
