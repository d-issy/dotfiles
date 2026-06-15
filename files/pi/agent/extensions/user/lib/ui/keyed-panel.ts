import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export type KeyedPanelItem = {
	readonly key: string;
	readonly label: string;
	readonly description: string;
};

export function describePrintableInput(input: string): string {
	return input === " " ? "space" : input;
}

export function renderKeyedPanelItem(
	theme: Theme,
	item: KeyedPanelItem,
	options: {
		readonly width: number;
		readonly selected?: boolean;
		readonly labelWidth?: number;
	},
): string {
	const prefix = options.selected ? theme.fg("accent", "→ ") : "  ";
	const key = theme.fg("accent", item.key);
	const label = options.selected
		? theme.fg("accent", item.label)
		: theme.bold(item.label);
	const left = `${prefix}${key}  ${label}`;
	const gap = " ".repeat(
		Math.max(1, (options.labelWidth ?? 18) - visibleWidth(left)),
	);
	return truncateToWidth(
		`${left}${theme.fg("muted", gap + item.description)}`,
		options.width,
		"",
	);
}
