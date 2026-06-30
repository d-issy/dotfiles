import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
	createPromptStashStore,
	formatPromptStashLabel,
	getOnlyPromptStashId,
} from "#pi-user/lib/prompt-stash";

describe("prompt stash store", () => {
	it("stores prompts in newest-first order", () => {
		const store = createPromptStashStore();

		const first = store.stash("first prompt");
		const second = store.stash("second prompt");

		assert.equal(first?.index, 1);
		assert.equal(second?.index, 2);
		assert.deepEqual(
			store.list().map((entry) => entry.text),
			["second prompt", "first prompt"],
		);
	});

	it("does not store blank prompts", () => {
		const store = createPromptStashStore();

		assert.equal(store.stash("  \n\t  "), undefined);
		assert.deepEqual(store.list(), []);
	});

	it("applies a stash without consuming it", () => {
		const store = createPromptStashStore();
		const entry = store.stash("keep me");
		assert.ok(entry);

		assert.equal(store.apply(entry.id), "keep me");
		assert.deepEqual(
			store.list().map((item) => item.text),
			["keep me"],
		);
	});

	it("pops a selected stash and consumes it", () => {
		const store = createPromptStashStore();
		const first = store.stash("first");
		const second = store.stash("second");
		assert.ok(first);
		assert.ok(second);

		assert.equal(store.pop(first.id), "first");
		assert.deepEqual(
			store.list().map((entry) => entry.text),
			["second"],
		);
	});

	it("clears all stashes", () => {
		const store = createPromptStashStore();
		store.stash("one");
		store.stash("two");

		assert.equal(store.clear(), 2);
		assert.deepEqual(store.list(), []);
	});
});

describe("getOnlyPromptStashId", () => {
	it("returns the only stash id when exactly one stash exists", () => {
		const store = createPromptStashStore();
		const entry = store.stash("only prompt");
		assert.ok(entry);

		assert.equal(getOnlyPromptStashId(store.list()), entry.id);
	});

	it("returns undefined when zero or multiple stashes exist", () => {
		const store = createPromptStashStore();

		assert.equal(getOnlyPromptStashId(store.list()), undefined);
		store.stash("one");
		store.stash("two");
		assert.equal(getOnlyPromptStashId(store.list()), undefined);
	});
});

describe("formatPromptStashLabel", () => {
	it("normalizes whitespace and trims long prompts to one line", () => {
		const label = formatPromptStashLabel(
			{
				id: "prompt-stash-1",
				index: 1,
				text: "first line\nsecond line with extra words",
				createdAt: 0,
			},
			24,
		);

		assert.equal(label, "#1 first line second li…");
	});
});
