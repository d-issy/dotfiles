import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ColorRole } from "../theme";
import { colors } from "../theme";
import {
	BASE_FOCUS_DEFINITIONS,
	DEFAULT_FOCUS,
	type FocusDefinition,
	type FocusName,
	type FocusTransition,
	WILDCARD_TOOL,
	isFocusTransition,
} from "./definitions";

const PROJECT_SETTINGS_RELATIVE_PATH = ".pi/settings.user.json";
const FOCUS_NAME_RE = /^[a-z][a-z0-9_-]*$/u;

export type FocusRegistry = {
	get(name: FocusName): FocusDefinition | undefined;
	list(): readonly FocusDefinition[];
	search(query?: string): readonly FocusDefinition[];
	manual(): readonly FocusDefinition[];
};

export type ProjectFocusLoadResult = {
	readonly registry: FocusRegistry;
	readonly warnings: readonly string[];
};

export type FocusRegistryLoadOptions = {
	readonly includeProject?: boolean;
};

type ProjectSettings = {
	focuses?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isColorRole(value: unknown): value is ColorRole {
	return typeof value === "string" && value in colors;
}

function unique(values: readonly string[]): string[] {
	return [...new Set(values)];
}

function normalizeString(value: unknown, path: string): string | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error(`${path} must be a non-empty string.`);
	}
	return value;
}

function normalizeTools(
	value: unknown,
	path: string,
): readonly string[] | undefined {
	if (value === undefined) return undefined;
	if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
	const tools = value.map((tool, index) => {
		if (typeof tool !== "string" || tool.trim() === "") {
			throw new Error(`${path}[${index}] must be a non-empty string.`);
		}
		return tool;
	});
	return unique(tools);
}

function normalizeTransition(
	value: unknown,
	path: string,
): FocusTransition | undefined {
	if (value === undefined) return undefined;
	if (!isFocusTransition(value)) {
		throw new Error(`${path} must be auto, confirm, or manual.`);
	}
	return value;
}

function normalizeColor(value: unknown, path: string): ColorRole | undefined {
	if (value === undefined) return undefined;
	if (!isColorRole(value)) {
		throw new Error(
			`${path} must be one of: ${Object.keys(colors).join(", ")}.`,
		);
	}
	return value;
}

function normalizeProjectFocus(
	name: string,
	value: unknown,
): Partial<FocusDefinition> {
	if (!FOCUS_NAME_RE.test(name)) {
		throw new Error(
			`Invalid focus name '${name}'. Use lowercase letters, numbers, '_' and '-'.`,
		);
	}
	if (!isObject(value)) throw new Error(`${name} must be an object.`);

	return {
		name,
		description: normalizeString(value.description, `${name}.description`),
		prompt: normalizeString(value.prompt, `${name}.prompt`),
		tools: normalizeTools(value.tools, `${name}.tools`),
		transition: normalizeTransition(value.transition, `${name}.transition`),
		color: normalizeColor(value.color, `${name}.color`),
		pathPolicy: value.pathPolicy,
		bashPolicy: value.bashPolicy,
		model: value.model,
		thinkingLevel: value.thinkingLevel,
	};
}

function mergeFocus(
	base: FocusDefinition,
	project: Partial<FocusDefinition>,
): FocusDefinition {
	return {
		...base,
		description: project.description ?? base.description,
		prompt: project.prompt
			? `${base.prompt}\n\n${project.prompt}`
			: base.prompt,
		tools: unique([...(base.tools ?? []), ...(project.tools ?? [])]),
		// Existing focus transitions are security-sensitive and cannot be changed by project config.
		transition: base.transition,
		color: project.color ?? base.color,
		pathPolicy: project.pathPolicy ?? base.pathPolicy,
		bashPolicy: project.bashPolicy ?? base.bashPolicy,
		model: project.model ?? base.model,
		thinkingLevel: project.thinkingLevel ?? base.thinkingLevel,
	};
}

function createProjectFocus(
	project: Partial<FocusDefinition>,
): FocusDefinition {
	if (!project.name) throw new Error("Project focus name is required.");
	if (!project.description) {
		throw new Error(`${project.name}.description is required for new focuses.`);
	}
	if (!project.prompt) {
		throw new Error(`${project.name}.prompt is required for new focuses.`);
	}
	if (!project.tools || project.tools.length === 0) {
		throw new Error(`${project.name}.tools is required for new focuses.`);
	}
	return {
		name: project.name,
		description: project.description,
		prompt: project.prompt,
		tools: unique(project.tools),
		transition: project.transition ?? "confirm",
		color: project.color,
		pathPolicy: project.pathPolicy,
		bashPolicy: project.bashPolicy,
		model: project.model,
		thinkingLevel: project.thinkingLevel,
	};
}

function loadProjectSettings(cwd: string): ProjectSettings {
	const path = join(cwd, PROJECT_SETTINGS_RELATIVE_PATH);
	if (!existsSync(path)) return {};
	const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
	if (!isObject(parsed)) {
		throw new Error(
			`${PROJECT_SETTINGS_RELATIVE_PATH} must contain a JSON object.`,
		);
	}
	return parsed as ProjectSettings;
}

function createRegistry(focuses: readonly FocusDefinition[]): FocusRegistry {
	const byName = new Map(focuses.map((focus) => [focus.name, focus]));
	return {
		get: (name) => (name === DEFAULT_FOCUS ? undefined : byName.get(name)),
		list: () => [...byName.values()],
		manual: () =>
			[...byName.values()].filter((focus) => focus.transition === "manual"),
		search(query) {
			const searchable = [...byName.values()].filter(
				(focus) => focus.transition !== "manual",
			);
			const normalized = query?.trim().toLowerCase();
			if (!normalized) return searchable;
			return searchable.filter(
				(focus) =>
					focus.name.toLowerCase().includes(normalized) ||
					focus.description.toLowerCase().includes(normalized),
			);
		},
	};
}

export function loadFocusRegistry(
	cwd: string,
	options?: FocusRegistryLoadOptions,
): ProjectFocusLoadResult {
	const warnings: string[] = [];
	const focuses = new Map(
		BASE_FOCUS_DEFINITIONS.map((focus) => [focus.name, focus]),
	);

	if (options?.includeProject === false) {
		return { registry: createRegistry([...focuses.values()]), warnings };
	}

	let settings: ProjectSettings;
	try {
		settings = loadProjectSettings(cwd);
	} catch (error) {
		return {
			registry: createRegistry([...focuses.values()]),
			warnings: [
				`Failed to read ${PROJECT_SETTINGS_RELATIVE_PATH} focuses: ${error instanceof Error ? error.message : String(error)}`,
			],
		};
	}

	if (settings.focuses === undefined) {
		return { registry: createRegistry([...focuses.values()]), warnings };
	}
	if (!isObject(settings.focuses)) {
		return {
			registry: createRegistry([...focuses.values()]),
			warnings: ["Project focuses ignored: focuses must be an object."],
		};
	}

	for (const [name, rawFocus] of Object.entries(settings.focuses)) {
		try {
			const projectFocus = normalizeProjectFocus(name, rawFocus);
			const existing = focuses.get(name);
			if (existing) {
				focuses.set(name, mergeFocus(existing, projectFocus));
			} else {
				focuses.set(name, createProjectFocus(projectFocus));
			}
		} catch (error) {
			warnings.push(
				`Project focus '${name}' ignored: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	return { registry: createRegistry([...focuses.values()]), warnings };
}

export { WILDCARD_TOOL };
