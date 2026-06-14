import type {
	ProjectArrayArgumentStyle,
	ProjectArrayItemType,
	ProjectParameterConfig,
	ProjectScalarParameterType,
	ProjectToolCommandArgument,
	ProjectToolCommandConfig,
	ProjectToolConfig,
	ProjectToolExecutionMode,
} from "./types";
import { isObject } from "./utils";

const TOOL_NAME_RE = /^[a-z][a-z0-9_-]*$/u;
const PARAMETER_NAME_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/u;
const PARAMETER_PLACEHOLDER_RE = /^\{\{([A-Za-z_][A-Za-z0-9_-]*)\}\}$/u;

function normalizeExecutionMode(
	value: unknown,
	path: string,
): ProjectToolExecutionMode | undefined {
	if (value === undefined) return undefined;
	if (value === "sequential" || value === "parallel") return value;
	throw new Error(`${path} must be sequential or parallel.`);
}

function normalizeTimeout(value: unknown, path: string): number | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		throw new Error(`${path} must be a positive number of seconds.`);
	}
	return value;
}

function normalizeOptionalString(
	value: unknown,
	path: string,
): string | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error(`${path} must be a non-empty string.`);
	}
	return value;
}

function isScalarParameterType(
	value: unknown,
): value is ProjectScalarParameterType {
	return value === "string" || value === "number" || value === "boolean";
}

function parseArrayParameterType(
	value: unknown,
): ProjectArrayItemType | undefined {
	if (value === "string[]") return "string";
	if (value === "number[]") return "number";
	if (value === "boolean[]") return "boolean";
	return undefined;
}

function normalizeParameter(
	name: string,
	value: unknown,
	path: string,
): ProjectParameterConfig {
	if (!PARAMETER_NAME_RE.test(name)) {
		throw new Error(
			`${path} has invalid parameter name '${name}'. Use letters, numbers, '_' and '-'.`,
		);
	}
	if (!isObject(value)) throw new Error(`${path}.${name} must be an object.`);
	const shorthandArrayItemType = parseArrayParameterType(value.type);
	if (
		!isScalarParameterType(value.type) &&
		value.type !== "array" &&
		shorthandArrayItemType === undefined
	) {
		throw new Error(
			`${path}.${name}.type must be string, number, boolean, array, string[], number[], or boolean[].`,
		);
	}
	if (value.required !== undefined && typeof value.required !== "boolean") {
		throw new Error(`${path}.${name}.required must be a boolean.`);
	}
	const common = {
		description: normalizeOptionalString(
			value.description,
			`${path}.${name}.description`,
		),
		required: value.required ?? false,
	};
	if (isScalarParameterType(value.type)) return { type: value.type, ...common };
	if (shorthandArrayItemType !== undefined) {
		return {
			type: "array",
			items: { type: shorthandArrayItemType },
			...common,
		};
	}

	if (!isObject(value.items)) {
		throw new Error(`${path}.${name}.items must be an object.`);
	}
	if (!isScalarParameterType(value.items.type)) {
		throw new Error(
			`${path}.${name}.items.type must be string, number, or boolean.`,
		);
	}
	return {
		type: "array",
		items: { type: value.items.type },
		...common,
	};
}

function normalizeParameters(
	value: unknown,
	path: string,
): Record<string, ProjectParameterConfig> {
	if (value === undefined) return {};
	if (!isObject(value)) throw new Error(`${path} must be an object.`);

	const parameters: Record<string, ProjectParameterConfig> = {};
	for (const [name, config] of Object.entries(value)) {
		parameters[name] = normalizeParameter(name, config, path);
	}
	return parameters;
}

function getParameter(
	parameters: Readonly<Record<string, ProjectParameterConfig>>,
	name: string,
	path: string,
): ProjectParameterConfig {
	const parameter = parameters[name];
	if (!parameter)
		throw new Error(`${path} references unknown parameter '${name}'.`);
	return parameter;
}

function parseOptionalParameterPlaceholder(
	value: string,
	path: string,
): string | undefined {
	const match = PARAMETER_PLACEHOLDER_RE.exec(value);
	if (match) return match[1];
	if (value.includes("{{") || value.includes("}}")) {
		throw new Error(
			`${path} parameter references must be the whole argument, like "{{name}}".`,
		);
	}
	return undefined;
}

function parseRequiredParameterPlaceholder(
	value: string,
	path: string,
): string {
	const name = parseOptionalParameterPlaceholder(value, path);
	if (!name)
		throw new Error(`${path} must be a parameter reference like "{{name}}".`);
	return name;
}

function normalizeArrayArgumentStyle(
	value: unknown,
	path: string,
): ProjectArrayArgumentStyle {
	if (value === "repeat" || value === "spread" || value === "join") {
		return value;
	}
	throw new Error(`${path} must be repeat, spread, or join.`);
}

