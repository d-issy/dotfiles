import assert from "node:assert/strict";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import { createTestPiProject } from "./test-support/pi-project";
import {
	ensureProjectUserSettingsTrusted,
	hasProjectUserSettings,
	isProjectUserSettingsTrusted,
	isUserExtensionEnabled,
	loadProjectUserSettings,
} from "#pi-user/lib/project-settings";

function context(
	cwd: string,
	overrides: Partial<{
		readonly trusted: boolean;
		readonly hasUI: boolean;
		readonly selected: string;
		readonly notifications: string[];
	}> = {},
): ExtensionContext {
	const notifications = overrides.notifications ?? [];
	return {
		cwd,
		hasUI: overrides.hasUI ?? false,
		isProjectTrusted: () => overrides.trusted ?? true,
		ui: {
			select: async () => overrides.selected ?? "Trust (this session only)",
			notify: (message: string) => notifications.push(message),
		},
	} as unknown as ExtensionContext;
}

function withArgv<T>(argv: readonly string[], fn: () => T): T {
	const original = process.argv;
	process.argv = [original[0] ?? "node", original[1] ?? "pi", ...argv];
	try {
		return fn();
	} finally {
		process.argv = original;
	}
}

describe("project user settings", () => {
	it("loads the project user settings file only when it is a JSON object", () => {
		const missing = createTestPiProject({ includeUserSettings: false }).cwd;
		assert.equal(hasProjectUserSettings(missing), false);
		assert.deepEqual(loadProjectUserSettings(missing), {});

		const valid = createTestPiProject({
			settings: { tools: { test: {} } },
		}).cwd;
		assert.equal(hasProjectUserSettings(valid), true);
		assert.deepEqual(loadProjectUserSettings(valid), { tools: { test: {} } });

		const invalid = createTestPiProject({
			rawSettings: JSON.stringify([]),
		}).cwd;
		assert.throws(
			() => loadProjectUserSettings(invalid),
			/settings\.user\.json must contain a JSON object/u,
		);
	});

	it("disables the user extension only when enabled is false", () => {
		assert.equal(
			isUserExtensionEnabled(
				createTestPiProject({ includeUserSettings: false }).cwd,
			),
			true,
		);
		assert.equal(
			isUserExtensionEnabled(createTestPiProject({ settings: {} }).cwd),
			true,
		);
		assert.equal(
			isUserExtensionEnabled(
				createTestPiProject({ settings: { enabled: true } }).cwd,
			),
			true,
		);
		assert.equal(
			isUserExtensionEnabled(
				createTestPiProject({ settings: { enabled: false } }).cwd,
			),
			false,
		);
		assert.equal(
			isUserExtensionEnabled(createTestPiProject({ rawSettings: "[]" }).cwd),
			true,
		);
	});

	it("requires project trust before considering user settings trusted", () => {
		const cwd = createTestPiProject({ settings: { tools: {} } }).cwd;

		assert.equal(
			isProjectUserSettingsTrusted(context(cwd, { trusted: false })),
			false,
		);
	});

	it("honors CLI trust overrides before saved or session trust", () => {
		const cwd = createTestPiProject({ settings: { tools: {} } }).cwd;

		withArgv(["--approve"], () => {
			assert.equal(isProjectUserSettingsTrusted(context(cwd)), true);
		});
		withArgv(["--no-approve"], () => {
			assert.equal(isProjectUserSettingsTrusted(context(cwd)), false);
		});
		withArgv(["--", "--approve"], () => {
			assert.equal(isProjectUserSettingsTrusted(context(cwd)), false);
		});
	});

	it("records UI session trust decisions for settings.user-only projects", async () => {
		const cwd = createTestPiProject({ settings: { tools: {} } }).cwd;
		const ctx = context(cwd, {
			hasUI: true,
			selected: "Trust (this session only)",
		});

		assert.equal(isProjectUserSettingsTrusted(ctx), false);
		await ensureProjectUserSettingsTrusted(ctx);
		assert.equal(isProjectUserSettingsTrusted(ctx), true);
	});

	it("does not prompt when there is no project user settings file", async () => {
		const cwd = createTestPiProject({ includeUserSettings: false }).cwd;
		let prompted = false;
		const ctx = {
			cwd,
			hasUI: true,
			isProjectTrusted: () => true,
			ui: {
				select: async () => {
					prompted = true;
					return "Trust";
				},
				notify: () => undefined,
			},
		} as unknown as ExtensionContext;

		await ensureProjectUserSettingsTrusted(ctx);

		assert.equal(prompted, false);
		assert.equal(isProjectUserSettingsTrusted(ctx), true);
	});
});
