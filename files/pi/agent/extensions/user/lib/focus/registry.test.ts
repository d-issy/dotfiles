import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { createTestPiProject } from "../test-support/pi-project";
import { FOCUS_EXIT_MODE, FOCUS_TRANSITION } from "./definitions";
import { loadFocusRegistry } from "./registry";

function testProjectCwd(settings: Record<string, unknown>): string {
	return createTestPiProject({ settings }).cwd;
}

describe("loadFocusRegistry", () => {
	it("merges project settings into existing focuses without changing transition security", () => {
		const cwd = testProjectCwd({
			toolSets: {
				verify: ["lint", "test", "lint"],
				all_verify: ["verify", "coverage"],
			},
			focuses: {
				edit: {
					description: "Project edit focus",
					prompt: "Project-specific edit instructions.",
					exitPrompt: "Project exit instructions.",
					tools: ["format", "lint"],
					toolSets: ["all_verify"],
					transition: FOCUS_TRANSITION.AUTO,
					color: "caution",
				},
			},
		});

		const { registry, warnings } = loadFocusRegistry(cwd);
		const edit = registry.get("edit");

		assert.deepEqual(warnings, []);
		assert.equal(edit?.description, "Project edit focus");
		assert.match(edit?.prompt ?? "", /Make focused file changes/u);
		assert.match(edit?.prompt ?? "", /Project-specific edit instructions/u);
		assert.equal(edit?.exitPrompt, "Project exit instructions.");
		assert.equal(edit?.transition, FOCUS_TRANSITION.CONFIRM);
		assert.equal(edit?.color, "caution");
		assert.deepEqual(edit?.settingsTools, [
			"lint",
			"test",
			"coverage",
			"format",
		]);
		for (const tool of [
			"read_chunk",
			"write",
			"edit_chunk",
			"lint",
			"test",
			"coverage",
			"format",
		]) {
			assert.ok(edit?.tools.includes(tool), `edit tools include ${tool}`);
		}
	});

	it("creates new project focuses with safe defaults", () => {
		const cwd = testProjectCwd({
			toolSets: { verify: ["lint", "test"] },
			focuses: {
				ci: {
					description: "Run CI checks",
					prompt: "Use CI tools only.",
					toolSets: ["verify"],
					exitMode: FOCUS_EXIT_MODE.EXPLICIT,
					color: "positive",
				},
			},
		});

		const { registry, warnings } = loadFocusRegistry(cwd);
		const ci = registry.get("ci");

		assert.deepEqual(warnings, []);
		assert.equal(ci?.transition, FOCUS_TRANSITION.CONFIRM);
		assert.equal(ci?.exitMode, FOCUS_EXIT_MODE.EXPLICIT);
		assert.equal(ci?.color, "positive");
		assert.deepEqual(ci?.tools, ["lint", "test"]);
		assert.deepEqual(ci?.settingsTools, ["lint", "test"]);
	});

	it("reports invalid project focus settings without dropping base focuses", () => {
		const cwd = testProjectCwd({
			toolSets: {
				bad_cycle_a: ["bad_cycle_b"],
				bad_cycle_b: ["bad_cycle_a"],
				Invalid: ["lint"],
			},
			focuses: {
				needs_prompt: {
					description: "Missing prompt",
					tools: ["lint"],
				},
				bad_tools: {
					description: "Bad tools",
					prompt: "Bad tools",
					tools: [""],
				},
				cycle: {
					description: "Cycle",
					prompt: "Cycle",
					toolSets: ["bad_cycle_a"],
				},
				unknown: {
					description: "Unknown",
					prompt: "Unknown",
					toolSets: ["missing"],
				},
			},
		});

		const { registry, warnings } = loadFocusRegistry(cwd);

		assert.ok(registry.get("edit"));
		assert.equal(registry.get("needs_prompt"), undefined);
		assert.equal(registry.get("bad_tools"), undefined);
		assert.equal(registry.get("cycle"), undefined);
		assert.equal(registry.get("unknown"), undefined);
		assert.equal(warnings.length, 5);
		assert.match(warnings.join("\n"), /Invalid toolSet name 'Invalid'/u);
		assert.match(warnings.join("\n"), /needs_prompt\.prompt is required/u);
		assert.match(warnings.join("\n"), /bad_tools\.tools\[0\]/u);
		assert.match(warnings.join("\n"), /Circular toolSet reference/u);
		assert.match(warnings.join("\n"), /Unknown toolSet 'missing'/u);
	});

	it("can skip project settings and interactive-only focuses", () => {
		const cwd = testProjectCwd({
			focuses: {
				ci: {
					description: "Run CI checks",
					prompt: "Use CI tools only.",
					tools: ["lint"],
				},
			},
		});

		const { registry } = loadFocusRegistry(cwd, {
			includeProject: false,
			includeInteractive: false,
		});

		assert.equal(registry.get("ci"), undefined);
		assert.equal(registry.get("interview"), undefined);
		assert.equal(registry.get("edit")?.name, "edit");
	});

	it("searches non-manual focuses by name and description", () => {
		const cwd = testProjectCwd({
			focuses: {
				ci: {
					description: "Run project pipeline verification",
					prompt: "Use CI tools only.",
					tools: ["lint"],
				},
			},
		});
		const { registry } = loadFocusRegistry(cwd);

		assert.deepEqual(
			registry.search("pipeline").map((focus) => focus.name),
			["ci"],
		);
		assert.equal(
			registry.search().some((focus) => focus.name === "yolo"),
			false,
		);
	});
});
