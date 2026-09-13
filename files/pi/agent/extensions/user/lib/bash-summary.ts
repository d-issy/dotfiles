// Display hints, not a security classification. Add commands here.
type DisplayRule = {
	label?: string;
	name?: string; // Display name without promoting the command to a label.
	hide?: "always" | "pipeline";
	labelForArgs?: (args: string[]) => string;
	depth?: number; // Includes the executable: 3 displays "gh pr list".
	redirects?: Record<string, string>;
	options?: Record<string, "flag" | "value">;
	subcommands?: Record<string, DisplayRule>;
	wordPattern?: RegExp;
	labelUnless?: RegExp;
	labelOnlyArgs?: readonly string[];
};

const gitRead: DisplayRule = {
	label: "git-read op",
	labelUnless: /^(--output(?:=|$)|--ext-diff$|--textconv$)/u,
};

const commandDictionary: Record<string, DisplayRule> = {
	python3: { name: "python" },
	printf: { hide: "always" },
	echo: { hide: "always" },
	sed: {
		label: "read",
		labelForArgs: sedLabel,
		redirects: { ">": "write", ">>": "edit" },
	},
	sort: { hide: "pipeline" },
	uniq: { hide: "pipeline" },
	wc: { hide: "pipeline" },
	jq: { hide: "pipeline" },
	find: {
		label: "search",
		labelUnless:
			/^-(?:exec|execdir|ok|okdir|delete|fprint|fprint0|fprintf|fls)$/u,
	},
	head: { label: "read" },
	tail: { label: "read" },
	rg: { label: "search" },
	grep: { label: "search" },
	cat: { label: "read", redirects: { ">": "write", ">>": "edit" } },
	pnpm: {
		depth: 2,
		options: {
			"-C": "value",
			"--dir": "value",
			"--filter": "value",
			"-F": "value",
			"-r": "flag",
			"--recursive": "flag",
			"-w": "flag",
			"--workspace-root": "flag",
			"--silent": "flag",
		},
		subcommands: { run: { depth: 3 } },
	},
	nix: { depth: 2 },
	gh: {
		depth: 3,
		options: { "-R": "value", "--repo": "value", "--hostname": "value" },
	},
	git: {
		depth: 2,
		wordPattern: /^[a-z][a-z0-9-]*$/u,
		options: {
			"-C": "value",
			"--no-pager": "flag",
			"--paginate": "flag",
			"--no-optional-locks": "flag",
		},
		subcommands: {
			...Object.fromEntries(
				[
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
				].map((name) => [name, gitRead]),
			),
			remote: { label: "git-read op", labelOnlyArgs: ["-v", "--verbose"] },
		},
	},
};

// Inspect options, not script text or filenames that happen to contain "-i".
function sedLabel(args: string[]): string {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i]!;
		if (arg === "--") break;
		if (arg === "--in-place" || arg.startsWith("--in-place=")) return "edit";
		if (arg === "--expression" || arg === "--file") {
			i++;
			continue;
		}
		if (arg.startsWith("--")) continue;
		if (!arg.startsWith("-") || arg === "-") continue;
		for (let j = 1; j < arg.length; j++) {
			const option = arg[j];
			if (option === "i") return "edit";
			if (option === "e" || option === "f") {
				if (j === arg.length - 1) i++;
				break;
			}
		}
	}
	return "read";
}

// Only tokenize simple shell commands. Never execute or expand shell input.
// Unsupported syntax falls back rather than attributing nested commands to reads.
type Command = {
	words: string[];
	redirects: string[];
	pipeline: boolean;
	quoted: boolean;
};

