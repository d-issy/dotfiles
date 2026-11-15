import type { Variable } from "./library";

export interface Candidates {
	// Lines shown as a fixed fzf header (e.g. a table heading).
	headers: string[];
	values: string[];
}

// Walks a path such as "changes[].name": "." separates keys and "[]" expands
// every element of an array.
export function jsonValues(data: unknown, path: string): string[] {
	let current: unknown[] = [data];
	for (const segment of path.split(".").filter((part) => part !== "")) {
		const iterate = segment.endsWith("[]");
		const key = iterate ? segment.slice(0, -2) : segment;
		current = current.flatMap((value) => {
			const next =
				key === ""
					? value
					: typeof value === "object" && value !== null
						? (value as Record<string, unknown>)[key]
						: undefined;
			if (!iterate) return next === undefined ? [] : [next];
			return Array.isArray(next) ? next : [];
		});
	}
	return current.flatMap((value) =>
		value === null || value === undefined
			? []
			: [typeof value === "object" ? JSON.stringify(value) : String(value)],
	);
}

function split(output: string, variable: Variable): string[] {
	if (variable.json !== null) {
		try {
			return jsonValues(JSON.parse(output), variable.json);
		} catch {
			return [];
		}
	}
	const separator = new RegExp(variable.separator ?? "\\r?\\n", "u");
	return output.split(separator).filter((value) => value.trim() !== "");
}

function transform(values: string[], variable: Variable): string[] {
	let result = values;
	if (variable.match !== null) {
		const pattern = new RegExp(variable.match, "u");
		result = result.flatMap((value) => {
			const match = pattern.exec(value);
			if (match === null) return [];
			return [match[1] ?? match[0]];
		});
	}
	for (const { from, to } of variable.replace) {
		const pattern = new RegExp(from, "gu");
		result = result.map((value) => value.replace(pattern, to));
	}
	if (variable.unique) result = [...new Set(result)];
	if (variable.sort) result = result.toSorted();
	return result;
}

// Turns a variable's static values or command output into fzf candidates.
export function parseCandidates(
	variable: Variable,
	output: string,
): Candidates {
	const lines =
		variable.values.length > 0 ? variable.values : split(output, variable);
	return {
		headers: lines.slice(0, variable.headers),
		values: transform(lines.slice(variable.headers), variable),
	};
}