function normalizeArgument(
	value: unknown,
	path: string,
	parameters: Readonly<Record<string, ProjectParameterConfig>>,
): ProjectToolCommandArgument {
	if (typeof value === "string") {
		const name = parseOptionalParameterPlaceholder(value, path);
		if (!name) return { kind: "literal", value };
		const parameter = getParameter(parameters, name, path);
		if (parameter.type === "array") {
			throw new Error(
				`${path} references array parameter '${name}'. Use an object with values and style.`,
			);
		}
		return { kind: "param", name };
	}

	if (!isObject(value)) {
		throw new Error(
			`${path} must be a string, a flag object, an option object, or an array values object.`,
		);
	}

	const hasFlag = "flag" in value;
	const hasOption = "option" in value;
	const hasValue = "value" in value;
	const hasValues = "values" in value;
	if (hasFlag && (hasOption || hasValue || hasValues)) {
		throw new Error(
			`${path} flag arguments cannot contain option, value, or values.`,
		);
	}
	if (hasValue && hasValues) {
		throw new Error(`${path} cannot contain both value and values.`);
	}

	if (hasFlag) {
		const flag = normalizeOptionalString(value.flag, `${path}.flag`);
		if (!flag) throw new Error(`${path}.flag is required.`);
		const when = normalizeOptionalString(value.when, `${path}.when`);
		if (!when) throw new Error(`${path}.when is required.`);
		const parameter = getParameter(parameters, when, `${path}.when`);
		if (parameter.type !== "boolean") {
			throw new Error(`${path}.when must reference a boolean parameter.`);
		}
		return { kind: "flag", flag, when };
	}

	if (hasValues) {
		const valuesReference = normalizeOptionalString(
			value.values,
			`${path}.values`,
		);
		if (!valuesReference) throw new Error(`${path}.values is required.`);
		const name = parseRequiredParameterPlaceholder(
			valuesReference,
			`${path}.values`,
		);
		const parameter = getParameter(parameters, name, `${path}.values`);
		if (parameter.type !== "array") {
			throw new Error(`${path}.values must reference an array parameter.`);
		}
		const style = normalizeArrayArgumentStyle(value.style, `${path}.style`);
		const option = hasOption
			? normalizeOptionalString(value.option, `${path}.option`)
			: undefined;
		if (hasOption && !option) throw new Error(`${path}.option is required.`);

		if (style === "repeat") {
			if (!option)
				throw new Error(`${path}.option is required for repeat style.`);
			return { kind: "array", style, option, name };
		}
		if (style === "spread") {
			if (option)
				throw new Error(`${path}.option is not allowed for spread style.`);
			return { kind: "array", style, name };
		}

		const separator = normalizeOptionalString(
			value.separator,
			`${path}.separator`,
		);
		if (!separator)
			throw new Error(`${path}.separator is required for join style.`);
		return option
			? { kind: "array", style, option, name, separator }
			: { kind: "array", style, name, separator };
	}

	if (hasOption) {
		const option = normalizeOptionalString(value.option, `${path}.option`);
		if (!option) throw new Error(`${path}.option is required.`);
		const valueReference = normalizeOptionalString(
			value.value,
			`${path}.value`,
		);
		if (!valueReference) throw new Error(`${path}.value is required.`);
		const name = parseRequiredParameterPlaceholder(
			valueReference,
			`${path}.value`,
		);
		const parameter = getParameter(parameters, name, `${path}.value`);
		if (parameter.type === "boolean" || parameter.type === "array") {
			throw new Error(
				`${path}.value must reference a string or number parameter.`,
			);
		}
		return { kind: "option", option, name };
	}

	throw new Error(`${path} must contain flag, option, or values.`);
}

function normalizeCommand(
	value: unknown,
	path: string,
	parameters: Readonly<Record<string, ProjectParameterConfig>>,
): ProjectToolCommandConfig {
	if (!isObject(value)) throw new Error(`${path} must be an object.`);
	const command = normalizeOptionalString(value.command, `${path}.command`);
	if (!command) throw new Error(`${path}.command is required.`);
	if (/\s/u.test(command)) {
		throw new Error(
			`${path}.command must be a single executable token. Put subcommands and flags in arguments.`,
		);
	}
	if (value.arguments !== undefined && !Array.isArray(value.arguments)) {
		throw new Error(`${path}.arguments must be an array.`);
	}
	return {
		command,
		arguments: (value.arguments ?? []).map((argument, index) =>
			normalizeArgument(argument, `${path}.arguments[${index}]`, parameters),
		),
		label: normalizeOptionalString(value.label, `${path}.label`),
		cwd: normalizeOptionalString(value.cwd, `${path}.cwd`),
		timeoutSeconds: normalizeTimeout(
			value.timeoutSeconds,
			`${path}.timeoutSeconds`,
		),
	};
}

export function normalizeTool(name: string, value: unknown): ProjectToolConfig {
	if (!TOOL_NAME_RE.test(name)) {
		throw new Error(
			`Invalid tool name: ${name}. Use lowercase letters, numbers, '_' and '-'.`,
		);
	}
	if (!isObject(value)) throw new Error(`${name} must be an object.`);

	const description = normalizeOptionalString(
		value.description,
		`${name}.description`,
	);
	if (!description) throw new Error(`${name}.description is required.`);

	if (!Array.isArray(value.commands) || value.commands.length === 0) {
		throw new Error(
			`${name}.commands is required and must be a non-empty array.`,
		);
	}

	const parameters = normalizeParameters(
		value.parameters,
		`${name}.parameters`,
	);

	const promptGuidelines = value.promptGuidelines;
	if (promptGuidelines !== undefined) {
		if (
			!Array.isArray(promptGuidelines) ||
			!promptGuidelines.every(
				(item) => typeof item === "string" && item.trim() !== "",
			)
		) {
			throw new Error(
				`${name}.promptGuidelines must be an array of non-empty strings.`,
			);
		}
	}

	return {
		name,
		description,
		parameters,
		executionMode: normalizeExecutionMode(
			value.executionMode,
			`${name}.executionMode`,
		),
		cwd: normalizeOptionalString(value.cwd, `${name}.cwd`),
		timeoutSeconds: normalizeTimeout(
			value.timeoutSeconds,
			`${name}.timeoutSeconds`,
		),
		promptSnippet: normalizeOptionalString(
			value.promptSnippet,
			`${name}.promptSnippet`,
		),
		promptGuidelines,
		commands: value.commands.map((command, index) =>
			normalizeCommand(command, `${name}.commands[${index}]`, parameters),
		),
	};
}
