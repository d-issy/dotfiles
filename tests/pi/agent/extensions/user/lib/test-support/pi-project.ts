import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { PROJECT_USER_SETTINGS_RELATIVE_PATH } from "#pi-user/lib/project-settings";

export type TestPiProject = {
	readonly cwd: string;
	readonly userSettingsPath: string;
	readonly notifications: string[];
};

export function createTestPiProject(options?: {
	readonly settings?: Record<string, unknown>;
	readonly rawSettings?: string;
	readonly includeUserSettings?: boolean;
	readonly includeStandardPiConfig?: boolean;
}): TestPiProject {
	const cwd = join(tmpdir(), `pi-user-extension-test-${randomUUID()}`);
	const userSettingsPath = join(cwd, PROJECT_USER_SETTINGS_RELATIVE_PATH);
	const notifications: string[] = [];
	mkdirSync(cwd, { recursive: true });

	if (options?.includeStandardPiConfig) {
		writeProjectFile(cwd, join(CONFIG_DIR_NAME, "settings.json"), "{}\n");
	}

	const shouldWriteUserSettings = options?.includeUserSettings ?? true;
	if (shouldWriteUserSettings) {
		writeProjectFile(
			cwd,
			PROJECT_USER_SETTINGS_RELATIVE_PATH,
			options?.rawSettings ??
				JSON.stringify(options?.settings ?? {}, undefined, 2),
		);
	}

	return { cwd, userSettingsPath, notifications };
}

export function readTestPiProjectUserSettings(
	project: TestPiProject,
): Record<string, unknown> {
	return JSON.parse(readFileSync(project.userSettingsPath, "utf8")) as Record<
		string,
		unknown
	>;
}

function writeProjectFile(cwd: string, path: string, content: string): void {
	const absolutePath = join(cwd, path);
	mkdirSync(dirname(absolutePath), { recursive: true });
	writeFileSync(absolutePath, content);
}
