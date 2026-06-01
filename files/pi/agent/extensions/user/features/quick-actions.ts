import {
	DynamicBorder,
	type ExtensionAPI,
	type ExtensionContext,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import {
	matchesKey,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import type { Feature } from "../feature";
import { showEffortSelector } from "../lib/thinking";
import { decodePrintableInput } from "../lib/ui";
import { showModeQuickAction } from "./mode";

type QuickActionId = "mode" | "effort";

type QuickAction = {
	id: QuickActionId;
	key: string;
	label: string;
	description: string;
};

const QUICK_ACTIONS: readonly QuickAction[] = [
	{
		id: "mode",
		key: "m",
		label: "Mode",
		description: "Select permission mode",
	},
	{
		id: "effort",
		key: "e",
		label: "Effort",
		description: "Select thinking effort",
	},
];

const NOTICE_CLEAR_MS = 1200;

function renderAction(
	theme: Theme,
	action: QuickAction,
	width: number,
): string {
	const key = theme.fg("accent", action.key);
	const label = theme.bold(action.label);
	const left = `  ${key}  ${label}`;
	const gap = " ".repeat(Math.max(1, 18 - visibleWidth(left)));
	const line = `${left}${theme.fg("muted", gap + action.description)}`;
	return truncateToWidth(line, width, "");
}

function describeInput(input: string): string {
	return input === " " ? "space" : input;
}

type QuickActionsComponent = {
	render(width: number): string[];
	invalidate(): void;
	handleInput(data: string): void;
};

type QuickActionsComponentOptions = {
	theme: Theme;
	requestRender(): void;
	done(result: QuickActionId | undefined): void;
};

function renderQuickActions(
	theme: Theme,
	border: DynamicBorder,
	notice: string | undefined,
	width: number,
): string[] {
	return [
		...border.render(width),
		truncateToWidth(theme.fg("accent", theme.bold("Quick Actions")), width, ""),
		...QUICK_ACTIONS.map((action) => renderAction(theme, action, width)),
		truncateToWidth(
			notice
				? theme.fg("warning", notice)
				: theme.fg("dim", "m mode • e effort • q/esc close"),
			width,
			"",
		),
		...border.render(width),
	];
}

function createQuickActionsComponent({
	theme,
	requestRender,
	done,
}: QuickActionsComponentOptions): QuickActionsComponent {
	const border = new DynamicBorder((text: string) => theme.fg("accent", text));
	let notice: string | undefined;
	let clearNoticeTimer: ReturnType<typeof setTimeout> | undefined;

	const close = (result: QuickActionId | undefined): void => {
		if (clearNoticeTimer) clearTimeout(clearNoticeTimer);
		done(result);
	};

	const setNotice = (message: string): void => {
		if (clearNoticeTimer) clearTimeout(clearNoticeTimer);
		notice = message;
		clearNoticeTimer = setTimeout(() => {
			notice = undefined;
			requestRender();
		}, NOTICE_CLEAR_MS);
	};

	return {
		render: (width) => renderQuickActions(theme, border, notice, width),
		invalidate: () => border.invalidate(),
		handleInput(data) {
			if (matchesKey(data, "escape")) {
				close(undefined);
				return;
			}

			const input = decodePrintableInput(data);
			if (!input) return;

			const key = input.toLowerCase();
			if (key === "q") {
				close(undefined);
				return;
			}

			const action = QUICK_ACTIONS.find((item) => item.key === key);
			if (action) {
				close(action.id);
				return;
			}

			setNotice(`Unknown action: ${describeInput(input)}`);
			requestRender();
		},
	};
}

async function showQuickActions(
	ctx: ExtensionContext,
): Promise<QuickActionId | undefined> {
	return ctx.ui.custom<QuickActionId | undefined>(
		(tui, theme, _keybindings, done) =>
			createQuickActionsComponent({
				theme,
				requestRender: () => tui.requestRender(),
				done,
			}),
	);
}

const openQuickActions =
	(pi: ExtensionAPI) =>
	async (ctx: ExtensionContext): Promise<void> => {
		const action = await showQuickActions(ctx);
		switch (action) {
			case "mode":
				await showModeQuickAction(ctx);
				break;
			case "effort":
				await showEffortSelector(pi, ctx);
				break;
		}
	};

function register(pi: ExtensionAPI): void {
	pi.registerShortcut("ctrl+f", {
		description: "Open quick actions",
		handler: openQuickActions(pi),
	});
}

export default { name: "quick-actions", register } satisfies Feature;
