import {
	DynamicBorder,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	decodeKittyPrintable,
	fuzzyFilter,
	getKeybindings,
	matchesKey,
	type SelectItem,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";

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

function decodePrintableInput(data: string): string | undefined {
	return (
		decodeKittyPrintable(data) ??
		(data.length === 1 && data >= " " && data <= "~" ? data : undefined)
	);
}

function getSearchText(item: FilterSelectItem): string {
	return `${item.label} ${item.value} ${item.description ?? ""}`;
}

function normalizeDescription(item: FilterSelectItem): string {
	return item.description?.replace(/[\r\n]+/gu, " ").trim() ?? "";
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

function getVisibleRange(
	selectedIndex: number,
	itemCount: number,
	maxVisible: number,
): { start: number; end: number } {
	const start = Math.max(
		0,
		Math.min(
			selectedIndex - Math.floor(maxVisible / 2),
			itemCount - maxVisible,
		),
	);
	return { start, end: Math.min(start + maxVisible, itemCount) };
}

function getFilteredItems(
	items: readonly FilterSelectItem[],
	filter: string,
): FilterSelectItem[] {
	return filter ? fuzzyFilter([...items], filter, getSearchText) : [...items];
}

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

		let filter = "";
		let filteredItems = getFilteredItems(options.items, filter);
		let selectedIndex = findCurrentIndex(filteredItems, options.currentValue);

		function clampSelection(): void {
			selectedIndex = Math.min(
				Math.max(0, selectedIndex),
				Math.max(0, filteredItems.length - 1),
			);
		}

		function updateFilter(nextFilter: string): void {
			filter = nextFilter;
			filteredItems = getFilteredItems(options.items, filter);
			selectedIndex = filter
				? 0
				: findCurrentIndex(filteredItems, options.currentValue);
			clampSelection();
		}

		function moveSelection(delta: -1 | 1): void {
			if (filteredItems.length === 0) return;
			selectedIndex =
				(selectedIndex + delta + filteredItems.length) % filteredItems.length;
		}

		function renderItem(
			item: FilterSelectItem,
			selected: boolean,
			width: number,
		): string {
			const prefix = selected ? theme.fg("accent", "→ ") : "  ";
			const currentMark =
				item.value === options.currentValue
					? ` ${theme.fg("success", "✓")}`
					: "";
			const labelWidth = Math.max(
				1,
				width - visibleWidth(prefix) - visibleWidth(currentMark) - 2,
			);
			const label = truncateToWidth(item.label, labelWidth, "");
			const styledLabel = selected ? theme.fg("accent", label) : label;
			const left = `${prefix}${styledLabel}${currentMark}`;
			const description = normalizeDescription(item);

			if (!description || width <= 40) return truncateToWidth(left, width, "");

			const gap = " ".repeat(
				Math.max(1, DESCRIPTION_COLUMN_START - visibleWidth(left)),
			);
			const descriptionWidth =
				width - visibleWidth(left) - visibleWidth(gap) - 2;
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

		function renderList(width: number): string[] {
			if (filteredItems.length === 0) {
				return [theme.fg("warning", "  No matching items")];
			}

			const { start, end } = getVisibleRange(
				selectedIndex,
				filteredItems.length,
				maxVisible,
			);
			const lines = filteredItems
				.slice(start, end)
				.map((item, offset) =>
					renderItem(item, start + offset === selectedIndex, width),
				);

			if (start > 0 || end < filteredItems.length) {
				const scrollInfo = `  (${selectedIndex + 1}/${filteredItems.length})`;
				lines.push(
					theme.fg(
						"dim",
						truncateToWidth(scrollInfo, Math.max(0, width - 2), ""),
					),
				);
			}

			return lines;
		}

		return {
			render(width: number) {
				return [
					...border.render(width),
					truncateToWidth(theme.fg("accent", theme.bold(options.title)), width),
					truncateToWidth(
						theme.fg(
							"dim",
							`Filter: ${filter || options.filterPlaceholder || "(type to narrow)"}`,
						),
						width,
					),
					...renderList(width),
					truncateToWidth(
						theme.fg("dim", options.footer ?? DEFAULT_FOOTER),
						width,
					),
					...border.render(width),
				];
			},
			invalidate() {},
			handleInput(data: string) {
				if (matchesKey(data, "backspace")) {
					updateFilter(filter.slice(0, -1));
				} else if (keybindings.matches(data, "tui.select.up")) {
					moveSelection(-1);
				} else if (keybindings.matches(data, "tui.select.down")) {
					moveSelection(1);
				} else if (keybindings.matches(data, "tui.select.confirm")) {
					const selectedItem = filteredItems[selectedIndex];
					if (selectedItem) done(selectedItem.value);
				} else if (keybindings.matches(data, "tui.select.cancel")) {
					done(undefined);
				} else {
					const printable = decodePrintableInput(data);
					if (printable) updateFilter(filter + printable);
				}

				tui.requestRender();
			},
		};
	});
}
