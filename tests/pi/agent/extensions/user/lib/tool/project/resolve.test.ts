import { mkdirSync, mkdtempSync, realpathSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { resolveTool } from "#pi-user/lib/tool/project/resolve";
import type { ProjectToolConfig } from "#pi-user/lib/tool/project/types";

function tempProject(): string {
	const root = mkdtempSync(join(tmpdir(), "pi-resolve-tool-"));
	mkdirSync(join(root, "packages", "app"), { recursive: true });
	mkdirSync(join(root, "scripts"), { recursive: true });
	return root;
}

function tool(overrides: Partial<ProjectToolConfig> = {}): ProjectToolConfig {
	return {
		name: "demo",
		description: "Run demo",
		parameters: {},
		commands: [{ command: "pnpm", arguments: [] }],
		...overrides,
	};
}

describe("resolveTool", () => {
	it("resolves project-relative cwd and command display metadata", () => {
		const root = tempProject();
		const resolved = resolveTool(
			root,
			tool({
				cwd: "packages/app",
				timeoutSeconds: 60,
				parameters: {
					path: { type: "string", required: true },
					verbose: { type: "boolean", required: false },
					tags: {
						type: "array",
						items: { type: "string" },
						required: false,
					},
				},
				commands: [
					{
						label: "check",
						command: "pnpm",
						cwd: "scripts",
						timeoutSeconds: 10,
						arguments: [
							{ kind: "literal", value: "test" },
							{ kind: "param", name: "path" },
							{ kind: "flag", flag: "--verbose", when: "verbose" },
							{ kind: "option", option: "--config", name: "path" },
							{
								kind: "array",
								style: "repeat",
								option: "--tag",
								name: "tags",
							},
							{ kind: "array", style: "spread", name: "tags" },
							{
								kind: "array",
								style: "join",
								option: "--tags",
								name: "tags",
								separator: ",",
							},
						],
					},
				],
			}),
		);

		assert.equal(resolved.cwd, "packages/app");
		assert.equal(resolved.projectRoot, realpathSync(root));
		assert.equal(resolved.commands[0]?.index, 0);
		assert.equal(resolved.commands[0]?.displayLabel, "check");
		assert.equal(resolved.commands[0]?.absoluteCwd, join(root, "scripts"));
		assert.equal(resolved.commands[0]?.displayCwd, "scripts");
		assert.equal(resolved.commands[0]?.timeoutSeconds, 10);
		assert.equal(
			resolved.commands[0]?.displayCommand,
			'pnpm test {{path}} --verbose when verbose --config {{path}} --tag {{tags}}... {{tags}}... --tags join({{tags}}, ",")',
		);
		assert.equal(
			(
				resolved.parametersSchema as { readonly required?: readonly string[] }
			).required?.includes("path"),
			true,
		);
	});

	it("inherits tool cwd and timeout when command values are omitted", () => {
		const root = tempProject();
		const resolved = resolveTool(
			root,
			tool({
				cwd: "packages/app",
				timeoutSeconds: 60,
				commands: [{ command: "pnpm", arguments: [] }],
			}),
		);

		assert.equal(resolved.commands[0]?.displayLabel, "1");
		assert.equal(resolved.commands[0]?.displayCwd, "packages/app");
		assert.equal(resolved.commands[0]?.timeoutSeconds, 60);
	});

	it("rejects cwd values outside the project root", () => {
		const root = tempProject();
		assert.throws(
			() => resolveTool(root, tool({ cwd: "/tmp" })),
			/demo\.cwd must be relative to the project root/u,
		);
		assert.throws(
			() => resolveTool(root, tool({ cwd: ".." })),
			/demo\.cwd must stay inside the project root/u,
		);
	});

	it("rejects symlink escapes after realpath resolution", () => {
		const root = tempProject();
		const outside = mkdtempSync(join(tmpdir(), "pi-resolve-outside-"));
		symlinkSync(outside, join(root, "outside-link"));

		assert.throws(
			() => resolveTool(root, tool({ cwd: "outside-link" })),
			/demo\.cwd must stay inside the project root/u,
		);
	});

	it("normalizes empty cwd to the project root", () => {
		const root = tempProject();
		const resolved = resolveTool(root, tool({ cwd: "" }));

		assert.equal(resolved.cwd, undefined);
		assert.equal(resolved.commands[0]?.absoluteCwd, resolvePath(root));
		assert.equal(resolved.commands[0]?.displayCwd, ".");
	});
});
