import {
	PROJECT_USER_SETTINGS_RELATIVE_PATH,
	loadProjectUserSettings,
} from "../project-settings";
import type { ColorRole } from "../theme";
import { colors } from "../theme";
import {
	BASE_FOCUS,
	BASE_FOCUS_DEFINITIONS,
	BUILT_IN_TOOL_SETS,
	type FocusDefinition,
	type FocusName,
	type FocusTransition,
	isFocusTransition,
} from "./definitions";

const FOCUS_NAME_RE = /^[a-z][a-z0-9_-]*$/u;

export type FocusRegistry = {
	get(name: FocusName): FocusDefinition | undefined;
	list(): readonly FocusDefinition[];
	search(query?: string): readonly FocusDefinition[];
};

export type ProjectFocusLoadResult = {
	readonly registry: FocusRegistry;
	readonly warnings: readonly string[];
};

export type FocusRegistryLoadOptions = {
	readonly includeProject?: boolean;
	readonly includeInteractive?: boolean;
};

type ProjectSettings = {
	toolSets?: unknown;
	focuses?: unknown;
};

type ProjectFocusDefinition = {
	readonly name: FocusName;
	readonly description?: string;
	readonly prompt?: string;
	readonly tools?: readonly string[];
	readonly toolSets?: readonly string[];
	readonly transition?: FocusTransition;
	readonly color?: ColorRole;
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

function assertFocusName(name: string, kind: string): void {
	if (!FOCUS_NAME_RE.test(name)) {
		throw new Error(
			`Invalid ${kind} name '${name}'. Use lowercase letters, numbers, '_' and '-'.`,
		);
	}
}

function normalizeProjectFocus(
	name: string,
	value: unknown,
): ProjectFocusDefinition {
	assertFocusName(name, "focus");
	if (!isObject(value)) throw new Error(`${name} must be an object.`);

	return {
		name,
		description: normalizeString(value.description, `${name}.description`),
		prompt: normalizeString(value.prompt, `${name}.prompt`),
		tools: normalizeTools(value.tools, `${name}.tools`),
		toolSets: normalizeTools(value.toolSets, `${name}.toolSets`),
		transition: normalizeTransition(value.transition, `${name}.transition`),
		color: normalizeColor(value.color, `${name}.color`),
	};
}

function normalizeProjectToolSets(
	value: unknown,
	warnings: string[],
): Map<string, readonly string[]> {
	const toolSets = new Map(BUILT_IN_TOOL_SETS);
	if (value === undefined) return toolSets;
	if (!isObject(value)) {
		warnings.push("Project toolSets ignored: toolSets must be an object.");
		return toolSets;
	}
	for (const [name, rawTools] of Object.entries(value)) {
		try {
			assertFocusName(name, "toolSet");
			toolSets.set(name, normalizeTools(rawTools, `toolSets.${name}`) ?? []);
		} catch (error) {
			warnings.push(
				`Project toolSet '${name}' ignored: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
	return toolSets;
}

function resolveToolSetTools(
	name: string,
	toolSets: ReadonlyMap<string, readonly string[]>,
	stack: readonly string[] = [],
): readonly string[] {
	const tools = toolSets.get(name);
	if (!tools) throw new Error(`Unknown toolSet '${name}'.`);
	if (stack.includes(name)) {
		throw new Error(
			`Circular toolSet reference: ${[...stack, name].join(" -> ")}.`,
		);
	}
	return unique(
		tools.flatMap((tool) =>
			toolSets.has(tool)
				? resolveToolSetTools(tool, toolSets, [...stack, name])
				: [tool],
		),
	);
}

function resolveToolSetListTools(
	toolSetNames: readonly string[] | undefined,
	toolSets: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
	return unique(
		(toolSetNames ?? []).flatMap((toolSetName) =>
			resolveToolSetTools(toolSetName, toolSets),
		),
	);
}

function resolveProjectFocusTools(
	project: ProjectFocusDefinition,
	toolSets: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
	return unique([
		...resolveToolSetListTools(project.toolSets, toolSets),
		...(project.tools ?? []),
	]);
}

function resolveFocusDefinitionTools(
	focus: FocusDefinition,
	toolSets: ReadonlyMap<string, readonly string[]>,
): FocusDefinition {
	return {
		...focus,
		tools: unique([
			...resolveToolSetListTools(focus.toolSets, toolSets),
			...focus.tools,
		]),
	};
}

function finalizeFocuses(
	focuses: readonly FocusDefinition[],
	toolSets: ReadonlyMap<string, readonly string[]>,
	warnings: string[],
): readonly FocusDefinition[] {
	const resolved: FocusDefinition[] = [];
	for (const focus of focuses) {
		try {
			resolved.push(resolveFocusDefinitionTools(focus, toolSets));
		} catch (error) {
			warnings.push(
				`Focus '${focus.name}' ignored: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
	return resolved;
}

function mergeFocus(
	base: FocusDefinition,
	project: ProjectFocusDefinition,
	projectTools: readonly string[],
): FocusDefinition {
	return {
		...base,
		description: project.description ?? base.description,
		prompt: project.prompt
			? `${base.prompt}\n\n${project.prompt}`
			: base.prompt,
		tools: unique([...(base.tools ?? []), ...projectTools]),
		settingsTools: unique([...(base.settingsTools ?? []), ...projectTools]),
		// Existing focus transitions are security-sensitive and cannot be changed by project config.
		transition: base.transition,
		color: project.color ?? base.color,
	};
}

function createProjectFocus(
	project: ProjectFocusDefinition,
	projectTools: readonly string[],
): FocusDefinition {
	if (!project.description) {
		throw new Error(`${project.name}.description is required for new focuses.`);
	}
	if (!project.prompt) {
		throw new Error(`${project.name}.prompt is required for new focuses.`);
	}
	if (projectTools.length === 0) {
		throw new Error(
			`${project.name}.tools or ${project.name}.toolSets is required for new focuses.`,
		);
	}
	return {
		name: project.name,
		description: project.description,
		prompt: project.prompt,
		tools: unique(projectTools),
		settingsTools: unique(projectTools),
		transition: project.transition ?? "confirm",
		color: project.color,
	};
}

function createRegistry(
	focuses: readonly FocusDefinition[],
	toolSets: ReadonlyMap<string, readonly string[]>,
	warnings: string[],
	options?: { readonly includeInteractive?: boolean },
): FocusRegistry {
	const includeInteractive = options?.includeInteractive ?? true;
	const visibleFocuses = includeInteractive
		? focuses
		: focuses.filter((focus) => !focus.interactiveOnly);
	const resolvedFocuses = finalizeFocuses(visibleFocuses, toolSets, warnings);
	const byName = new Map(resolvedFocuses.map((focus) => [focus.name, focus]));
	return {
		get: (name) => (name === BASE_FOCUS ? undefined : byName.get(name)),
		list: () => [...byName.values()],
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
	let toolSets = new Map(BUILT_IN_TOOL_SETS);

	if (options?.includeProject === false) {
		return {
			registry: createRegistry(
				[...focuses.values()],
				toolSets,
				warnings,
				options,
			),
			warnings,
		};
	}

	let settings: ProjectSettings;
	try {
		settings = loadProjectUserSettings(cwd) as ProjectSettings;
	} catch (error) {
		warnings.push(
			`Failed to read ${PROJECT_USER_SETTINGS_RELATIVE_PATH}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return {
			registry: createRegistry(
				[...focuses.values()],
				toolSets,
				warnings,
				options,
			),
			warnings,
		};
	}

	toolSets = normalizeProjectToolSets(settings.toolSets, warnings);

	if (settings.focuses === undefined) {
		return {
			registry: createRegistry(
				[...focuses.values()],
				toolSets,
				warnings,
				options,
			),
			warnings,
		};
	}
	if (!isObject(settings.focuses)) {
		warnings.push("Project focuses ignored: focuses must be an object.");
		return {
			registry: createRegistry(
				[...focuses.values()],
				toolSets,
				warnings,
				options,
			),
			warnings,
		};
	}

	for (const [name, rawFocus] of Object.entries(settings.focuses)) {
		try {
			const projectFocus = normalizeProjectFocus(name, rawFocus);
			const projectTools = resolveProjectFocusTools(projectFocus, toolSets);
			const existing = focuses.get(name);
			if (existing) {
				focuses.set(name, mergeFocus(existing, projectFocus, projectTools));
			} else {
				focuses.set(name, createProjectFocus(projectFocus, projectTools));
			}
		} catch (error) {
			warnings.push(
				`Project focus '${name}' ignored: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	return {
		registry: createRegistry(
			[...focuses.values()],
			toolSets,
			warnings,
			options,
		),
		warnings,
	};
}
