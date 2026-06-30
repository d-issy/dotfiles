import {
	DynamicBorder,
	type ExtensionContext,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import { type TUI, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import type { Feature } from "../feature";
import {
	type PromptStashEntry,
	type PromptStashStore,
	createPromptStashStore,
	formatPromptStashLabel,
	getOnlyPromptStashId,
} from "../lib/prompt-stash";
import { registerQuickActionHandler } from "../lib/quick-actions";
import { decodePrintableInput, showFilterSelect } from "../lib/ui";
import {
	type KeyedPanelItem,
	describePrintableInput,
	renderKeyedPanelItem,
} from "../lib/ui/keyed-panel";

type PromptStashAction = "stash" | "stashClear" | "apply" | "pop" | "clear";
type PromptStashMenuComponent = {
	render(width: number): string[];
	invalidate(): void;
	handleInput(data: string): void;
};

type PromptStashMenuItem = KeyedPanelItem & {
	readonly id: PromptStashAction;
};

const PROMPT_STASH_ACTIONS: readonly PromptStashMenuItem[] = [
	{
		id: "stashClear",
		key: "s",
		label: "Stash and clear",
		description: "Save editor prompt and clear the editor",
	},
	{
		id: "stash",
		key: "S",
		label: "Stash",
		description: "Save editor prompt",
	},
	{
		id: "apply",
		key: "a",
		label: "Apply",
		description: "Select and restore a stash without consuming it",
	},
	{
		id: "pop",
		key: "p",
		label: "Pop",
		description: "Select, restore, and consume a stash",
	},
	{
		id: "clear",
		key: "c",
		label: "Clear all",
		description: "Delete all prompt stashes",
	},
];

const NOTICE_CLEAR_MS = 1200;
const STASH_LABEL_WIDTH = 80;

function renderPromptStashMenu(
	theme: Theme,
	border: DynamicBorder,
	notice: string | undefined,
	width: number,
): string[] {
	return [
		...border.render(width),
		truncateToWidth(theme.fg("accent", theme.bold("Prompt Stash")), width, ""),
		...PROMPT_STASH_ACTIONS.map((action) =>
			renderKeyedPanelItem(theme, action, { width, labelWidth: 24 }),
		),
		truncateToWidth(
			notice ? theme.fg("warning", notice) : theme.fg("dim", "q/esc back"),
			width,
			"",
		),
		...border.render(width),
	];
}

function createPromptStashMenuComponent(
	tui: TUI,
	theme: Theme,
	done: (result: PromptStashAction | undefined) => void,
): PromptStashMenuComponent {
	const border = new DynamicBorder((text: string) => theme.fg("accent", text));
	let notice: string | undefined;
	let clearNoticeTimer: ReturnType<typeof setTimeout> | undefined;

	const close = (result: PromptStashAction | undefined): void => {
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
		render: (width: number) =>
			renderPromptStashMenu(theme, border, notice, width),
		invalidate: () => border.invalidate(),
		handleInput(data: string) {
			if (matchesKey(data, "escape")) {
				close(undefined);
				return;
			}

			const input = decodePrintableInput(data);
			if (!input) return;
			if (input === "q") {
				close(undefined);
				return;
			}

			const action = PROMPT_STASH_ACTIONS.find((item) => item.key === input);
			if (action) {
				close(action.id);
				return;
			}

			setNotice(`Unknown action: ${describePrintableInput(input)}`);
			tui.requestRender();
		},
	};
}

async function showPromptStashMenu(
	ctx: ExtensionContext,
): Promise<PromptStashAction | undefined> {
	return ctx.ui.custom<PromptStashAction | undefined>(
		(tui, theme, _keybindings, done) =>
			createPromptStashMenuComponent(tui, theme, done),
	);
}

function toFilterItem(entry: PromptStashEntry): {
	value: string;
	label: string;
	description: string;
} {
	return {
		value: entry.id,
		label: formatPromptStashLabel(entry, STASH_LABEL_WIDTH),
		description: new Date(entry.createdAt).toLocaleTimeString(),
	};
}

async function selectPromptStash(
	ctx: ExtensionContext,
	store: PromptStashStore,
	title: string,
): Promise<string | undefined> {
	const entries = store.list();
	if (entries.length === 0) {
		ctx.ui.notify("No prompt stashes", "warning");
		return undefined;
	}

	const onlyId = getOnlyPromptStashId(entries);
	if (onlyId) return onlyId;

	return showFilterSelect(ctx, {
		title,
		items: entries.map(toFilterItem),
		filterPlaceholder: "type to search stashes",
		maxVisible: 10,
	});
}

function stashEditor(
	ctx: ExtensionContext,
	store: PromptStashStore,
	clear: boolean,
): void {
	const entry = store.stash(ctx.ui.getEditorText());
	if (!entry) {
		ctx.ui.notify("Write a prompt before stashing it", "warning");
		return;
	}

	if (clear) ctx.ui.setEditorText("");
	ctx.ui.notify(`Prompt stashed as #${entry.index}`, "info");
}

async function applySelectedStash(
	ctx: ExtensionContext,
	store: PromptStashStore,
): Promise<void> {
	const id = await selectPromptStash(ctx, store, "Prompt Stash: Apply");
	if (!id) return;

	const text = store.apply(id);
	if (!text) {
		ctx.ui.notify("Prompt stash not found", "warning");
		return;
	}
	ctx.ui.setEditorText(text);
	ctx.ui.notify("Prompt stash applied", "info");
}

async function popSelectedStash(
	ctx: ExtensionContext,
	store: PromptStashStore,
): Promise<void> {
	const id = await selectPromptStash(ctx, store, "Prompt Stash: Pop");
	if (!id) return;

	const text = store.pop(id);
	if (!text) {
		ctx.ui.notify("Prompt stash not found", "warning");
		return;
	}
	ctx.ui.setEditorText(text);
	ctx.ui.notify("Prompt stash popped", "info");
}

async function openPromptStash(
	ctx: ExtensionContext,
	store: PromptStashStore,
): Promise<void> {
	const action = await showPromptStashMenu(ctx);
	switch (action) {
		case "stash":
			stashEditor(ctx, store, false);
			break;
		case "stashClear":
			stashEditor(ctx, store, true);
			break;
		case "apply":
			await applySelectedStash(ctx, store);
			break;
		case "pop":
			await popSelectedStash(ctx, store);
			break;
		case "clear": {
			const count = store.clear();
			ctx.ui.notify(
				count === 0
					? "No prompt stashes to clear"
					: `Cleared ${count} prompt stashes`,
				count === 0 ? "warning" : "info",
			);
			break;
		}
	}
}

function register(): void {
	const store = createPromptStashStore();
	registerQuickActionHandler("promptStash", (ctx) =>
		openPromptStash(ctx, store),
	);
}

export function createPromptStashFeature(): Feature {
	return { name: "prompt-stash", dependsOn: ["quick-actions"], register };
}

export default createPromptStashFeature();
