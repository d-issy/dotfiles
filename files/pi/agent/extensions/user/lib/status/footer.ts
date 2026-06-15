import { homedir } from "node:os";
import type {
	ExtensionAPI,
	ExtensionContext,
	ExtensionUIContext,
	ReadonlyFooterDataProvider,
} from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { colors, fg } from "../theme";
import {
	formatCount,
	formatCwd,
	formatPercent,
	pickRemainingColor,
} from "./format";
import type { FooterNoticeState } from "./notice";
import type { RequestRender } from "./render-trigger";
import { getAssistantTotals } from "./usage";

type FooterFactory = NonNullable<
	Parameters<ExtensionUIContext["setFooter"]>[0]
>;
type FooterComponent = Component & { dispose?(): void };

const HOME = homedir();

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

		function hasVisibleFocusStatus(): boolean {
			const focus = footerData.getExtensionStatuses().get("focus");
			return typeof focus === "string" && visibleWidth(focus.trim()) > 0;
		}

		function renderSessionStatus(separator: string): string {
			const statusSeparator = hasVisibleFocusStatus() ? ` ${separator} ` : " ";
			return [renderExtensionStatuses(), renderModel()]
				.filter(Boolean)
				.join(statusSeparator);
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
				const left = [renderSessionStatus(separator), renderLocation()]
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
