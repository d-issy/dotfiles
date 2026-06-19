import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import user from "./main";
import { createTestPiProject } from "./lib/test-support/pi-project";

function withCwd<T>(cwd: string, fn: () => T): T {
	const original = process.cwd();
	process.chdir(cwd);
	try {
		return fn();
	} finally {
		process.chdir(original);
	}
}

describe("user extension", () => {
	it("does not register features when project user settings disables it", () => {
		const project = createTestPiProject({ settings: { enabled: false } });
		const pi = new Proxy(
			{},
			{
				get: (_target, property) => {
					throw new Error(`Unexpected pi.${String(property)} access.`);
				},
			},
		) as ExtensionAPI;

		assert.doesNotThrow(() => withCwd(project.cwd, () => user(pi)));
	});
});
