import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { buildShellCommand } from "./arguments";
import type {
	ProjectToolCommandArgument,
	ResolvedProjectToolCommand,
} from "./types";

function command(
	argumentsConfig: readonly ProjectToolCommandArgument[],
): ResolvedProjectToolCommand {
	return {
		index: 0,
		label: "demo",
		command: "demo",
		arguments: argumentsConfig,
		displayLabel: "demo",
		displayCommand: "demo",
		absoluteCwd: "/repo",
		displayCwd: ".",
	};
}

describe("buildShellCommand", () => {
	it("renders literals, parameters, flags, options, and arrays", () => {
		const rendered = buildShellCommand(
			command([
				{ kind: "literal", value: "run" },
				{ kind: "param", name: "path" },
				{ kind: "flag", flag: "--verbose", when: "verbose" },
				{ kind: "option", option: "--count", name: "count" },
				{ kind: "array", style: "repeat", option: "--tag", name: "tags" },
				{ kind: "array", style: "spread", name: "files" },
				{
					kind: "array",
					style: "join",
					option: "--include",
					name: "include",
					separator: ",",
				},
			]),
			{
				path: "src/main.ts",
				verbose: true,
				count: 3,
				tags: ["unit", "fast"],
				files: ["a.ts", "b.ts"],
				include: ["*.ts", "*.json"],
			},
		);

		assert.equal(
			rendered,
			"'demo' 'run' 'src/main.ts' '--verbose' '--count' '3' '--tag' 'unit' '--tag' 'fast' 'a.ts' 'b.ts' '--include' '*.ts,*.json'",
		);
	});

	it("omits unset optional arguments and false flags", () => {
		assert.equal(
			buildShellCommand(
				command([
					{ kind: "param", name: "path" },
					{ kind: "flag", flag: "--verbose", when: "verbose" },
					{ kind: "array", style: "spread", name: "files" },
				]),
				{ verbose: false, files: [] },
			),
			"'demo'",
		);
	});

	it("quotes empty strings and single quotes safely", () => {
		assert.equal(
			buildShellCommand(command([{ kind: "param", name: "message" }]), {
				message: "it's ok",
			}),
			"'demo' 'it'\\''s ok'",
		);
		assert.equal(
			buildShellCommand(command([{ kind: "param", name: "message" }]), {
				message: "",
			}),
			"'demo' ''",
		);
	});

	it("rejects incompatible parameter shapes", () => {
		assert.throws(
			() =>
				buildShellCommand(command([{ kind: "param", name: "path" }]), {
					path: ["a", "b"],
				}),
			/Parameter 'path' must be a scalar value/u,
		);
		assert.throws(
			() =>
				buildShellCommand(
					command([{ kind: "array", style: "spread", name: "paths" }]),
					{ paths: "a" },
				),
			/Parameter 'paths' must be an array value/u,
		);
		assert.throws(
			() =>
				buildShellCommand(command([{ kind: "param", name: "count" }]), {
					count: Number.POSITIVE_INFINITY,
				}),
			/finite numbers/u,
		);
	});
});
