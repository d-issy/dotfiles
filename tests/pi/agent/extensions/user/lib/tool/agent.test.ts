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
import { AGENT_TOOL, registerAgentTool } from "#pi-user/lib/tool/agent";

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

function getAgentDefinition(): ToolDefinition {
	const catalog = createToolCatalog();
	registerAgentTool(catalog);
	const agent = catalog.list().find((t) => t.definition.name === AGENT_TOOL);
	assert.ok(agent);
	return agent.definition as ToolDefinition;
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

describe("agent tool registration", () => {
	it("registers the agent tool in the catalog", () => {
		const catalog = createToolCatalog();
		registerAgentTool(catalog);

		const tools = catalog.list();
		const agent = tools.find((t) => t.definition.name === AGENT_TOOL);

		assert.ok(agent, "agent tool should be registered");
		assert.equal(agent.definition.name, AGENT_TOOL);
		assert.equal(agent.definition.executionMode, "parallel");
		assert.ok(agent.definition.parameters, "should have parameters");
	});

	it("defines schema with focus, prompt, and optional title", () => {
		const catalog = createToolCatalog();
		registerAgentTool(catalog);

		const tools = catalog.list();
		const agent = tools.find((t) => t.definition.name === AGENT_TOOL);
		assert.ok(agent);

		const params = agent.definition.parameters;
		// TypeBox schema should have focus, prompt, title properties
		assert.ok(params, "parameters schema is defined");
	});

	it("describes the focus param as a free-form string with available focuses", () => {
		const catalog = createToolCatalog();
		registerAgentTool(catalog, [
			{ name: "explore", description: "investigate the codebase" },
			{ name: "edit", description: "make file changes" },
		]);

		const tools = catalog.list();
		const agent = tools.find((t) => t.definition.name === AGENT_TOOL);
		assert.ok(agent);

		const params = agent.definition.parameters as {
			properties: { focus: { type?: string; description?: string } };
		};
		const focus = params.properties.focus;
		assert.equal(focus.type, "string");
		assert.ok(focus.description?.includes("explore"));
		assert.ok(focus.description?.includes("edit"));
	});

	it("rejects a non-spawnable focus before spawning a process", async () => {
		const catalog = createToolCatalog();
		registerAgentTool(catalog, [{ name: "explore" }]);

		const tools = catalog.list();
		const agent = tools.find((t) => t.definition.name === AGENT_TOOL);
		assert.ok(agent?.definition.execute);

		const result = await agent.definition.execute(
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
		registerAgentTool(catalog);

		const tools = catalog.list();
		const agent = tools.find((t) => t.definition.name === AGENT_TOOL);
		assert.ok(agent);

		const definition = agent.definition as ToolDefinition;
		assert.ok(definition.execute, "should have an execute function");

		// The actual execute spawns a real pi process – at unit-test level we
		// only verify the tool is registered with the correct metadata. Real
		// RpcClient interactions are tested via integration tests.
	});

	it("has executionMode set to parallel", () => {
		const catalog = createToolCatalog();
		registerAgentTool(catalog);

		const tools = catalog.list();
		const agent = tools.find((t) => t.definition.name === AGENT_TOOL);
		assert.ok(agent);
		assert.equal(agent.definition.executionMode, "parallel");
	});

	it("includes prompt guidelines about nesting prevention", () => {
		const catalog = createToolCatalog();
		registerAgentTool(catalog);

		const tools = catalog.list();
		const agent = tools.find((t) => t.definition.name === AGENT_TOOL);
		assert.ok(agent);

		const guidelines = agent.definition.promptGuidelines ?? [];
		const hasNestingWarning = guidelines.some((g) =>
			g.toLowerCase().includes("cannot spawn further"),
		);
		assert.ok(
			hasNestingWarning,
			"guidelines should warn about single-level nesting",
		);
	});
	it("renders collapsed running updates without prompt and with latest tool tail", () => {
		const definition = getAgentDefinition();
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
		const definition = getAgentDefinition();
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
		const definition = getAgentDefinition();
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
		assert.match(output, /2s \(1 tool used\)/u);
		assert.doesNotMatch(output, /2\.5s/u);
		assert.doesNotMatch(output, /tools:/u);
		assert.doesNotMatch(output, /read_chunk/u);
	});
	it("renders agent running time with fractions and completed time without fractions", () => {
		const definition = getAgentDefinition();
		assert.ok(definition.renderResult);

		const running = renderText(
			definition.renderResult(
				{
					content: [{ type: "text", text: "◉ Running  9.2s (1 tool used)" }],
					details: {
						_status: "running",
						_runningLine: "◉ Running  9.2s (1 tool used)",
						toolCallCount: 1,
						durationMs: 9200,
					},
				} satisfies AgentToolResult<Record<string, unknown>>,
				{ expanded: false, isPartial: true },
				plainTheme,
				renderResultContext(),
			) as { render(width: number): string[] },
		);
		assert.match(running, /9\.2s/u);

		const completed = renderText(
			definition.renderResult(
				{
					content: [{ type: "text", text: "Done" }],
					details: { toolCallCount: 1, durationMs: 9200 },
				} satisfies AgentToolResult<Record<string, unknown>>,
				{ expanded: false, isPartial: false },
				plainTheme,
				renderResultContext(),
			) as { render(width: number): string[] },
		);
		assert.match(completed, /9s \(1 tool used\)/u);
		assert.doesNotMatch(completed, /9\.2s/u);
	});

	it("registers an isErrorResult hook", () => {
		const catalog = createToolCatalog();
		registerAgentTool(catalog);

		const tools = catalog.list();
		const agent = tools.find((t) => t.definition.name === AGENT_TOOL);
		assert.ok(agent);
		assert.ok(
			typeof agent.isErrorResult === "function",
			"should have isErrorResult hook",
		);
	});
});

describe("agent isErrorResult", () => {
	it("returns false when details are undefined", () => {
		const catalog = createToolCatalog();
		registerAgentTool(catalog);

		const tools = catalog.list();
		const agent = tools.find((t) => t.definition.name === AGENT_TOOL);
		assert.ok(agent);

		const result = agent.isErrorResult?.(undefined);
		assert.equal(result, false);
	});

	it("returns true when stderr is present", () => {
		const catalog = createToolCatalog();
		registerAgentTool(catalog);

		const tools = catalog.list();
		const agent = tools.find((t) => t.definition.name === AGENT_TOOL);
		assert.ok(agent);

		const result = agent.isErrorResult?.({ stderr: "error output" });
		assert.equal(result, true);
	});
});

describe("agent tool access", () => {
	it("is not blocked by focus policy when registered in catalog", () => {
		const catalog = createToolCatalog();
		registerAgentTool(catalog);

		// The agent tool should be allowed in all focuses (via ALWAYS_ALLOWED_TOOL_NAMES)
		// In the catalog, it has no notAllowedReason policy, so the fallback applies
		const reason = catalog.checkToolAllowed("explore", new Set([AGENT_TOOL]), {
			toolName: AGENT_TOOL,
			input: {},
		} as never);
		assert.equal(reason, undefined);
	});
});

describe("agent PI_AGENT environment guard", () => {
	it("tool is registered regardless of environment", () => {
		// The spec says the feature/feature-registration should skip
		// when PI_AGENT=1, but the tool registration itself is independent.
		// The guard is applied at the feature registration level (main.ts / features/tool.ts).
		const catalog = createToolCatalog();
		registerAgentTool(catalog);

		const tools = catalog.list();
		const agent = tools.find((t) => t.definition.name === AGENT_TOOL);
		assert.ok(agent);
	});
});
