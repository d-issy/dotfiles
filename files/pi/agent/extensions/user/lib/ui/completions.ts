/**
 * Generic command-argument autocomplete helper, independent of any feature.
 * Returns `null` (rather than an empty array) when nothing matches so callers
 * can hand it straight back to pi's `getArgumentCompletions`, which treats
 * `null` as "no completions".
 */
import type { AutocompleteItem } from "@earendil-works/pi-tui";

export function filterCompletionsByPrefix(
	items: readonly AutocompleteItem[],
	prefix: string,
): AutocompleteItem[] | null {
	const filtered = items.filter((item) => item.value.startsWith(prefix));
	return filtered.length > 0 ? filtered : null;
}
