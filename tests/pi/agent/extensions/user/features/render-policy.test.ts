import assert from "node:assert/strict";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { describe, it } from "vitest";
import { createRenderPolicyFeature } from "#pi-user/features/render-policy";

type ToolDef = {
	name: string;
	label?: string;
	description?: string;
	parameters?: unknown;
	execute?: (...args: unknown[]) => unknown;
	renderResult?: (
		result: { content: unknown[]; details?: unknown; isError?: boolean },
		options: { expanded: boolean; isPartial: boolean },
		theme: Theme,
		_context: unknown,
	) => Component;
};

type Harness = {
	findTool(name: string): ToolDef;
};

function makeTheme(): Theme {
	return {
		fg(_name: string, text: string) {
			return text;
		},
		bold(text: string) {
			return text;
		},
	} as unknown as Theme;
}

function makeResult(overrides?: {
	lines?: string[];
	details?: unknown;
	isError?: boolean;
}): {
	content: { type: "text"; text: string }[];
	details?: unknown;
	isError?: boolean;
} {
	return {
		content: [{ type: "text", text: (overrides?.lines ?? []).join("\n") }],
		details: overrides?.details,
		isError: overrides?.isError ?? false,
	};
}

function renderText(component: Component): string {
	const lines = component.render(120);
	return lines.map((l) => l.trimEnd()).join("\n");
}

function createHarness(): Harness {
	const tools = new Map<string, ToolDef>();
	const pi = {
		registerTool(def: ToolDef) {
			tools.set(def.name, def);
		},
	} as never;

	createRenderPolicyFeature().register(pi, {} as never);

	return {
		findTool(name: string) {
			const tool = tools.get(name);
			assert.ok(tool, `Tool "${name}" was not registered`);
			return tool!;
		},
	};
}

const theme = makeTheme();
const noCtx = {};
const errorCtx = {
	args: { path: "missing.txt" },
	cwd: process.cwd(),
	isError: true,
	lastComponent: undefined,
	showImages: false,
};

// ────────────────────────────────────────────────────────
// read
// ────────────────────────────────────────────────────────
describe("read renderResult", () => {
	const read = createHarness().findTool("read");

	it("returns empty for completed result (collapsed)", () => {
		const result = makeResult({ lines: ["a", "b", "c"] });
		const component = read.renderResult!(
			result,
			{ expanded: false, isPartial: false },
			theme,
			noCtx,
		);
		assert.equal(renderText(component), "");
	});

	it("returns empty for completed result (expanded)", () => {
		const result = makeResult({ lines: ["a", "b", "c"] });
		const component = read.renderResult!(
			result,
			{ expanded: true, isPartial: false },
			theme,
			noCtx,
		);
		assert.equal(renderText(component), "");
	});

	it("does not hide error results", () => {
		const result = makeResult({ lines: ["read failed"], isError: true });
		const component = read.renderResult!(
			result,
			{ expanded: false, isPartial: false },
			theme,
			errorCtx,
		);
		const text = renderText(component);
		assert.notEqual(text, "");
		assert.match(text, /read failed/u);
	});

	it("shows Reading... during partial", () => {
		const result = makeResult();
		const component = read.renderResult!(
			result,
			{ expanded: false, isPartial: true },
			theme,
			noCtx,
		);
		assert.match(renderText(component), /Reading/u);
	});
});

// ────────────────────────────────────────────────────────
// grep
// ────────────────────────────────────────────────────────
describe("grep renderResult", () => {
	const grep = createHarness().findTool("grep");

	it("shows match count in collapsed (not truncated)", () => {
		const result = makeResult({
			lines: ["a.txt:1:foo", "b.txt:2:bar", "c.txt:3:baz"],
		});
		const component = grep.renderResult!(
			result,
			{ expanded: false, isPartial: false },
			theme,
			noCtx,
		);
		const text = renderText(component);
		assert.match(text, /3 matches/u);
		assert.doesNotMatch(text, /truncated/u);
	});

	it("shows match count with truncation warning when truncated", () => {
		const result = makeResult({
			lines: Array.from({ length: 150 }, (_, i) => `f${i}.ts:${i}:line`),
			details: { matchLimitReached: 100 },
		});
		const component = grep.renderResult!(
			result,
			{ expanded: false, isPartial: false },
			theme,
			noCtx,
		);
		const text = renderText(component);
		assert.match(text, /150 matches/u);
		assert.match(text, /truncated/u);
	});

	it("shows full content in expanded", () => {
		const result = makeResult({ lines: ["a.txt:1:foo", "b.txt:2:bar"] });
		const component = grep.renderResult!(
			result,
			{ expanded: true, isPartial: false },
			theme,
			noCtx,
		);
		assert.equal(renderText(component), "a.txt:1:foo\nb.txt:2:bar");
	});

	it("does not collapse error results into a match count", () => {
		const result = makeResult({ lines: ["grep failed"], isError: true });
		const component = grep.renderResult!(
			result,
			{ expanded: false, isPartial: false },
			theme,
			errorCtx,
		);
		const text = renderText(component);
		assert.match(text, /grep failed/u);
		assert.doesNotMatch(text, /matches/u);
	});

	it("shows Searching... during partial", () => {
		const component = grep.renderResult!(
			makeResult(),
			{ expanded: false, isPartial: true },
			theme,
			noCtx,
		);
		assert.match(renderText(component), /Searching/u);
	});
});

