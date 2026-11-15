import { truncateToWidth } from "@earendil-works/pi-tui";

export function formatTokens(value: number): string {
	if (!Number.isFinite(value)) return "0";
	const tokens = Math.max(0, value);
	if (Math.round(tokens) < 1000) return `${Math.round(tokens)}`;
	if (Math.round(tokens / 100) < 100) return `${(tokens / 1000).toFixed(1)}k`;
	if (Math.round(tokens / 1000) < 1000) return `${Math.round(tokens / 1000)}k`;
	if (Math.round(tokens / 100_000) < 100)
		return `${(tokens / 1_000_000).toFixed(1)}M`;
	return `${Math.round(tokens / 1_000_000)}M`;
}

export function formatPercent(value: number): string {
	return `${value.toFixed(1)}%`;
}

const ANSI_RESET = "\u001b[0m";

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
	// truncateToWidth appends an ANSI reset; reversing it would corrupt the text.
	const cutRight = truncateToWidth(reversed, rightWidth, "");
	const right = reverse(
		cutRight.endsWith(ANSI_RESET)
			? cutRight.slice(0, -ANSI_RESET.length)
			: cutRight,
	);
	return `${left}…${right}`;
}
