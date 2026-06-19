import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
	CONFIG_DIR_NAME,
	type ExtensionContext,
	ProjectTrustStore,
	getAgentDir,
} from "@earendil-works/pi-coding-agent";

export const PROJECT_USER_SETTINGS_RELATIVE_PATH = join(
	CONFIG_DIR_NAME,
	"settings.user.json",
);

export type ProjectUserSettings = Record<string, unknown>;

const TRUST_REQUIRING_PROJECT_CONFIG_RESOURCES = [
	"settings.json",
	"extensions",
	"skills",
	"prompts",
	"themes",
	"SYSTEM.md",
	"APPEND_SYSTEM.md",
] as const;

const sessionProjectUserSettingsTrust = new Map<string, boolean>();

function hasCliTrustOverride(
	argv: readonly string[] = process.argv.slice(2),
): boolean | undefined {
	let override: boolean | undefined;
	for (const arg of argv) {
		if (arg === "--") break;
		if (arg === "--approve" || arg === "-a") override = true;
		if (arg === "--no-approve" || arg === "-na") override = false;
	}
	return override;
}

function getSavedTrust(cwd: string): boolean | null {
	try {
		return new ProjectTrustStore(getAgentDir()).get(cwd);
	} catch {
		return null;
	}
}

function saveTrust(cwd: string, trusted: boolean): string | undefined {
	try {
		new ProjectTrustStore(getAgentDir()).set(cwd, trusted);
		return undefined;
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

function getSessionTrust(cwd: string): boolean | undefined {
	return sessionProjectUserSettingsTrust.get(canonicalize(cwd));
}

function setSessionTrust(cwd: string, trusted: boolean): void {
	sessionProjectUserSettingsTrust.set(canonicalize(cwd), trusted);
}

function canonicalize(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return resolve(path);
	}
}

function hasStandardTrustRequiringProjectResources(cwd: string): boolean {
	const homeDir = canonicalize(process.env.HOME || homedir());
	const userAgentsSkillsDir = join(homeDir, ".agents", "skills");
	let currentDir = canonicalize(cwd);

	const configDir = join(currentDir, CONFIG_DIR_NAME);
	if (
		TRUST_REQUIRING_PROJECT_CONFIG_RESOURCES.some((entry) =>
			existsSync(join(configDir, entry)),
		)
	) {
		return true;
	}

	while (true) {
		const agentsSkillsDir = join(currentDir, ".agents", "skills");
		if (
			agentsSkillsDir !== userAgentsSkillsDir &&
			existsSync(agentsSkillsDir)
		) {
			return true;
		}

		const parentDir = dirname(currentDir);
		if (parentDir === currentDir) return false;
		currentDir = parentDir;
	}
}

export function hasProjectUserSettings(cwd: string): boolean {
	return existsSync(join(cwd, PROJECT_USER_SETTINGS_RELATIVE_PATH));
}

export function loadProjectUserSettings(cwd: string): ProjectUserSettings {
	const path = join(cwd, PROJECT_USER_SETTINGS_RELATIVE_PATH);
	if (!existsSync(path)) return {};

	const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error(
			`${PROJECT_USER_SETTINGS_RELATIVE_PATH} must contain a JSON object.`,
		);
	}
	return parsed as ProjectUserSettings;
}

function formatProjectUserSettingsTrustPrompt(cwd: string): string {
	return `Trust project user settings?\n${cwd}\n\nThis allows the user extension to load ${PROJECT_USER_SETTINGS_RELATIVE_PATH} and enable project-defined tools. Project tools are repository-controlled commands.`;
}

export async function ensureProjectUserSettingsTrusted(
	ctx: ExtensionContext,
): Promise<void> {
	if (!hasProjectUserSettings(ctx.cwd)) return;
	if (!ctx.isProjectTrusted()) return;
	if (hasStandardTrustRequiringProjectResources(ctx.cwd)) return;
	if (hasCliTrustOverride() !== undefined) return;
	if (getSessionTrust(ctx.cwd) !== undefined) return;
	if (getSavedTrust(ctx.cwd) !== null) return;
	if (!ctx.hasUI) return;

	const trustOption = "Trust";
	const trustSessionOption = "Trust (this session only)";
	const doNotTrustOption = "Do not trust";
	const doNotTrustSessionOption = "Do not trust (this session only)";
	const selected = await ctx.ui.select(
		formatProjectUserSettingsTrustPrompt(ctx.cwd),
		[
			trustOption,
			trustSessionOption,
			doNotTrustOption,
			doNotTrustSessionOption,
		],
	);

	const applySavedTrust = (trusted: boolean): void => {
		const error = saveTrust(ctx.cwd, trusted);
		if (!error) return;
		setSessionTrust(ctx.cwd, trusted);
		ctx.ui.notify(
			`Failed to save project trust decision; applying it for this session only: ${error}`,
			"warning",
		);
	};

	switch (selected) {
		case trustOption:
			applySavedTrust(true);
			break;
		case trustSessionOption:
			setSessionTrust(ctx.cwd, true);
			break;
		case doNotTrustOption:
			applySavedTrust(false);
			break;
		case doNotTrustSessionOption:
			setSessionTrust(ctx.cwd, false);
			break;
		default:
			setSessionTrust(ctx.cwd, false);
	}
}

export function isProjectUserSettingsTrusted(ctx: ExtensionContext): boolean {
	if (!hasProjectUserSettings(ctx.cwd)) return true;
	if (!ctx.isProjectTrusted()) return false;

	const cliTrustOverride = hasCliTrustOverride();
	if (cliTrustOverride !== undefined) return cliTrustOverride;

	// When Pi's own trust gate fired for standard project resources, ctx captures
	// saved, temporary, and UI decisions. The project user settings file is a user
	// extension convention, so a settings.user-only project needs an explicit
	// saved or session trust decision (or --approve) instead of inheriting Pi's
	// default true.
	if (hasStandardTrustRequiringProjectResources(ctx.cwd)) return true;

	const sessionTrust = getSessionTrust(ctx.cwd);
	if (sessionTrust !== undefined) return sessionTrust;
	return getSavedTrust(ctx.cwd) === true;
}