function commands(source: string): Command[] | undefined {
	const result: Command[] = [];
	const heredocs: Array<{ delimiter: string; stripTabs: boolean }> = [];
	let redirects: string[] = [];
	let pipeline = false;
	let quoted = false;
	let words: string[] = [];
	let word = "";
	let started = false;
	let quote = "";
	const finishWord = (): void => {
		if (started) words.push(word);
		word = "";
		started = false;
	};
	const finishCommand = (pipe = false): void => {
		finishWord();
		if (words.length)
			result.push({ words, redirects, pipeline: pipeline || pipe, quoted });
		words = [];
		redirects = [];
		pipeline = pipe;
		quoted = false;
	};
	for (let i = 0; i < source.length; i++) {
		const char = source[i]!;
		if (char === "\n" && !quote && heredocs.length) {
			finishCommand();
			let cursor = i + 1;
			for (const { delimiter, stripTabs } of heredocs) {
				let closed = false;
				while (cursor < source.length) {
					const end = source.indexOf("\n", cursor);
					const line = source.slice(cursor, end < 0 ? source.length : end);
					cursor = end < 0 ? source.length : end + 1;
					if ((stripTabs ? line.replace(/^\t+/u, "") : line) === delimiter) {
						closed = true;
						break;
					}
				}
				if (!closed) return;
			}
			heredocs.length = 0;
			i = cursor - 1;
			continue;
		}
		if (quote === "'") {
			if (char === "'") quote = "";
			else word += char;
			continue;
		}
		if (char === "`") return;
		if (char === "$") {
			const variable = source
				.slice(i)
				.match(
					/^\$(?:[A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!_-]|\{[A-Za-z_][A-Za-z0-9_]*\})/u,
				)?.[0];
			if (!variable) return;
			word += variable;
			started = true;
			i += variable.length - 1;
			continue;
		}
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
			if (!words.length) quoted = true;
			started = true;
			continue;
		}
		// find's {} placeholder is an ordinary argument, not a shell group.
		if (
			char === "{" &&
			source[i + 1] === "}" &&
			!started &&
			/^(?:\s|[;|&]|$)/u.test(source.slice(i + 2))
		) {
			word = "{}";
			started = true;
			i++;
			continue;
		}
		// Keep simple brace alternatives as one word; display hints do not need
		// their expanded paths. Shell groups and expansions with shell syntax
		// still fall back, so nested commands cannot be mistaken for reads.
		if (char === "{") {
			const alternatives = source
				.slice(i)
				.match(/^\{[A-Za-z0-9_./*?:+-]*(?:,[A-Za-z0-9_./*?:+-]*)+\}/u)?.[0];
			if (!alternatives) return;
			word += alternatives;
			started = true;
			i += alternatives.length - 1;
			continue;
		}
		if ("()}".includes(char)) return;
		if (char === ">" || char === "<") {
			// A descriptor immediately before a redirect is not a command argument.
			if (/^\d+$/u.test(word)) {
				word = "";
				started = false;
			}
			finishWord();
			const descriptor = source
				.slice(i)
				.match(/^[<>]&(?:[0-9]+|-)(?=[\s;|&]|$)/u)?.[0];
			if (descriptor) {
				i += descriptor.length - 1;
				continue;
			}
			if (char === "<" && source[i + 1] === "<") {
				const match = source
					.slice(i)
					.match(
						/^<<(-?)[ \t]*(?:'([^'\n]+)'|"([^"\n]+)"|([A-Za-z_][A-Za-z0-9_]*))(?=[\s;|&]|$)/u,
					);
				if (!match) return;
				heredocs.push({
					delimiter: (match[2] ?? match[3] ?? match[4])!,
					stripTabs: match[1] === "-",
				});
				i += match[0].length - 1;
				continue;
			}
			if (source[i + 1] === "&") return;
			let operator = char;
			if (source[i + 1] === char) {
				operator += char;
				i++;
			}
			redirects.push(operator);
			continue;
		}
		if (char === "#" && !started) {
			while (i < source.length && source[i] !== "\n") i++;
			i--;
			finishCommand();
			continue;
		}
		if (";|&\n".includes(char)) {
			const pipe = char === "|" && source[i + 1] !== "|";
			finishCommand(pipe);
			if ((char === "|" || char === "&") && source[i + 1] === char) i++;
			continue;
		}
		if (/\s/u.test(char)) {
			finishWord();
			continue;
		}
		word += char;
		started = true;
	}
	if (quote || heredocs.length) return;
	finishCommand();
	return loopBodies(result);
}

// Support ordinary for/in loops, including nesting. Do not infer iteration counts.
function loopBodies(parsed: Command[]): Command[] | undefined {
	const result: Command[] = [];
	const loops: boolean[] = [];
	for (const entry of parsed) {
		const words = [...entry.words];
		if (!entry.quoted && words[0] === "do") {
			if (loops.at(-1) !== false) return;
			loops[loops.length - 1] = true;
			words.shift();
		}
		if (!entry.quoted && words[0] === "for") {
			if (
				!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(words[1] ?? "") ||
				(words.length > 2 && words[2] !== "in")
			)
				return;
			loops.push(false);
			continue;
		}
		if (!entry.quoted && words[0] === "done") {
			if (words.length !== 1 || loops.pop() !== true) return;
			continue;
		}
		if (loops.at(-1) === false) return;
		if (words.length) result.push({ ...entry, words });
	}
	return loops.length ? undefined : result;
}

function classify(
	{ words, redirects, pipeline }: Command,
	markLabel: () => void,
): string | undefined {
	let index = 0;
	while (/^[A-Za-z_][A-Za-z0-9_]*=/u.test(words[index] ?? "")) index++;
	let name = words[index++]?.split("/").pop();
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
	const initialRule = Object.hasOwn(commandDictionary, name)
		? commandDictionary[name]
		: undefined;
	if (!initialRule) return name;
	name = initialRule.name ?? name;
	if (
		initialRule.hide === "always" ||
		(initialRule.hide === "pipeline" && pipeline)
	)
		return;
	let rule: DisplayRule = initialRule;
	if (redirects.length) {
		if (!rule.redirects) return name;
		for (const [operator, label] of Object.entries(rule.redirects)) {
			if (redirects.includes(operator)) {
				markLabel();
				return label;
			}
		}
	}
	const display = [name];
	let depth = rule.depth ?? 1;
	while (true) {
		const args = words.slice(index);
		if (
			rule.label &&
			!args.some((arg) => rule?.labelUnless?.test(arg)) &&
			(!rule.labelOnlyArgs ||
				args.every((arg) => rule?.labelOnlyArgs?.includes(arg)))
		) {
			markLabel();
			return rule.labelForArgs?.(args) ?? rule.label;
		}
		if (display.length >= depth) break;
		// Only skip declared options; unknown ones stop deeper classification.
		while (words[index]?.startsWith("-")) {
			const option = words[index++]!;
			const key = option.split("=")[0]!;
			const kind =
				rule.options && Object.hasOwn(rule.options, key)
					? rule.options[key]
					: undefined;
			if (
				!kind ||
				(option.includes("=") && (kind !== "value" || !key.startsWith("--")))
			)
				return display.join(" ");
			if (kind === "value" && !option.includes("=")) index++;
		}
		const word = words[index++];
		if (
			!word ||
			!(rule.wordPattern ?? /^[a-zA-Z0-9_][a-zA-Z0-9_.:-]*$/u).test(word)
		)
			break;
		display.push(word);
		const child: DisplayRule | undefined =
			rule.subcommands && Object.hasOwn(rule.subcommands, word)
				? rule.subcommands[word]
				: undefined;
		rule = child ?? { options: rule.options, wordPattern: rule.wordPattern };
		depth = rule.depth ?? depth;
	}
	return display.join(" ");
}

export type BashOperation = { name: string; labeled: boolean };

// Failed parsing must never put arguments or script bodies into the summary.
// Use only a simple leading command prefix, without inferring read-only labels.
function fallbackOperation(source: string): BashOperation {
	const prefix = source
		.trimStart()
		.match(
			/^(?:[A-Za-z_][A-Za-z0-9_]*=[^\s;|&]+\s+)*[a-zA-Z0-9_./+-]+(?:[ \t]+[a-zA-Z0-9_.:-]+)*/u,
		)?.[0];
	const parsed = prefix ? commands(prefix) : undefined;
	const entry = parsed?.[0];
	if (!entry) return { name: "bash", labeled: false };
	const operation = classify(entry, () => undefined);
	const executable = entry.words
		.find((word) => !/^[A-Za-z_][A-Za-z0-9_]*=/u.test(word))
		?.split("/")
		.pop();
	const rule =
		executable && Object.hasOwn(commandDictionary, executable)
			? commandDictionary[executable]
			: undefined;
	return {
		name:
			operation &&
			operation !== "complex command" &&
			!rule?.label &&
			!Object.values(rule?.subcommands ?? {}).some(
				(child) => child.label === operation,
			)
				? operation
				: (rule?.name ?? executable ?? "bash"),
		labeled: false,
	};
}

/** Counts describe submitted commands, not proof that each shell branch ran. */
export function bashOperationDetails(command: string): BashOperation[] {
	const parsed = commands(command);
	const fallback = fallbackOperation(command);
	return parsed
		? parsed.flatMap((entry) => {
				let labeled = false;
				const operation = classify(entry, () => {
					labeled = true;
				});
				if (operation === undefined) return [];
				return [
					{
						name: operation === "complex command" ? fallback.name : operation,
						labeled,
					},
				];
			})
		: [fallback];
}

export function bashOperations(command: string): string[] {
	return bashOperationDetails(command).map(({ name }) => name);
}
