/**
 * Scroll-window math for rendering a fixed-height viewport over a longer list.
 * Pure and list-shape-agnostic: it only deals in indices and counts, so any
 * scrollable widget can reuse it.
 */

/**
 * Given the selected index, total item count, and viewport height, return the
 * `[start, end)` slice to render. Keeps the selection roughly centred and never
 * scrolls past either end of the list.
 */
export function getVisibleRange(
	selectedIndex: number,
	itemCount: number,
	maxVisible: number,
): { start: number; end: number } {
	const start = Math.max(
		0,
		Math.min(selectedIndex - Math.floor(maxVisible / 2), itemCount - maxVisible),
	);
	return { start, end: Math.min(start + maxVisible, itemCount) };
}
