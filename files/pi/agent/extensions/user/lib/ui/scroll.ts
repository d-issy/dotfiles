/**
 * Scroll-window math for rendering a fixed-height viewport over a longer list.
 * Pure and list-shape-agnostic: it only deals in indices and counts, so any
 * scrollable widget can reuse it.
 */
import { clamp } from "../math";

/** Half-open `[start, end)` slice of a list that is currently on screen. */
export type VisibleRange = {
	readonly start: number;
	readonly end: number;
};

/**
 * Given the selected index, total item count, and viewport height, return the
 * `[start, end)` slice to render. Keeps the selection roughly centred and never
 * scrolls past either end of the list.
 */
export function getVisibleRange(
	selectedIndex: number,
	itemCount: number,
	maxVisible: number,
): VisibleRange {
	const start = clamp(
		selectedIndex - Math.floor(maxVisible / 2),
		0,
		itemCount - maxVisible,
	);
	return { start, end: Math.min(start + maxVisible, itemCount) };
}
