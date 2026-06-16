import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { normalizeTool } from "./normalize";

describe("normalizeTool", () => {
	it("normalizes a project tool with parameters and command arguments", () => {
		assert.deepEqual(
			normalizeTool("demo", {
				description: "Run demo",
				executionMode: "parallel",
				cwd: "packages/demo",
				timeoutSeconds: 30,
				promptSnippet: "Run demo checks",
				promptGuidelines: ["Use after changing demo files."],
				parameters: {
					path: { type: "string", required: true },
					count: { type: "number", description: "repeat count" },
					verbose: { type: "boolean" },
					tags: { type: "string[]" },
					ids: { type: "array", items: { type: "number" } },
				},
				commands: [
					{
						label: "demo",
						command: "demo",
						arguments: [
							"run",
							"{{path}}",
							{ option: "--count", value: "{{count}}" },
							{ flag: "--verbose", when: "verbose" },
							{ option: "--tag", values: "{{tags}}", style: "repeat" },
							{ values: "{{ids}}", style: "join", separator: "," },
						],
					},
				],
			}),
			{
				name: "demo",
				description: "Run demo",
				executionMode: "parallel",
				cwd: "packages/demo",
				timeoutSeconds: 30,
				promptSnippet: "Run demo checks",
				promptGuidelines: ["Use after changing demo files."],
				parameters: {
					path: { type: "string", required: true, description: undefined },
					count: {
						type: "number",
						required: false,
						description: "repeat count",
					},
					verbose: { type: "boolean", required: false, description: undefined },
					tags: {
						type: "array",
						items: { type: "string" },
						required: false,
						description: undefined,
					},
					ids: {
						type: "array",
						items: { type: "number" },
						required: false,
						description: undefined,
					},
				},
				commands: [
					{
						label: "demo",
						command: "demo",
						arguments: [
							{ kind: "literal", value: "run" },
							{ kind: "param", name: "path" },
							{ kind: "option", option: "--count", name: "count" },
							{ kind: "flag", flag: "--verbose", when: "verbose" },
							{
								kind: "array",
								style: "repeat",
								option: "--tag",
								name: "tags",
							},
							{
								kind: "array",
								style: "join",
								name: "ids",
								separator: ",",
							},
						],
						cwd: undefined,
						timeoutSeconds: undefined,
					},
				],
			},
		);
	});

	it("rejects invalid tool and command configuration", () => {
		assert.throws(() => normalizeTool("BadName", {}), /Invalid tool name/u);
		assert.throws(
			() =>
				normalizeTool("demo", {
					description: "Run demo",
					commands: [],
				}),
			/commands is required/u,
		);
		assert.throws(
			() =>
				normalizeTool("demo", {
					description: "Run demo",
					commands: [{ command: "pnpm test" }],
				}),
			/single executable token/u,
		);
	});

	it("rejects invalid parameter references", () => {
		assert.throws(
			() =>
				normalizeTool("demo", {
					description: "Run demo",
					parameters: { files: { type: "string[]" } },
					commands: [{ command: "demo", arguments: ["{{files}}"] }],
				}),
			/references array parameter 'files'/u,
		);
		assert.throws(
			() =>
				normalizeTool("demo", {
					description: "Run demo",
					parameters: { path: { type: "string" } },
					commands: [{ command: "demo", arguments: ["prefix-{{path}}"] }],
				}),
			/parameter references must be the whole argument/u,
		);
		assert.throws(
			() =>
				normalizeTool("demo", {
					description: "Run demo",
					parameters: { enabled: { type: "boolean" } },
					commands: [
						{
							command: "demo",
							arguments: [{ option: "--enabled", value: "{{enabled}}" }],
						},
					],
				}),
			/value must reference a string or number parameter/u,
		);
	});
});
