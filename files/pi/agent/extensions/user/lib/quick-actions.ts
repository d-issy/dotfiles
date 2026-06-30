import {
	DynamicBorder,
	type ExtensionContext,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import { type TUI, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import { decodePrintableInput } from "./ui";
import {
	type KeyedPanelItem,
	describePrintableInput,
	renderKeyedPanelItem,
} from "./ui/keyed-panel";

export type QuickActionId =
	| "focus"
	| "effort"
	| "model"
	| "refinePrompt"
	| "promptStash";

type QuickAction = KeyedPanelItem & {
	id: QuickActionId;
};

type QuickActionHandler = (ctx: ExtensionContext) => Promise<void>;

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
	{
		id: "refinePrompt",
		key: "r",
		label: "Refine Prompt",
		description: "Improve the editor prompt with AI",
	},
	{
		id: "promptStash",
		key: "s",
		label: "Prompt Stash",
		description: "Save or restore editor prompts",
	},
];

const NOTICE_CLEAR_MS = 1200;
const quickActionHandlers = new Map<QuickActionId, QuickActionHandler>();

export function registerQuickActionHandler(
	id: QuickActionId,
	handler: QuickActionHandler,
): () => void {
	quickActionHandlers.set(id, handler);
	return () => {
		if (quickActionHandlers.get(id) === handler) quickActionHandlers.delete(id);
	};
}

export async function runQuickAction(
	id: QuickActionId,
	ctx: ExtensionContext,
): Promise<void> {
	const handler = quickActionHandlers.get(id);
	if (!handler) {
		ctx.ui.notify(`Quick action is unavailable: ${id}`, "error");
		return;
	}
	await handler(ctx);
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
		...QUICK_ACTIONS.map((action) =>
			renderKeyedPanelItem(theme, action, { width }),
		),
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

			setNotice(`Unknown action: ${describePrintableInput(input)}`);
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
