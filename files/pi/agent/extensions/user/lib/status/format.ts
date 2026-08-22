import { truncateToWidth } from "@earendil-works/pi-tui";

export function formatTokens(value: number): string {
	if (!Number.isFinite(value)) return "0";
	if (value < 1000) return `${Math.max(0, Math.round(value))}`;
	if (value < 10_000) return `${(value / 1000).toFixed(1)}k`;
	if (value < 1_000_000) return `${Math.round(value / 1000)}k`;
	if (value < 10_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
	return `${Math.round(value / 1_000_000)}M`;
}

export function formatPercent(value: number): string {
	return `${value.toFixed(1)}%`;
}

function reverse(value: string): string {
	return [...value].reduce((result, character) => character + result, "");
}

export function truncateMiddle(value: string, width: number): string {
	if (width <= 0) return "";
	if (truncateToWidth(value, width, "") === value) return value;

	const available = Math.max(0, width - 1);
	const leftWidth = Math.ceil(available / 2);
	const rightWidth = Math.floor(available / 2);
	const left = truncateToWidth(value, leftWidth, "");
	const reversed = reverse(value);
	const right = reverse(truncateToWidth(reversed, rightWidth, ""));
	return `${left}…${right}`;
}
