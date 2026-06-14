import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
	type ExtensionContext,
	ProjectTrustStore,
	getAgentDir,
} from "@earendil-works/pi-coding-agent";

export const PROJECT_USER_SETTINGS_RELATIVE_PATH = ".pi/settings.user.json";

const TRUST_REQUIRING_PROJECT_CONFIG_RESOURCES = [
	"settings.json",
	"extensions",
	"skills",
	"prompts",
	"themes",
	"SYSTEM.md",
	"APPEND_SYSTEM.md",
] as const;

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

function hasSavedTrust(cwd: string): boolean {
	try {
		return new ProjectTrustStore(getAgentDir()).get(cwd) === true;
	} catch {
		return false;
	}
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

	const configDir = join(currentDir, ".pi");
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

export function isProjectUserSettingsTrusted(ctx: ExtensionContext): boolean {
	if (!hasProjectUserSettings(ctx.cwd)) return true;
	if (!ctx.isProjectTrusted()) return false;

	const cliTrustOverride = hasCliTrustOverride();
	if (cliTrustOverride !== undefined) return cliTrustOverride;

	// When Pi's own trust gate fired for standard project resources, ctx captures
	// saved, temporary, and UI decisions. `.pi/settings.user.json` is a user
	// extension convention, so a settings.user-only project needs an explicit
	// saved trust decision (or --approve) instead of inheriting Pi's default true.
	if (hasStandardTrustRequiringProjectResources(ctx.cwd)) return true;
	return hasSavedTrust(ctx.cwd);
}