// ────────────────────────────────────────────────────────
// find
// ────────────────────────────────────────────────────────
describe("find renderResult", () => {
	const find = createHarness().findTool("find");

	it("shows file count in collapsed (not truncated)", () => {
		const result = makeResult({ lines: ["src/a.ts", "src/b.ts", "lib/c.ts"] });
		const component = find.renderResult!(
			result,
			{ expanded: false, isPartial: false },
			theme,
			noCtx,
		);
		const text = renderText(component);
		assert.match(text, /3 files/u);
		assert.doesNotMatch(text, /truncated/u);
	});

	it("shows file count with truncation warning when truncated", () => {
		const result = makeResult({
			lines: Array.from({ length: 1500 }, (_, i) => `f${i}.ts`),
			details: { truncation: { truncated: true } },
		});
		const component = find.renderResult!(
			result,
			{ expanded: false, isPartial: false },
			theme,
			noCtx,
		);
		const text = renderText(component);
		assert.match(text, /1500 files/u);
		assert.match(text, /truncated/u);
	});

	it("shows full content in expanded", () => {
		const result = makeResult({ lines: ["a.ts", "b.ts"] });
		const component = find.renderResult!(
			result,
			{ expanded: true, isPartial: false },
			theme,
			noCtx,
		);
		assert.equal(renderText(component), "a.ts\nb.ts");
	});

	it("does not collapse error results into a file count", () => {
		const result = makeResult({ lines: ["find failed"], isError: true });
		const component = find.renderResult!(
			result,
			{ expanded: false, isPartial: false },
			theme,
			errorCtx,
		);
		const text = renderText(component);
		assert.match(text, /find failed/u);
		assert.doesNotMatch(text, /files/u);
	});

	it("shows Searching... during partial", () => {
		const component = find.renderResult!(
			makeResult(),
			{ expanded: false, isPartial: true },
			theme,
			noCtx,
		);
		assert.match(renderText(component), /Searching/u);
	});
});

// ────────────────────────────────────────────────────────
// ls
// ────────────────────────────────────────────────────────
describe("ls renderResult", () => {
	const ls = createHarness().findTool("ls");

	it("shows entry count in collapsed (not truncated)", () => {
		const result = makeResult({ lines: ["dir/", "file.ts", "other.js"] });
		const component = ls.renderResult!(
			result,
			{ expanded: false, isPartial: false },
			theme,
			noCtx,
		);
		const text = renderText(component);
		assert.match(text, /3 entries/u);
		assert.doesNotMatch(text, /truncated/u);
	});

	it("shows entry count with truncation warning when truncated", () => {
		const result = makeResult({
			lines: Array.from({ length: 600 }, (_, i) => `f${i}`),
			details: { entryLimitReached: 500 },
		});
		const component = ls.renderResult!(
			result,
			{ expanded: false, isPartial: false },
			theme,
			noCtx,
		);
		const text = renderText(component);
		assert.match(text, /600 entries/u);
		assert.match(text, /truncated/u);
	});

	it("shows full content in expanded", () => {
		const result = makeResult({ lines: ["dir/", "file.ts"] });
		const component = ls.renderResult!(
			result,
			{ expanded: true, isPartial: false },
			theme,
			noCtx,
		);
		assert.equal(renderText(component), "dir/\nfile.ts");
	});

	it("does not collapse error results into an entry count", () => {
		const result = makeResult({ lines: ["ls failed"], isError: true });
		const component = ls.renderResult!(
			result,
			{ expanded: false, isPartial: false },
			theme,
			errorCtx,
		);
		const text = renderText(component);
		assert.match(text, /ls failed/u);
		assert.doesNotMatch(text, /entries/u);
	});

	it("shows Listing... during partial", () => {
		const component = ls.renderResult!(
			makeResult(),
			{ expanded: false, isPartial: true },
			theme,
			noCtx,
		);
		assert.match(renderText(component), /Listing/u);
	});
});
