import {
	DynamicBorder,
	type ExtensionContext,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import {
	type TUI,
	matchesKey,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import { decodePrintableInput } from "./ui";

export type QuickActionId = "focus" | "effort" | "model";

type QuickAction = {
	id: QuickActionId;
	key: string;
	label: string;
	description: string;
};

const QUICK_ACTIONS: readonly QuickAction[] = [
	{
		id: "focus",
		key: "f",
		label: "Focus",
		description: "Enter or leave focus",
	},
	{
		id: "effort",
		key: "e",
		label: "Effort",
		description: "Select thinking effort",
	},
	{
		id: "model",
		key: "l",
		label: "Model",
		description: "Select model",
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
			notice ? theme.fg("warning", notice) : theme.fg("dim", "q/esc close"),
			width,
			"",
		),
		...border.render(width),
	];
}

function createQuickActionsComponent(
	tui: TUI,
	theme: Theme,
	done: (result: QuickActionId | undefined) => void,
): QuickActionsComponent {
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
			tui.requestRender();
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
			tui.requestRender();
		},
	};
}

export async function showQuickActions(
	ctx: ExtensionContext,
): Promise<QuickActionId | undefined> {
	return ctx.ui.custom<QuickActionId | undefined>(
		(tui, theme, _keybindings, done) =>
			createQuickActionsComponent(tui, theme, done),
	);
}
