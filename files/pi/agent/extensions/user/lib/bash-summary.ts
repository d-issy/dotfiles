// Display hints, not a security classification. Extend this dictionary as needed.
const commandDictionary: Record<
	string,
	{ read: readonly string[]; subcommands: boolean }
> = {
	git: {
		read: [
			"status",
			"log",
			"show",
			"diff",
			"ls-files",
			"ls-tree",
			"rev-parse",
			"rev-list",
			"show-ref",
			"describe",
			"blame",
			"grep",
		],
		subcommands: true,
	},
};

// Only tokenize simple shell commands. Never execute or expand shell input.
// Unsupported syntax falls back rather than attributing nested commands to reads.
function commands(source: string): string[][] | undefined {
	const result: string[][] = [];
	let words: string[] = [];
	let word = "";
	let started = false;
	let quote = "";
	const finishWord = (): void => {
		if (started) words.push(word);
		word = "";
		started = false;
	};
	const finishCommand = (): void => {
		finishWord();
		if (words.length) result.push(words);
		words = [];
	};
	for (let i = 0; i < source.length; i++) {
		const char = source[i]!;
		if (quote === "'") {
			if (char === "'") quote = "";
			else word += char;
			continue;
		}
		if (char === "`" || char === "$") return;
		if (char === "\\") {
			const next = source[++i];
			if (next === undefined) return;
			if (next !== "\n") {
				word += next;
				started = true;
			}
			continue;
		}
		if (quote === '"') {
			if (char === '"') quote = "";
			else word += char;
			continue;
		}
		if (char === "'" || char === '"') {
			quote = char;
			started = true;
			continue;
		}
		if ("()<>{}".includes(char)) return;
		if (char === "#" && !started) {
			while (i < source.length && source[i] !== "\n") i++;
			finishCommand();
			continue;
		}
		if (";|&\n".includes(char)) {
			finishCommand();
			continue;
		}
		if (/\s/u.test(char)) {
			finishWord();
			continue;
		}
		word += char;
		started = true;
	}
	if (quote) return;
	finishCommand();
	return result;
}

function classify(words: string[]): string {
	let index = 0;
	while (/^[A-Za-z_][A-Za-z0-9_]*=/u.test(words[index] ?? "")) index++;
	const name = words[index++];
	if (!name || !/^[a-zA-Z0-9_.+-]+$/u.test(name)) return "complex command";
	if (
		[
			"if",
			"then",
			"else",
			"fi",
			"for",
			"while",
			"until",
			"do",
			"done",
			"case",
			"esac",
			"function",
			"!",
		].includes(name)
	)
		return "complex command";
	const entry = commandDictionary[name];
	if (!entry?.subcommands) return name;
	// Skip only known Git global options. Unknown options/config overrides stay unclassified.
	while (words[index]?.startsWith("-")) {
		if (words[index] === "-C") {
			index += 2;
			continue;
		}
		if (
			["--no-pager", "--paginate", "--no-optional-locks"].includes(
				words[index]!,
			)
		) {
			index++;
			continue;
		}
		return name;
	}
	const subcommand = words[index];
	if (!subcommand || !/^[a-z][a-z0-9-]*$/u.test(subcommand)) return name;
	const args = words.slice(index + 1);
	// Some otherwise read-oriented commands can write files or invoke external tools.
	const unsafeReadOption = args.some((arg) =>
		/^(--output(?:=|$)|--ext-diff$|--textconv$)/u.test(arg),
	);
	if (entry.read.includes(subcommand) && !unsafeReadOption)
		return `${name}-read op`;
	if (
		subcommand === "remote" &&
		args.every((arg) => ["-v", "--verbose"].includes(arg))
	)
		return "git-read op";
	return `${name} ${subcommand}`;
}

/** Counts describe submitted commands, not proof that each shell branch ran. */
export function bashOperations(command: string): string[] {
	const parsed = commands(command);
	return parsed?.length ? parsed.map(classify) : ["complex command"];
}
