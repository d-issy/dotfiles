import { homedir } from "node:os";
import { sep } from "node:path";
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
import type { Color } from "./lib/theme.js";
import { catppuccin, fg } from "./lib/theme.js";

type RequestRender = () => void;
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

function formatCount(value: number): string {
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
	if (cwd.startsWith(HOME + sep)) return `~${cwd.slice(HOME.length)}`;
	return cwd;
}

function pickRemainingColor(remaining: number): Color {
	if (remaining >= 50) return catppuccin.green;
	if (remaining >= 20) return catppuccin.yellow;
	return catppuccin.red;
}

function getAssistantTotals(entries: readonly SessionEntry[]): Totals {
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

function createStatusBarFooter(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	setRequestRender: (requestRender: RequestRender | undefined) => void,
): FooterFactory {
	return (
		tui: TUI,
		_theme: Parameters<FooterFactory>[1],
		footerData: ReadonlyFooterDataProvider,
	): FooterComponent => {
		setRequestRender(() => tui.requestRender());

		const cwdSegment = fg(catppuccin.green, formatCwd(ctx.cwd));

		const unsubscribeBranchChange = footerData.onBranchChange(() =>
			tui.requestRender(),
		);

		function renderModel(): string {
			const model = ctx.model?.id ?? "no-model";
			return fg(catppuccin.yellow, `${model} ${pi.getThinkingLevel()}`);
		}

		function renderLocation(): string {
			const branch = footerData.getGitBranch();
			if (!branch) return cwdSegment;
			return `${cwdSegment}${fg(catppuccin.overlay0, ":")}${fg(catppuccin.blue, branch)}`;
		}

		function renderContextUsage(): string {
			const usage = ctx.getContextUsage();
			const contextWindow = ctx.model?.contextWindow;
			if (!usage?.tokens || !contextWindow) return "";

			const remaining = Math.max(0, 100 - (usage.percent ?? 0));
			const text = `${formatCount(usage.tokens)}/${formatCount(contextWindow)} (${formatPercent(remaining)})`;
			return fg(pickRemainingColor(remaining), text);
		}

		function renderTokenTotals(): string {
			const totals = getAssistantTotals(ctx.sessionManager.getBranch());
			const input = fg(catppuccin.green, `↑${formatCount(totals.input)}`);
			const output = fg(catppuccin.yellow, `↓${formatCount(totals.output)}`);
			const cost = fg(catppuccin.overlay0, `$${totals.cost.toFixed(3)}`);
			return `${input} ${output} ${cost}`;
		}

		function renderExtensionStatuses(): string {
			return [...footerData.getExtensionStatuses().values()]
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
				const separator = fg(catppuccin.overlay0, "·");
				const left = [
					renderExtensionStatuses(),
					renderModel(),
					renderLocation(),
				]
					.filter(Boolean)
					.join(` ${separator} `);
				const right = [renderContextUsage(), renderTokenTotals()]
					.filter(Boolean)
					.join(" ");
				const gap = " ".repeat(
					Math.max(1, width - visibleWidth(left) - visibleWidth(right)),
				);

				return [truncateToWidth(left + gap + right, width, "")];
			},
		};
	};
}

export default function statusBar(pi: ExtensionAPI): void {
	let requestRender: RequestRender | undefined;
	const setRequestRender = (next: RequestRender | undefined) => {
		requestRender = next;
	};
	const triggerRender = () => requestRender?.();

	pi.on("thinking_level_select", triggerRender);
	pi.on("model_select", triggerRender);

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setFooter(createStatusBarFooter(pi, ctx, setRequestRender));
	});
}
