import type {
	ExtensionContext,
	ExtensionUIContext,
	ReadonlyFooterDataProvider,
	SessionEntry,
} from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { formatPercent, formatTokens, truncateMiddle } from "./format";
import { type UsageTotals, getUsageTotals } from "./usage";
import type { ModelIdentity, SpeedMode } from "../../features/fast";

type FooterFactory = NonNullable<
	Parameters<ExtensionUIContext["setFooter"]>[0]
>;
type FooterComponent = Component & { dispose?(): void };
type RequestRender = () => void;

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
	if (totals.cost <= 0) return "";
	return totals.cost < 0.001 ? "<$0.001" : `$${totals.cost.toFixed(3)}`;
}

function renderContextUsage(ctx: ExtensionContext): string {
	const usage = ctx.getContextUsage();
	const contextWindow = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
	if (contextWindow <= 0) return "";

	const tokens =
		usage?.tokens == null ? "?" : formatTokens(Math.max(0, usage.tokens));
	const percent =
		usage?.percent == null ? "?" : formatPercent(Math.max(0, usage.percent));
	return `CTX ${tokens}/${formatTokens(contextWindow)} (${percent})`;
}

export function createStatusBarFooter(
	ctx: ExtensionContext,
	setRequestRender: (requestRender: RequestRender | undefined) => void,
	getSpeedMode: (
		model: ModelIdentity | undefined,
	) => SpeedMode | undefined = () => undefined,
): FooterFactory {
	return (
		tui: TUI,
		theme: Parameters<FooterFactory>[1],
		footerData: ReadonlyFooterDataProvider,
	): FooterComponent => {
		setRequestRender(() => tui.requestRender());

		// Walking the whole session on every render is wasteful; entries are
		// append-only, so a changed length or last entry means new usage.
		let cached:
			| {
					length: number;
					last: SessionEntry | undefined;
					totals: UsageTotals;
			  }
			| undefined;
		function usageTotals(): UsageTotals {
			const entries = ctx.sessionManager.getEntries();
			const last = entries.at(-1);
			if (!cached || cached.length !== entries.length || cached.last !== last) {
				cached = {
					length: entries.length,
					last,
					totals: getUsageTotals(entries),
				};
			}
			return cached.totals;
		}

		const unsubscribeBranchChange = footerData.onBranchChange(() =>
			tui.requestRender(),
		);

		function renderIdentity(): string {
			const model = ctx.model;
			if (!model) return "no-model";

			const thinking = model.reasoning
				? (ctx.thinkingLevel ?? "off")
				: undefined;
			const speed = getSpeedMode(model);
			const identity = joinParts(
				[`(${model.provider}) ${model.id}`, thinking, speed],
				" ",
			);
			const branch = footerData.getGitBranch();
			return joinParts([identity, branch], " · ");
		}

		return {
			dispose: () => {
				setRequestRender(undefined);
				unsubscribeBranchChange();
			},
			invalidate() {},
			render(width: number): string[] {
				const identity = renderIdentity();
				const totals = usageTotals();
				const right = theme.fg(
					"muted",
					joinParts(
						[
							renderCacheHitRate(totals),
							renderContextUsage(ctx),
							renderCost(totals),
						],
						" · ",
					),
				);

				const rightWidth = visibleWidth(right);
				const availableLeft = width - rightWidth - 2;
				if (rightWidth === 0) {
					return [
						truncateToWidth(
							theme.fg("muted", truncateMiddle(identity, Math.max(1, width))),
							width,
							"",
						),
					];
				}
				if (availableLeft <= 0) {
					return [truncateToWidth(right, width, "")];
				}

				const fittedLeft = theme.fg(
					"muted",
					truncateMiddle(identity, availableLeft),
				);
				const gap = " ".repeat(
					Math.max(1, width - visibleWidth(fittedLeft) - rightWidth),
				);
				return [truncateToWidth(fittedLeft + gap + right, width, "")];
			},
		};
	};
}
