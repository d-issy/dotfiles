import { describe, expect, it } from "vitest";
import {
	jsonValues,
	parseCandidates,
} from "../../apps/command-library/src/candidates";
import type { Variable } from "../../apps/command-library/src/library";

function variable(overrides: Partial<Variable>): Variable {
	return {
		command: "cmd",
		values: [],
		json: null,
		separator: null,
		match: null,
		replace: [],
		unique: false,
		sort: false,
		column: null,
		headers: 0,
		delimiter: null,
		multi: false,
		selectOne: true,
		...overrides,
	};
}

describe("parseCandidates", () => {
	it("splits lines and drops blanks by default", () => {
		expect(parseCandidates(variable({}), "a\n\nb\r\n").values).toEqual([
			"a",
			"b",
		]);
	});

	it("uses static values without output", () => {
		expect(
			parseCandidates(variable({ command: null, values: ["0", "9"] }), "")
				.values,
		).toEqual(["0", "9"]);
	});

	it("splits on a custom separator (just --summary)", () => {
		expect(
			parseCandidates(variable({ separator: "\\s+" }), "build test lint\n")
				.values,
		).toEqual(["build", "test", "lint"]);
	});

	it("keeps the first capture of matching lines, unique and sorted (make -qp)", () => {
		const output = [
			"# comment",
			"test: build",
			"build:",
			"CC := gcc",
			".PHONY: build",
			"build: deps",
		].join("\n");
		expect(
			parseCandidates(
				variable({
					match: "^([a-z0-9][^:\\s]*)\\s*:([^=]|$)",
					unique: true,
					sort: true,
				}),
				output,
			).values,
		).toEqual(["build", "test"]);
	});

	it("rewrites values with replacements (python modules)", () => {
		expect(
			parseCandidates(
				variable({
					match: "^(.*)\\.py$",
					replace: [{ from: "/", to: "." }],
				}),
				"pkg/sub/mod.py\nmain.py\nREADME.md\n",
			).values,
		).toEqual(["pkg.sub.mod", "main"]);
	});

	it("separates header lines before transforming", () => {
		const result = parseCandidates(
			variable({ headers: 1, match: "^(\\w+)" }),
			"CONTAINER ID   IMAGE\nabc   nginx\n",
		);
		expect(result.headers).toEqual(["CONTAINER ID   IMAGE"]);
		expect(result.values).toEqual(["abc"]);
	});

	it("reads values from JSON output", () => {
		expect(
			parseCandidates(
				variable({ json: "changes[].name" }),
				'{"changes":[{"name":"a"},{"name":"b"}]}',
			).values,
		).toEqual(["a", "b"]);
		expect(
			parseCandidates(variable({ json: "changes[].name" }), "not json").values,
		).toEqual([]);
	});
});

describe("jsonValues", () => {
	it("walks keys and arrays", () => {
		const data = { a: { b: [1, 2] }, list: [{ x: "p" }, { y: "q" }] };
		expect(jsonValues(data, "a.b[]")).toEqual(["1", "2"]);
		expect(jsonValues(data, "list[].x")).toEqual(["p"]);
		expect(jsonValues([3, 4], "[]")).toEqual(["3", "4"]);
		expect(jsonValues(data, "missing[].x")).toEqual([]);
	});
});
