import { type TSchema, Type } from "typebox";
import type {
	ProjectParameterConfig,
	ProjectScalarParameterType,
} from "./types";

function createScalarParameterSchema(
	type: ProjectScalarParameterType,
	options: { description: string } | undefined,
): TSchema {
	if (type === "string") return Type.String(options);
	if (type === "number") return Type.Number(options);
	return Type.Boolean(options);
}

function createParameterSchema(parameter: ProjectParameterConfig): TSchema {
	const options = parameter.description
		? { description: parameter.description }
		: undefined;
	if (parameter.type === "array") {
		return Type.Array(
			createScalarParameterSchema(parameter.items.type, undefined),
			options,
		);
	}
	return createScalarParameterSchema(parameter.type, options);
}

export function buildParameterSchema(
	parameters: Readonly<Record<string, ProjectParameterConfig>>,
): TSchema {
	const properties: Record<string, TSchema> = {};
	for (const [name, parameter] of Object.entries(parameters)) {
		const schema = createParameterSchema(parameter);
		properties[name] = parameter.required ? schema : Type.Optional(schema);
	}
	return Type.Object(properties, { additionalProperties: false });
}
