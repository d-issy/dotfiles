/**
 * Small, dependency-free numeric helpers. Not tied to any feature or to the
 * terminal UI — just plain math shared across the extension.
 */

/**
 * Constrain `value` to the inclusive `[min, max]` range.
 *
 * The lower bound is applied last, so when the range is degenerate (`max < min`,
 * e.g. a viewport taller than the list) `min` wins. This matches how list and
 * scroll math here want to behave: clamp to a valid index, falling back to the
 * start when there is nothing to scroll.
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}
