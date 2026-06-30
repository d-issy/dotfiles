export type PromptStashEntry = {
	readonly id: string;
	readonly index: number;
	readonly text: string;
	readonly createdAt: number;
};

export type PromptStashStore = {
	stash(text: string): PromptStashEntry | undefined;
	list(): readonly PromptStashEntry[];
	apply(id: string): string | undefined;
	pop(id: string): string | undefined;
	clear(): number;
};

const DEFAULT_LABEL_WIDTH = 80;

export function createPromptStashStore(): PromptStashStore {
	let entries: PromptStashEntry[] = [];
	let nextIndex = 1;

	return {
		stash(text) {
			const normalized = text.trim();
			if (!normalized) return undefined;

			const entry: PromptStashEntry = {
				id: `prompt-stash-${nextIndex}`,
				index: nextIndex,
				text,
				createdAt: Date.now(),
			};
			nextIndex += 1;
			entries = [entry, ...entries];
			return entry;
		},
		list() {
			return entries;
		},
		apply(id) {
			return entries.find((entry) => entry.id === id)?.text;
		},
		pop(id) {
			const entry = entries.find((item) => item.id === id);
			if (!entry) return undefined;
			entries = entries.filter((item) => item.id !== id);
			return entry.text;
		},
		clear() {
			const count = entries.length;
			entries = [];
			return count;
		},
	};
}

export function getOnlyPromptStashId(
	entries: readonly PromptStashEntry[],
): string | undefined {
	return entries.length === 1 ? entries[0]?.id : undefined;
}

export function formatPromptStashLabel(
	entry: PromptStashEntry,
	width = DEFAULT_LABEL_WIDTH,
): string {
	const text = entry.text.replace(/\s+/gu, " ").trim();
	const label = `#${entry.index} ${text}`;
	return label.length > width
		? `${label.slice(0, Math.max(0, width - 1))}…`
		: label;
}
