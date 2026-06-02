import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import { formatCount, getAssistantTotals } from "../lib/status";

const execFileAsync = promisify(execFile);

const DONE_ICONS = ["π", " "] as const;
const DONE_ICON = DONE_ICONS[0];
const WINDOW_NOTICE_OPTION = "@window_notice";
const DONE_TOGGLE_INTERVAL_MS = 500;
const TOKEN_TITLE_UPDATE_INTERVAL_MS = 500;
const TITLE_METRICS_SEPARATOR = " - ";

// Capture the pane at extension load. Using the active pane at completion time
// would update whichever pane the user is looking at, not the pane running Pi.
const tmuxPane = process.env.TMUX_PANE;
const isInsideTmux = Boolean(process.env.TMUX);

let originalTitle: string | undefined;
let agentStartedAtMs: number | undefined;
// Token/cost totals only change when an assistant message completes, so cache
// the rendered string and refresh it on agent_start / message_end / agent_end
// instead of re-scanning the whole session branch on every timer tick.
let tokenTotals = "↑0 ↓0";
let doneDetails = "";
let doneTitleIndex = 0;
let cancelDoneBlink: (() => void) | undefined;
let cancelTokenTitle: (() => void) | undefined;

// Self-rescheduling async interval with a single re-entrancy guard, returning a
// canceller. Shared by the working-title and done-blink timers.
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

function stopTokenTitleUpdates(): void {
	cancelTokenTitle?.();
	cancelTokenTitle = undefined;
}

function formatDuration(ms: number): string {
	const totalSeconds = Math.max(0, Math.round(ms / 1000));
	const seconds = totalSeconds % 60;
	const totalMinutes = Math.floor(totalSeconds / 60);
	const minutes = totalMinutes % 60;
	const hours = Math.floor(totalMinutes / 60);

	if (hours > 0) return `${hours}h${minutes}m`;
	if (minutes > 0) return `${minutes}m${seconds}s`;
	return `${seconds}s`;
}

function currentElapsed(): string {
	if (agentStartedAtMs === undefined) return "0s";
	return formatDuration(Date.now() - agentStartedAtMs);
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

function computeTokenTotals(ctx: ExtensionContext): string {
	const totals = getAssistantTotals(ctx.sessionManager.getBranch());
	const parts = [
		`↑${formatCount(totals.input)}`,
		`↓${formatCount(totals.output)}`,
	];
	if (totals.cost > 0) parts.push(`$${totals.cost.toFixed(3)}`);
	return parts.join(" ");
}

function renderMetrics(): string {
	const parts = [tokenTotals];
	const elapsed = currentElapsed();
	if (elapsed !== "0s") parts.push(elapsed);
	return parts.join(TITLE_METRICS_SEPARATOR);
}

function withOriginalPrefix(suffix: string): string {
	return originalTitle
		? `${originalTitle}${TITLE_METRICS_SEPARATOR}${suffix}`
		: suffix;
}

function renderWorkingTitle(): string {
	return withOriginalPrefix(renderMetrics());
}

function renderDoneStablePaneTitle(): string {
	return withOriginalPrefix(doneDetails);
}

function renderDonePaneTitle(icon: (typeof DONE_ICONS)[number]): string {
	if (!originalTitle) return `${icon} ${doneDetails}`;

	// If the original title already starts with the Pi icon, reuse that slot so
	// the notification icon does not render as "π π ...".
	if (originalTitle.startsWith(DONE_ICON)) {
		return `${icon}${originalTitle.slice(DONE_ICON.length)}${TITLE_METRICS_SEPARATOR}${doneDetails}`;
	}

	return `${icon} ${originalTitle}${TITLE_METRICS_SEPARATOR}${doneDetails}`;
}

function startTokenTitleUpdates(ctx: ExtensionContext): void {
	stopTokenTitleUpdates();
	cancelTokenTitle = startInterval(TOKEN_TITLE_UPDATE_INTERVAL_MS, () =>
		setPaneTitle(ctx, renderWorkingTitle()),
	);
}

function startDoneBlinkUntilActive(): void {
	stopDoneBlink();

	doneTitleIndex = 0;
	cancelDoneBlink = startInterval(DONE_TOGGLE_INTERVAL_MS, async () => {
		if (await isTmuxPaneVisibleActive()) {
			await Promise.all([
				setTmuxWindowNotice(undefined),
				setTmuxPaneTitle(renderDoneStablePaneTitle()),
			]);
			stopDoneBlink();
			return;
		}

		doneTitleIndex = (doneTitleIndex + 1) % DONE_ICONS.length;
		await setTmuxPaneTitle(renderDonePaneTitle(DONE_ICONS[doneTitleIndex]));
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
	pi.on("agent_start", async (_event, ctx) => {
		agentStartedAtMs = Date.now();
		stopDoneBlink();
		tokenTotals = computeTokenTotals(ctx);
		startTokenTitleUpdates(ctx);

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

		await setPaneTitle(ctx, renderWorkingTitle());
	});

	pi.on("message_end", async (event, ctx) => {
		if (event.message.role !== "assistant") return;
		tokenTotals = computeTokenTotals(ctx);
		await setPaneTitle(ctx, renderWorkingTitle());
	});

	pi.on("agent_end", async (_event, ctx) => {
		tokenTotals = computeTokenTotals(ctx);
		doneDetails = renderMetrics();
		agentStartedAtMs = undefined;
		stopTokenTitleUpdates();
		if (await isTmuxPaneVisibleActive()) {
			await Promise.all([
				setTmuxWindowNotice(undefined),
				setPaneTitle(ctx, renderDoneStablePaneTitle()),
			]);
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
		stopTokenTitleUpdates();
		await restoreOriginalTmuxPaneTitle();
	});
}

export default { name: "tmux-pane-title", register } satisfies Feature;
