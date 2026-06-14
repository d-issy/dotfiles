import { homedir } from "node:os";
import { basename } from "node:path";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
	ExtensionUIContext,
	ReadonlyFooterDataProvider,
	SessionEntry,
} from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { Color } from "./theme";
import { colors, fg } from "./theme";

export type RequestRender = () => void;

export const FOOTER_NOTICE_EVENT = "user:footer-notice";
export const FOOTER_NOTICE_DEFAULT_MS = 1000;

export type FooterNoticeEvent = {
	message?: string;
	durationMs?: number;
};

export type FooterNoticeState = {
	current(): string | undefined;
	show(message: string, durationMs: number): void;
	clear(): void;
	dispose(): void;
};

/**
 * Holds the footer's latest render callback so pi events can re-render it.
 * The footer registers itself via `set`; event handlers call `trigger`.
 */
export type RenderTrigger = {
	trigger(): void;
	set(next: RequestRender | undefined): void;
};

export function createRenderTrigger(): RenderTrigger {
	let request: RequestRender | undefined;
	return {
		trigger() {
			request?.();
		},
		set(next) {
			request = next;
		},
	};
}

export function createFooterNoticeState(
	render: RenderTrigger,
): FooterNoticeState {
	let message: string | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function clearTimer(): void {
		if (!timer) return;
		clearTimeout(timer);
		timer = undefined;
	}

	return {
		current() {
			return message;
		},
		show(nextMessage, durationMs) {
			clearTimer();
			message = nextMessage;
			render.trigger();
			timer = setTimeout(() => {
				message = undefined;
				timer = undefined;
				render.trigger();
			}, durationMs);
		},
		clear() {
			clearTimer();
			if (!message) return;
			message = undefined;
			render.trigger();
		},
		dispose() {
			clearTimer();
			message = undefined;
		},
	};
}
type FooterFactory = NonNullable<
	Parameters<ExtensionUIContext["setFooter"]>[0]
>;
type FooterComponent = Component & { dispose?(): void };

type Totals = {
	input: number;
	output: number;
	cost: number;
};

const HOME = homedir();

export function formatCount(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return "0";
	if (value >= 1_000_000)
		return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
	if (value >= 1_000)
		return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
	return `${Math.round(value)}`;
}

function formatPercent(value: number): string {
	return `${value.toFixed(1)}%`;
}

function formatCwd(cwd: string): string {
	if (cwd === HOME) return "~";
	const name = basename(cwd);
	return name || cwd;
}

function pickRemainingColor(remaining: number): Color {
	if (remaining >= 50) return colors.positive;
	if (remaining >= 20) return colors.caution;
	return colors.alert;
}

export function getAssistantTotals(entries: readonly SessionEntry[]): Totals {
	const totals: Totals = { input: 0, output: 0, cost: 0 };

	for (const entry of entries) {
		if (entry.type !== "message" || entry.message.role !== "assistant")
			continue;

		const usage = (entry.message as AssistantMessage).usage;
		if (!usage) continue;

		totals.input += usage.input ?? 0;
		totals.output += usage.output ?? 0;
		totals.cost += usage.cost?.total ?? 0;
	}

	return totals;
}

export function createStatusBarFooter(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	setRequestRender: (requestRender: RequestRender | undefined) => void,
	notice?: FooterNoticeState,
): FooterFactory {
	return (
		tui: TUI,
		_theme: Parameters<FooterFactory>[1],
		footerData: ReadonlyFooterDataProvider,
	): FooterComponent => {
		setRequestRender(() => tui.requestRender());

		const cwdSegment =
			ctx.cwd === HOME
				? `${fg(colors.muted, "in ")}${fg(colors.positive, "HOME")}`
				: fg(colors.positive, formatCwd(ctx.cwd));

		const unsubscribeBranchChange = footerData.onBranchChange(() =>
			tui.requestRender(),
		);

		function renderModel(): string {
			const model = ctx.model?.id ?? "no-model";
			return fg(colors.caution, `${model} ${pi.getThinkingLevel()}`);
		}

		function renderLocation(): string {
			const branch = footerData.getGitBranch();
			if (!branch) return cwdSegment;
			return `${cwdSegment}${fg(colors.muted, ":")}${fg(colors.accent, branch)}`;
		}

		function renderContextUsage(): string {
			const usage = ctx.getContextUsage();
			if (!usage?.tokens) return "";

			const remaining = Math.max(0, 100 - (usage.percent ?? 0));
			const text = `${formatCount(usage.tokens)} (${formatPercent(remaining)})`;
			return fg(pickRemainingColor(remaining), text);
		}

		function renderCost(): string {
			const totals = getAssistantTotals(ctx.sessionManager.getBranch());
			if (totals.cost <= 0) return "";
			return fg(colors.muted, `$${totals.cost.toFixed(3)}`);
		}

		function renderExtensionStatuses(): string {
			return [...footerData.getExtensionStatuses().values()]
				.filter(
					(status): status is string =>
						Boolean(status) && visibleWidth(status.trim()) > 0,
				)
				.join(" ");
		}

		function renderSessionStatus(): string {
			return [renderExtensionStatuses(), renderModel()]
				.filter(Boolean)
				.join(" ");
		}

		return {
			dispose: () => {
				setRequestRender(undefined);
				unsubscribeBranchChange();
			},
			invalidate() {},
			render(width: number): string[] {
				const noticeMessage = notice?.current();
				if (noticeMessage) {
					return [truncateToWidth(fg(colors.muted, noticeMessage), width, "")];
				}

				const separator = fg(colors.muted, "·");
				const left = [renderSessionStatus(), renderLocation()]
					.filter(Boolean)
					.join(` ${separator} `);
				const right = [renderCost(), renderContextUsage()]
					.filter(Boolean)
					.join("  ");
				const gap = " ".repeat(
					Math.max(1, width - visibleWidth(left) - visibleWidth(right)),
				);

				return [truncateToWidth(left + gap + right, width, "")];
			},
		};
	};
}
