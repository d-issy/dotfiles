import type {
	ProjectArrayParameterValue,
	ProjectParameterValue,
	ProjectScalarParameterValue,
	ProjectToolCommandArgument,
	ProjectToolInput,
	ResolvedProjectToolCommand,
} from "./types";

export function hasParameterValue(
	value: ProjectParameterValue | undefined,
): value is ProjectParameterValue {
	return value !== undefined;
}

function stringifyParameterValue(value: ProjectScalarParameterValue): string {
	if (typeof value === "number" && !Number.isFinite(value)) {
		throw new Error("Parameter values must be finite numbers.");
	}
	return String(value);
}

export function isProjectArrayParameterValue(
	value: ProjectParameterValue,
): value is ProjectArrayParameterValue {
	return Array.isArray(value);
}

function getScalarParameterValue(
	value: ProjectParameterValue | undefined,
	name: string,
): ProjectScalarParameterValue | undefined {
	if (!hasParameterValue(value)) return undefined;
	if (isProjectArrayParameterValue(value)) {
		throw new Error(`Parameter '${name}' must be a scalar value.`);
	}
	return value;
}

function getArrayParameterValue(
	value: ProjectParameterValue | undefined,
	name: string,
): ProjectArrayParameterValue | undefined {
	if (!hasParameterValue(value)) return undefined;
	if (!isProjectArrayParameterValue(value)) {
		throw new Error(`Parameter '${name}' must be an array value.`);
	}
	return value;
}

function renderArrayArgument(
	argument: Extract<ProjectToolCommandArgument, { readonly kind: "array" }>,
	value: ProjectArrayParameterValue,
): string[] {
	if (value.length === 0) return [];
	const values = value.map(stringifyParameterValue);
	if (argument.style === "spread") return values;
	if (argument.style === "repeat") {
		return values.flatMap((item) => [argument.option, item]);
	}
	const joined = values.join(argument.separator);
	return argument.option ? [argument.option, joined] : [joined];
}

function renderCommandArguments(
	argumentsConfig: readonly ProjectToolCommandArgument[],
	params: ProjectToolInput,
): string[] {
	const args: string[] = [];
	for (const argument of argumentsConfig) {
		if (argument.kind === "literal") {
			args.push(argument.value);
			continue;
		}
		if (argument.kind === "param") {
			const value = getScalarParameterValue(
				params[argument.name],
				argument.name,
			);
			if (value !== undefined) args.push(stringifyParameterValue(value));
			continue;
		}
		if (argument.kind === "flag") {
			if (params[argument.when] === true) args.push(argument.flag);
			continue;
		}
		if (argument.kind === "option") {
			const value = getScalarParameterValue(
				params[argument.name],
				argument.name,
			);
			if (value !== undefined) {
				args.push(argument.option, stringifyParameterValue(value));
			}
			continue;
		}

		const value = getArrayParameterValue(params[argument.name], argument.name);
		if (value !== undefined) args.push(...renderArrayArgument(argument, value));
	}
	return args;
}

function shellQuote(value: string): string {
	if (value === "") return "''";
	return `'${value.replace(/'/gu, `'\\''`)}'`;
}

export function buildShellCommand(
	command: ResolvedProjectToolCommand,
	params: ProjectToolInput,
): string {
	return [command.command, ...renderCommandArguments(command.arguments, params)]
		.map(shellQuote)
		.join(" ");
}
