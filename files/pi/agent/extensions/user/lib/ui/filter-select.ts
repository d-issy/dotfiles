/**
 * Reusable fuzzy-filter selection overlay built on `ctx.ui.custom`.
 *
 * This is generic, feature-agnostic terminal UI — it knows nothing about modes,
 * thinking effort, or any specific domain. Features feed it a list of
 * {@link FilterSelectItem}s and get back the chosen value. Shared by the `mode`
 * and `thinking` features today; that is why it lives under `lib/ui/` rather
 * than next to a single caller.
 *
 * The file is organised in three layers so the interactive callback at the
 * bottom stays small:
 *   1. selection state  — `createFilterState`: query + filtering + cursor
 *   2. rendering        — `renderItem` / `renderList`: state + theme -> lines
 *   3. wiring           — `showFilterSelect`: maps keys to state, state to view
 */
import {
	DynamicBorder,
	type ExtensionContext,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import {
	type SelectItem,
	fuzzyFilter,
	getKeybindings,
	matchesKey,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import { clamp } from "../math";
import { decodePrintableInput } from "./input";
import { getVisibleRange } from "./scroll";

export type FilterSelectItem = SelectItem;

export type FilterSelectOptions = {
	title: string;
	items: readonly FilterSelectItem[];
	maxVisible?: number;
	currentValue?: string;
	filterPlaceholder?: string;
	footer?: string;
};

const DEFAULT_FOOTER =
	"type fuzzy filter • backspace edit • ↑↓ navigate • enter select • esc cancel";
const DEFAULT_MAX_VISIBLE = 10;
const DESCRIPTION_COLUMN_START = 30;
const MIN_DESCRIPTION_WIDTH = 10;
const DESCRIPTION_MIN_TOTAL_WIDTH =
	DESCRIPTION_COLUMN_START + MIN_DESCRIPTION_WIDTH;

// --- selection state -------------------------------------------------------

function getSearchText(item: FilterSelectItem): string {
	return `${item.label} ${item.value} ${item.description ?? ""}`;
}

function findCurrentIndex(
	items: readonly FilterSelectItem[],
	currentValue: string | undefined,
): number {
	if (!currentValue) return 0;
	return Math.max(
		0,
		items.findIndex((item) => item.value === currentValue),
	);
}

function getFilteredItems(
	items: readonly FilterSelectItem[],
	filter: string,
): FilterSelectItem[] {
	return filter ? fuzzyFilter([...items], filter, getSearchText) : [...items];
}

/** What the user has typed, the resulting filtered list, and the cursor. */
type FilterState = {
	readonly query: string;
	readonly items: readonly FilterSelectItem[];
	readonly selectedIndex: number;
	readonly selectedItem: FilterSelectItem | undefined;
	/** Replace the query, re-filter, and reset the cursor. */
	setQuery(next: string): void;
	/** Move the cursor, wrapping around the (filtered) list. */
	move(delta: -1 | 1): void;
};

function createFilterState(
	allItems: readonly FilterSelectItem[],
	currentValue: string | undefined,
): FilterState {
	let query = "";
	let items = getFilteredItems(allItems, query);
	let selectedIndex = findCurrentIndex(items, currentValue);

	return {
		get query() {
			return query;
		},
		get items() {
			return items;
		},
		get selectedIndex() {
			return selectedIndex;
		},
		get selectedItem() {
			return items[selectedIndex];
		},
		setQuery(next) {
			query = next;
			items = getFilteredItems(allItems, query);
			const reset = query ? 0 : findCurrentIndex(items, currentValue);
			selectedIndex = clamp(reset, 0, items.length - 1);
		},
		move(delta) {
			if (items.length === 0) return;
			selectedIndex = (selectedIndex + delta + items.length) % items.length;
		},
	};
}

// --- rendering -------------------------------------------------------------

function normalizeDescription(item: FilterSelectItem): string {
	return item.description?.replace(/[\r\n]+/gu, " ").trim() ?? "";
}

function renderItem(
	theme: Theme,
	options: FilterSelectOptions,
	item: FilterSelectItem,
	selected: boolean,
	width: number,
): string {
	const prefix = selected ? theme.fg("accent", "→ ") : "  ";
	const currentMark =
		item.value === options.currentValue ? ` ${theme.fg("success", "✓")}` : "";
	const labelWidth = Math.max(
		1,
		width - visibleWidth(prefix) - visibleWidth(currentMark) - 2,
	);
	const label = truncateToWidth(item.label, labelWidth, "");
	const styledLabel = selected ? theme.fg("accent", label) : label;
	const left = `${prefix}${styledLabel}${currentMark}`;
	const description = normalizeDescription(item);

	if (!description || width <= DESCRIPTION_MIN_TOTAL_WIDTH)
		return truncateToWidth(left, width, "");

	const gap = " ".repeat(
		Math.max(1, DESCRIPTION_COLUMN_START - visibleWidth(left)),
	);
	const descriptionWidth = width - visibleWidth(left) - visibleWidth(gap) - 2;
	if (descriptionWidth <= MIN_DESCRIPTION_WIDTH) {
		return truncateToWidth(left, width, "");
	}

	const truncatedDescription = truncateToWidth(
		description,
		descriptionWidth,
		"",
	);
	return truncateToWidth(
		`${left}${theme.fg("muted", gap + truncatedDescription)}`,
		width,
		"",
	);
}

function renderList(
	theme: Theme,
	options: FilterSelectOptions,
	state: FilterState,
	width: number,
	maxVisible: number,
): string[] {
	if (state.items.length === 0) {
		return [theme.fg("warning", "  No matching items")];
	}

	const { start, end } = getVisibleRange(
		state.selectedIndex,
		state.items.length,
		maxVisible,
	);
	const lines = state.items
		.slice(start, end)
		.map((item, offset) =>
			renderItem(
				theme,
				options,
				item,
				start + offset === state.selectedIndex,
				width,
			),
		);

	if (start > 0 || end < state.items.length) {
		const scrollInfo = `  (${state.selectedIndex + 1}/${state.items.length})`;
		lines.push(
			theme.fg("dim", truncateToWidth(scrollInfo, Math.max(0, width - 2), "")),
		);
	}

	return lines;
}

// --- wiring ----------------------------------------------------------------

/** One row of the key dispatch table: if `pressed`, perform `run`. */
type KeyAction = {
	pressed: (data: string) => boolean;
	run: () => void;
};

export async function showFilterSelect(
	ctx: ExtensionContext,
	options: FilterSelectOptions,
): Promise<string | undefined> {
	return ctx.ui.custom<string | undefined>((tui, theme, _keybindings, done) => {
		const keybindings = getKeybindings();
		const border = new DynamicBorder((text) => theme.fg("accent", text));
		const maxVisible = Math.max(
			1,
			options.maxVisible ?? Math.min(options.items.length, DEFAULT_MAX_VISIBLE),
		);
		const state = createFilterState(options.items, options.currentValue);

		const selectCurrent = (): void => {
			if (state.selectedItem) done(state.selectedItem.value);
		};
		const cancel = (): void => done(undefined);

		// First binding whose `pressed` matches wins; input matching nothing is
		// treated as text typed into the filter.
		const keyActions: readonly KeyAction[] = [
			{
				pressed: (data) => matchesKey(data, "backspace"),
				run: () => state.setQuery(state.query.slice(0, -1)),
			},
			{
				pressed: (data) => keybindings.matches(data, "tui.select.up"),
				run: () => state.move(-1),
			},
			{
				pressed: (data) => keybindings.matches(data, "tui.select.down"),
				run: () => state.move(1),
			},
			{
				pressed: (data) => keybindings.matches(data, "tui.select.confirm"),
				run: selectCurrent,
			},
			{
				pressed: (data) => keybindings.matches(data, "tui.select.cancel"),
				run: cancel,
			},
		];

		return {
			render(width: number) {
				const filterLine = `Filter: ${state.query || options.filterPlaceholder || "(type to narrow)"}`;
				return [
					...border.render(width),
					truncateToWidth(theme.fg("accent", theme.bold(options.title)), width),
					truncateToWidth(theme.fg("dim", filterLine), width),
					...renderList(theme, options, state, width, maxVisible),
					truncateToWidth(
						theme.fg("dim", options.footer ?? DEFAULT_FOOTER),
						width,
					),
					...border.render(width),
				];
			},
			invalidate() {},
			handleInput(data: string) {
				const action = keyActions.find((entry) => entry.pressed(data));
				if (action) {
					action.run();
				} else {
					const printable = decodePrintableInput(data);
					if (printable) state.setQuery(state.query + printable);
				}

				tui.requestRender();
			},
		};
	});
}
