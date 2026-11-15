import {
	type Item,
	type Variable,
	extractColumn,
	placeholders,
	substitute,
} from "./library";

export interface Prompter {
	// Runs a variable command and returns its stdout.
	run(command: string): string;
	// Lets the user pick lines; returns null when cancelled.
	choose(
		name: string,
		variable: Variable,
		lines: string[],
		header: string,
	): string[] | null;
	// Asks for free text; returns null when cancelled.
	input(name: string, header: string): string | null;
}

class Cancelled extends Error {}

function chooseValue(
	name: string,
	variable: Variable,
	lines: string[],
	header: string,
	prompter: Prompter,
): string {
	const candidates = lines.slice(variable.headers);
	if (candidates.length === 0) {
		const value = prompter.input(name, header);
		if (value === null) throw new Cancelled();
		return value;
	}
	const selected =
		variable.selectOne && candidates.length === 1
			? candidates
			: prompter.choose(name, variable, lines, header);
	if (selected === null || selected.length === 0) throw new Cancelled();
	return selected
		.map((line) => extractColumn(line, variable.column, variable.delimiter))
		.join(" ");
}

// Fills every <placeholder> in the entry command, resolving placeholders
// referenced by variable commands first. Returns null when the user cancels.
export function resolveCommand(item: Item, prompter: Prompter): string | null {
	const { command } = item.entry;
	const { variables } = item.section;
	const values = new Map<string, string>();

	const resolve = (name: string, stack: readonly string[]): void => {
		if (values.has(name)) return;
		const variable = variables[name];
		const header = substitute(command, values);
		if (variable === undefined) {
			const value = prompter.input(name, header);
			if (value === null) throw new Cancelled();
			values.set(name, value);
			return;
		}
		const nextStack = [...stack, name];
		for (const dependency of placeholders(variable.command)) {
			if (!nextStack.includes(dependency)) resolve(dependency, nextStack);
		}
		const output = prompter.run(substitute(variable.command, values));
		const lines = output.split("\n").filter((line) => line.trim() !== "");
		values.set(
			name,
			chooseValue(name, variable, lines, substitute(command, values), prompter),
		);
	};

	try {
		for (const name of placeholders(command)) resolve(name, []);
	} catch (error) {
		if (error instanceof Cancelled) return null;
		throw error;
	}
	return substitute(command, values);
}
