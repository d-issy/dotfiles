import type { AutocompleteItem } from "@earendil-works/pi-tui";

export function prefixCompletions(
	items: readonly AutocompleteItem[],
	prefix: string,
): AutocompleteItem[] | null {
	const filtered = items.filter((item) => item.value.startsWith(prefix));
	return filtered.length > 0 ? filtered : null;
}
