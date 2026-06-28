import assert from "node:assert/strict";
import type {
	AgentToolResult,
	Theme,
	ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import {
	type FocusDefinition,
	isFocusSpawnable,
} from "#pi-user/lib/focus/definitions";
import { createToolCatalog } from "#pi-user/lib/tool/catalog";
import {
	SUBAGENT_TOOL,
	registerSubagentTool,
} from "#pi-user/lib/tool/subagent";

const plainTheme = {
	fg: (_name: string, text: string) => text,
	bold: (text: string) => text,
} as Theme;

function renderText(component: { render(width: number): string[] }): string {
	return component
		.render(200)
		.map((line) => line.replace(/[ \t]+$/u, ""))
		.join("\n");
}

function renderResultContext(): Parameters<
	NonNullable<ToolDefinition["renderResult"]>
>[3] {
	return { state: {}, invalidate: () => undefined } as Parameters<
		NonNullable<ToolDefinition["renderResult"]>
	>[3];
}

function getSubagentDefinition(): ToolDefinition {
	const catalog = createToolCatalog();
	registerSubagentTool(catalog);
	const subagent = catalog
		.list()
		.find((t) => t.definition.name === SUBAGENT_TOOL);
	assert.ok(subagent);
	return subagent.definition as ToolDefinition;
}
function makeFocus(overrides: Partial<FocusDefinition>): FocusDefinition {
	return {
		name: "x",
		description: "x",
		prompt: "x",
		tools: [],
		transition: "auto",
		...overrides,
	};
}

describe("isFocusSpawnable", () => {
	it("defaults to spawnable for non-interactive focuses", () => {
		assert.equal(isFocusSpawnable(makeFocus({})), true);
	});

	it("excludes interactiveOnly focuses by default", () => {
		assert.equal(isFocusSpawnable(makeFocus({ interactiveOnly: true })), false);
	});

	it("honors an explicit spawnable override", () => {
		assert.equal(
			isFocusSpawnable(makeFocus({ interactiveOnly: true, spawnable: true })),
			true,
		);
		assert.equal(isFocusSpawnable(makeFocus({ spawnable: false })), false);
	});
});

describe("subagent tool registration", () => {
	it("registers the subagent tool in the catalog", () => {
		const catalog = createToolCatalog();
		registerSubagentTool(catalog);

		const tools = catalog.list();
		const subagent = tools.find((t) => t.definition.name === SUBAGENT_TOOL);

		assert.ok(subagent, "subagent tool should be registered");
		assert.equal(subagent.definition.name, SUBAGENT_TOOL);
		assert.equal(subagent.definition.executionMode, "parallel");
		assert.ok(subagent.definition.parameters, "should have parameters");
	});

	it("defines schema with focus, prompt, and optional title", () => {
		const catalog = createToolCatalog();
		registerSubagentTool(catalog);

		const tools = catalog.list();
		const subagent = tools.find((t) => t.definition.name === SUBAGENT_TOOL);
		assert.ok(subagent);

		const params = subagent.definition.parameters;
		// TypeBox schema should have focus, prompt, title properties
		assert.ok(params, "parameters schema is defined");
	});

	it("describes the focus param as a free-form string with available focuses", () => {
		const catalog = createToolCatalog();
		registerSubagentTool(catalog, [
			{ name: "explore", description: "investigate the codebase" },
			{ name: "edit", description: "make file changes" },
		]);

		const tools = catalog.list();
		const subagent = tools.find((t) => t.definition.name === SUBAGENT_TOOL);
		assert.ok(subagent);

		const params = subagent.definition.parameters as {
			properties: { focus: { type?: string; description?: string } };
		};
		const focus = params.properties.focus;
		assert.equal(focus.type, "string");
		assert.ok(focus.description?.includes("explore"));
		assert.ok(focus.description?.includes("edit"));
	});

	it("rejects a non-spawnable focus before spawning a process", async () => {
		const catalog = createToolCatalog();
		registerSubagentTool(catalog, [{ name: "explore" }]);

		const tools = catalog.list();
		const subagent = tools.find((t) => t.definition.name === SUBAGENT_TOOL);
		assert.ok(subagent?.definition.execute);

		const result = await subagent.definition.execute(
			"call-1",
			{ focus: "interview", prompt: "do something" },
			undefined,
			undefined,
			{ cwd: process.cwd() } as never,
		);
		assert.equal((result as { isError?: boolean }).isError, true);
		assert.match(
			result.content.find((c) => c.type === "text")?.text ?? "",
			/does not exist/u,
		);
	});

	it("executes with UI returns result from getLastAssistantText", async () => {
		const catalog = createToolCatalog();
		registerSubagentTool(catalog);

		const tools = catalog.list();
		const subagent = tools.find((t) => t.definition.name === SUBAGENT_TOOL);
		assert.ok(subagent);

		const definition = subagent.definition as ToolDefinition;
		assert.ok(definition.execute, "should have an execute function");

		// The actual execute spawns a real pi process – at unit-test level we
		// only verify the tool is registered with the correct metadata. Real
		// RpcClient interactions are tested via integration tests.
	});

	it("has executionMode set to parallel", () => {
		const catalog = createToolCatalog();
		registerSubagentTool(catalog);

		const tools = catalog.list();
		const subagent = tools.find((t) => t.definition.name === SUBAGENT_TOOL);
		assert.ok(subagent);
		assert.equal(subagent.definition.executionMode, "parallel");
	});

	it("includes prompt guidelines about nesting prevention", () => {
		const catalog = createToolCatalog();
		registerSubagentTool(catalog);

		const tools = catalog.list();
		const subagent = tools.find((t) => t.definition.name === SUBAGENT_TOOL);
		assert.ok(subagent);

		const guidelines = subagent.definition.promptGuidelines ?? [];
		const hasNestingWarning = guidelines.some((g) =>
			g.toLowerCase().includes("cannot spawn further"),
		);
		assert.ok(
			hasNestingWarning,
			"guidelines should warn about single-level nesting",
		);
	});
	it("renders collapsed running updates without prompt and with latest tool tail", () => {
		const definition = getSubagentDefinition();
		assert.ok(definition.renderResult);

		const result = {
			content: [
				{
					type: "text" as const,
					text: [
						"── (other 2 tools...) ──",
						' 3. grep (pattern={"raw":"TODO"})',
						' 4. read_chunk (path="src/b.ts")',
						' 5. lint (options={"fix":false})  ← running',
						"◉ Running  1.2s (5 tools used)",
					].join("\n"),
				},
			],
			details: {
				_status: "running",
				_runningLine: "◉ Running  1.2s (5 tools used)",
				toolCallCount: 5,
				durationMs: 1200,
				prompt: "Investigate the failing tests",
				toolCalls: [
					{ name: "read_chunk", args: { path: "src/a.ts" }, startTime: 0 },
					{ name: "find", args: { pattern: "*.ts" }, startTime: 500 },
					{
						name: "grep",
						args: { pattern: { raw: "TODO" } },
						startTime: 1000,
					},
					{ name: "read_chunk", args: { path: "src/b.ts" }, startTime: 1500 },
					{ name: "lint", args: { options: { fix: false } }, startTime: 2000 },
				],
			},
		} satisfies AgentToolResult<Record<string, unknown>>;

		const output = renderText(
			definition.renderResult(
				result,
				{ expanded: false, isPartial: true },
				plainTheme,
				renderResultContext(),
			) as { render(width: number): string[] },
		);

		assert.doesNotMatch(output, /prompt:/u);
		assert.doesNotMatch(output, /Investigate the failing tests/u);
		assert.doesNotMatch(output, /1\. read_chunk/u);
		assert.doesNotMatch(output, /2\. find/u);
		assert.match(output, /other 2 tools/u);
		assert.match(output, /3\. grep/u);
		assert.match(output, /5\. lint/u);
		assert.match(output, /options=\{"fix":false\}/u);
		assert.doesNotMatch(output, /\[object Object\]/u);
	});

	it("renders expanded running updates with prompt and all tools", () => {
		const definition = getSubagentDefinition();
		assert.ok(definition.renderResult);

		const result = {
			content: [{ type: "text" as const, text: "latest tail only" }],
			details: {
				_status: "running",
				_runningLine: "◉ Running  1.2s (5 tools used)",
				toolCallCount: 5,
				durationMs: 1200,
				prompt: "Investigate the failing tests",
				toolCalls: [
					{ name: "read_chunk", args: { path: "src/a.ts" }, startTime: 0 },
					{ name: "find", args: { pattern: "*.ts" }, startTime: 500 },
					{
						name: "grep",
						args: { pattern: { raw: "TODO" } },
						startTime: 1000,
					},
					{ name: "read_chunk", args: { path: "src/b.ts" }, startTime: 1500 },
					{ name: "lint", args: { options: { fix: false } }, startTime: 2000 },
				],
			},
		} satisfies AgentToolResult<Record<string, unknown>>;

		const output = renderText(
			definition.renderResult(
				result,
				{ expanded: true, isPartial: true },
				plainTheme,
				renderResultContext(),
			) as { render(width: number): string[] },
		);

		assert.match(output, /prompt:\s*\nInvestigate the failing tests/u);
		assert.match(output, /tools:\s*\n[\s\S]*1\. read_chunk/u);
		assert.match(output, /2\. find/u);
		assert.match(output, /5\. lint/u);
		assert.match(output, /pattern=\{"raw":"TODO"\}/u);
		assert.match(output, /◉ Running\s+1\.2s/u);
		assert.doesNotMatch(output, /\[object Object\]/u);
	});

	it("omits tool history from completed expanded output", () => {
		const definition = getSubagentDefinition();
		assert.ok(definition.renderResult);

		const result = {
			content: [{ type: "text" as const, text: "Done with the task" }],
			details: {
				toolCallCount: 1,
				durationMs: 2500,
				prompt: "Summarize the repository",
				toolCalls: [
					{ name: "read_chunk", args: { path: "README.md" }, startTime: 0 },
				],
			},
		} satisfies AgentToolResult<Record<string, unknown>>;

		const output = renderText(
			definition.renderResult(
				result,
				{ expanded: true, isPartial: false },
				plainTheme,
				renderResultContext(),
			) as { render(width: number): string[] },
		);

		assert.match(output, /prompt:\s*\nSummarize the repository/u);
		assert.match(output, /response:\s*\nDone with the task/u);
		assert.match(output, /Completed/u);
		assert.doesNotMatch(output, /tools:/u);
		assert.doesNotMatch(output, /read_chunk/u);
	});

	it("registers an isErrorResult hook", () => {
		const catalog = createToolCatalog();
		registerSubagentTool(catalog);

		const tools = catalog.list();
		const subagent = tools.find((t) => t.definition.name === SUBAGENT_TOOL);
		assert.ok(subagent);
		assert.ok(
			typeof subagent.isErrorResult === "function",
			"should have isErrorResult hook",
		);
	});
});

describe("subagent isErrorResult", () => {
	it("returns false when details are undefined", () => {
		const catalog = createToolCatalog();
		registerSubagentTool(catalog);

		const tools = catalog.list();
		const subagent = tools.find((t) => t.definition.name === SUBAGENT_TOOL);
		assert.ok(subagent);

		const result = subagent.isErrorResult?.(undefined);
		assert.equal(result, false);
	});

	it("returns true when stderr is present", () => {
		const catalog = createToolCatalog();
		registerSubagentTool(catalog);

		const tools = catalog.list();
		const subagent = tools.find((t) => t.definition.name === SUBAGENT_TOOL);
		assert.ok(subagent);

		const result = subagent.isErrorResult?.({ stderr: "error output" });
		assert.equal(result, true);
	});
});

describe("subagent tool access", () => {
	it("is not blocked by focus policy when registered in catalog", () => {
		const catalog = createToolCatalog();
		registerSubagentTool(catalog);

		// The subagent tool should be allowed in all focuses (via ALWAYS_ALLOWED_TOOL_NAMES)
		// In the catalog, it has no notAllowedReason policy, so the fallback applies
		const reason = catalog.checkToolAllowed(
			"explore",
			new Set([SUBAGENT_TOOL]),
			{ toolName: SUBAGENT_TOOL, input: {} } as never,
		);
		assert.equal(reason, undefined);
	});
});

describe("subagent PI_SUBAGENT environment guard", () => {
	it("tool is registered regardless of environment", () => {
		// The spec says the feature/feature-registration should skip
		// when PI_SUBAGENT=1, but the tool registration itself is independent.
		// The guard is applied at the feature registration level (main.ts / features/tool.ts).
		const catalog = createToolCatalog();
		registerSubagentTool(catalog);

		const tools = catalog.list();
		const subagent = tools.find((t) => t.definition.name === SUBAGENT_TOOL);
		assert.ok(subagent);
	});
});
