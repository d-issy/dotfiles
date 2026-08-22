import type {
	ExtensionContext,
	ExtensionUIContext,
	ReadonlyFooterDataProvider,
} from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { formatPercent, formatTokens, truncateMiddle } from "./format";
import { getUsageTotals } from "./usage";

type FooterFactory = NonNullable<
	Parameters<ExtensionUIContext["setFooter"]>[0]
>;
type FooterComponent = Component & { dispose?(): void };
type RequestRender = () => void;
type ModelIdentity = Pick<
	NonNullable<ExtensionContext["model"]>,
	"provider" | "id"
>;

type UsageTotals = ReturnType<typeof getUsageTotals>;

function joinParts(
	parts: readonly (string | null | undefined)[],
	separator: string,
): string {
	return parts.filter((part): part is string => Boolean(part)).join(separator);
}

function renderCacheHitRate(totals: UsageTotals): string {
	if (
		totals.latestCacheHitRate === undefined ||
		(totals.cacheRead <= 0 && totals.cacheWrite <= 0)
	) {
		return "";
	}
	return `CH${formatPercent(totals.latestCacheHitRate)}`;
}

function renderCost(totals: UsageTotals): string {
	return totals.cost > 0 ? `$${totals.cost.toFixed(3)}` : "";
}

export function createStatusBarFooter(
	ctx: ExtensionContext,
	setRequestRender: (requestRender: RequestRender | undefined) => void,
	isFastEnabled: (model: ModelIdentity | undefined) => boolean = () => false,
): FooterFactory {
	return (
		tui: TUI,
		theme: Parameters<FooterFactory>[1],
		footerData: ReadonlyFooterDataProvider,
	): FooterComponent => {
		setRequestRender(() => tui.requestRender());

		const unsubscribeBranchChange = footerData.onBranchChange(() =>
			tui.requestRender(),
		);

		function renderIdentity(): string {
			const model = ctx.model;
			if (!model) return "no-model";

			const thinking = model.reasoning
				? (ctx.thinkingLevel ?? "off")
				: undefined;
			const fast = isFastEnabled(model) ? "fast" : undefined;
			const identity = joinParts(
				[`(${model.provider}) ${model.id}`, thinking, fast],
				" ",
			);
			const branch = footerData.getGitBranch();
			return joinParts([identity, branch], " · ");
		}

		function renderContextUsage(): string {
			const usage = ctx.getContextUsage();
			const contextWindow =
				usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
			if (contextWindow <= 0) return "";

			const tokens =
				usage?.tokens == null ? "?" : formatTokens(Math.max(0, usage.tokens));
			const percent =
				usage?.percent == null
					? "?"
					: formatPercent(Math.max(0, usage.percent));
			return `CTX ${tokens}/${formatTokens(contextWindow)} (${percent})`;
		}

		return {
			dispose: () => {
				setRequestRender(undefined);
				unsubscribeBranchChange();
			},
			invalidate() {},
			render(width: number): string[] {
				const identity = renderIdentity();
				const left = theme.fg(
					"muted",
					truncateMiddle(identity, Math.max(1, width)),
				);
				const totals = getUsageTotals(ctx.sessionManager.getEntries());
				const right = theme.fg(
					"muted",
					joinParts(
						[
							renderCacheHitRate(totals),
							renderContextUsage(),
							renderCost(totals),
						],
						" · ",
					),
				);

				const rightWidth = visibleWidth(right);
				const availableLeft = width - rightWidth - 2;
				if (rightWidth === 0) {
					return [truncateToWidth(left, width, "")];
				}
				if (availableLeft <= 0) {
					return [truncateToWidth(right, width, "")];
				}

				const fittedLeft = truncateToWidth(left, availableLeft, "");
				const gap = " ".repeat(
					Math.max(1, width - visibleWidth(fittedLeft) - rightWidth),
				);
				return [truncateToWidth(fittedLeft + gap + right, width, "")];
			},
		};
	};
}
