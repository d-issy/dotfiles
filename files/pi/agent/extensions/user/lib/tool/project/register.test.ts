import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import { createToolCatalog } from "../catalog";
import {
	type TestPiProject,
	createTestPiProject,
	readTestPiProjectUserSettings,
} from "../../test-support/pi-project";
import { isProjectToolAvailable, registerProjectTools } from "./register";

function tempProject(settings: Record<string, unknown>): TestPiProject {
	return createTestPiProject({
		settings,
		includeStandardPiConfig: true,
	});
}

function context(project: TestPiProject): ExtensionContext {
	return {
		cwd: project.cwd,
		hasUI: false,
		isProjectTrusted: () => true,
		ui: {
			notify: (message: string) => project.notifications.push(message),
		},
	} as unknown as ExtensionContext;
}

type RegisteredTool = { readonly name: string };

function fakeExtensionApi(existingToolNames: readonly string[] = []): {
	readonly extensionApi: ExtensionAPI;
	readonly registered: RegisteredTool[];
} {
	const registered: RegisteredTool[] = [];
	return {
		registered,
		extensionApi: {
			getAllTools: () => existingToolNames.map((name) => ({ name })),
			registerTool: (tool: RegisteredTool) => registered.push(tool),
		} as unknown as ExtensionAPI,
	};
}

describe("registerProjectTools", () => {
	it("registers valid project tools into pi and the catalog", () => {
		const project = tempProject({
			tools: {
				[`demo_${randomUUID().replaceAll("-", "_")}`]: {
					description: "Run demo",
					executionMode: "parallel",
					parameters: {
						path: { type: "string", required: true },
					},
					commands: [
						{
							label: "demo",
							command: "pnpm",
							arguments: ["test", "{{path}}"],
							timeoutSeconds: 30,
						},
					],
				},
			},
		});
		const toolName = Object.keys(
			projectSettings(project).tools as Record<string, unknown>,
		)[0] as string;
		const { extensionApi, registered } = fakeExtensionApi();
		const catalog = createToolCatalog();

		const summaries = registerProjectTools(
			extensionApi,
			context(project),
			catalog,
		);

		assert.deepEqual(summaries, [{ name: toolName, commandCount: 1 }]);
		assert.equal(registered[0]?.name, toolName);
		assert.equal(catalog.list()[0]?.definition.name, toolName);
		assert.equal(isProjectToolAvailable(toolName), true);
	});

	it("warns and skips invalid or conflicting project tools", () => {
		const project = tempProject({
			tools: {
				conflict: {
					description: "Conflicts with an existing tool",
					commands: [{ command: "pnpm" }],
				},
				bad: {
					description: "Invalid command",
					commands: [{ command: "pnpm test" }],
				},
			},
		});
		const { extensionApi, registered } = fakeExtensionApi(["conflict"]);
		const catalog = createToolCatalog();

		const summaries = registerProjectTools(
			extensionApi,
			context(project),
			catalog,
		);

		assert.deepEqual(summaries, []);
		assert.deepEqual(registered, []);
		assert.equal(catalog.list().length, 0);
		assert.match(
			project.notifications.join("\n"),
			/Project tool 'conflict' conflicts with an existing tool/u,
		);
		assert.match(
			project.notifications.join("\n"),
			/Project tool 'bad' ignored: bad\.commands\[0\]\.command must be a single executable token/u,
		);
	});

	it("disables previously registered project tools after reloading different settings", () => {
		const previousName = `previous_${randomUUID().replaceAll("-", "_")}`;
		const nextName = `next_${randomUUID().replaceAll("-", "_")}`;
		const firstProject = tempProject({
			tools: {
				[previousName]: {
					description: "Previous tool",
					commands: [{ command: "pnpm" }],
				},
			},
		});
		const secondProject = tempProject({
			tools: {
				[nextName]: {
					description: "Next tool",
					commands: [{ command: "pnpm" }],
				},
			},
		});

		registerProjectTools(
			fakeExtensionApi().extensionApi,
			context(firstProject),
			createToolCatalog(),
		);
		assert.equal(isProjectToolAvailable(previousName), true);

		registerProjectTools(
			fakeExtensionApi().extensionApi,
			context(secondProject),
			createToolCatalog(),
		);

		assert.equal(isProjectToolAvailable(previousName), false);
		assert.equal(isProjectToolAvailable(nextName), true);
	});

	it("warns when the tools setting is not an object", () => {
		const project = tempProject({ tools: [] });
		const summaries = registerProjectTools(
			fakeExtensionApi().extensionApi,
			context(project),
			createToolCatalog(),
		);

		assert.deepEqual(summaries, []);
		assert.deepEqual(project.notifications, [
			"Project tools ignored: tools must be an object.",
		]);
	});
});

function projectSettings(project: TestPiProject): Record<string, unknown> {
	return readTestPiProjectUserSettings(project);
}
