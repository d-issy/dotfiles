import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { buildParameterSchema } from "./schema";

type ObjectSchema = {
	readonly type?: string;
	readonly additionalProperties?: boolean;
	readonly required?: readonly string[];
	readonly properties?: Record<
		string,
		{
			readonly type?: string;
			readonly description?: string;
			readonly items?: { readonly type?: string };
		}
	>;
};

describe("buildParameterSchema", () => {
	it("builds a closed object schema with required and optional parameters", () => {
		const schema = buildParameterSchema({
			path: {
				type: "string",
				description: "Path to check",
				required: true,
			},
			count: { type: "number", required: false },
			verbose: { type: "boolean", required: false },
			tags: {
				type: "array",
				items: { type: "string" },
				description: "Tags to include",
				required: false,
			},
		}) as ObjectSchema;

		assert.equal(schema.type, "object");
		assert.equal(schema.additionalProperties, false);
		assert.deepEqual(schema.required, ["path"]);
		assert.equal(schema.properties?.path?.type, "string");
		assert.equal(schema.properties?.path?.description, "Path to check");
		assert.equal(schema.properties?.count?.type, "number");
		assert.equal(schema.properties?.verbose?.type, "boolean");
		assert.equal(schema.properties?.tags?.type, "array");
		assert.equal(schema.properties?.tags?.description, "Tags to include");
		assert.equal(schema.properties?.tags?.items?.type, "string");
	});

	it("omits required when all parameters are optional", () => {
		const schema = buildParameterSchema({
			force: { type: "boolean", required: false },
		}) as ObjectSchema;

		assert.equal(schema.required, undefined);
	});
});
