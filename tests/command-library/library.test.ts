import { describe, expect, it } from "vitest";
import {
	type Config,
	type Environment,
	type Item,
	type Section,
	type Variable,
	channel,
	extractColumn,
	findAlias,
	formatHeader,
	formatLines,
	isActive,
	items,
	parseSelection,
	placeholders,
	substitute,
} from "../../apps/command-library/src/library";
import {
	type Prompter,
	resolveCommand,
} from "../../apps/command-library/src/resolve";

function variable(
	overrides: Partial<Variable> & { command: string },
): Variable {
	return {
		column: null,
		headers: 0,
		delimiter: null,
		multi: false,
		selectOne: true,
		...overrides,
	};
}

const config: Config = {
	fzf: { command: "fzf", options: [], variableOptions: [] },
	sections: [
		{
			tags: ["aliases"],
			variables: {},
			entries: [
				{
					description: "shell alias",
					alias: "codex",
					command: "codex-statusline",
				},
				{
					description: "shell alias",
					alias: "codexu",
					command: "codex --config model_reasoning_effort=ultra",
				},
				{
					description: "shell alias",
					alias: "cla",
					command: "claude --permission-mode auto",
				},
			],
		},
		{
			tags: ["nix agent-sessions"],
			variables: {},
			entries: [
				{
					description: "watch Claude Code and Codex sessions live",
					alias: "agent-sessions",
					command: "nix run .#agent-sessions",
				},
			],
		},
		{
			tags: ["docker"],
			variables: {},
			entries: [
				{ description: "docker ps", alias: null, command: "docker ps" },
			],
		},
	],
};

describe("aliases and channels", () => {
	const list = items(config);

	it("expands only exact aliases", () => {
		expect(findAlias(list, "codexu")?.entry.command).toBe(
			"codex --config model_reasoning_effort=ultra",
		);
		expect(findAlias(list, " cla ")?.entry.command).toBe(
			"claude --permission-mode auto",
		);
		expect(findAlias(list, "codexu2")).toBeUndefined();
		expect(findAlias(list, "")).toBeUndefined();
	});

	it("narrows to the channel matching the first word", () => {
		const docker = channel(list, "docker lo");
		expect(docker.name).toBe("docker");
		expect(docker.items.map((item) => item.entry.command)).toEqual([
			"docker ps",
		]);
		expect(
			channel(list, "nix").items.map((item) => item.entry.command),
		).toEqual(["nix run .#agent-sessions"]);
		const unknown = channel(list, "unknown");
		expect(unknown.name).toBeNull();
		expect(unknown.items).toHaveLength(list.length);
	});

	it("aligns the header with the entry columns", () => {
		const header = formatHeader(list, null);
		const plain = formatLines(list)
			.map((line) => line.split("\u001F")[1] ?? "")
			// oxlint-disable-next-line no-control-regex
			.map((line) => line.replace(/\u001B\[[0-9;]*m/gu, ""));
		expect(plain[0]?.indexOf("codex-statusline")).toBe(
			header.indexOf("COMMAND"),
		);
		expect(formatHeader(list, "docker").split("\n")[0]).toBe("channel: docker");
	});

	it("round-trips the selected index through the fzf line", () => {
		const lines = formatLines(list);
		expect(lines).toHaveLength(list.length);
		expect(parseSelection(lines[2] ?? "")).toBe(2);
		expect(lines[1]).toContain("codexu");
	});
});

describe("placeholders", () => {
	it("lists unique placeholders in order", () => {
		expect(placeholders("zip -r <output>.zip <files> <output>")).toEqual([
			"output",
			"files",
		]);
	});

	it("substitutes known values and keeps unknown ones", () => {
		expect(
			substitute("go run <main-file> <x>", new Map([["main-file", "a.go"]])),
		).toBe("go run a.go <x>");
	});

	it("extracts columns", () => {
		expect(extractColumn("12\ttitle here\tbranch", 1, "\\t")).toBe("12");
		expect(extractColumn("nginx   latest   abc123   2 days ago", 3, null)).toBe(
			"abc123",
		);
		expect(extractColumn("whole line", null, null)).toBe("whole line");
	});
});

function prompter(
	outputs: Record<string, string>,
	answers: Record<string, string[] | string | null>,
): Prompter & { ran: string[]; asked: string[] } {
	const ran: string[] = [];
	const asked: string[] = [];
	return {
		ran,
		asked,
		run(command) {
			ran.push(command);
			return outputs[command] ?? "";
		},
		choose(name) {
			asked.push(name);
			const answer = answers[name];
			return Array.isArray(answer) ? answer : null;
		},
		input(name) {
			asked.push(name);
			const answer = answers[name];
			return typeof answer === "string" ? answer : null;
		},
	};
}

function makeItem(command: string, variables: Record<string, Variable>): Item {
	return {
		section: { tags: ["t"], variables, entries: [] },
		entry: { description: "d", alias: null, command },
	};
}

describe("resolveCommand", () => {
	it("resolves dependencies before dependent variables", () => {
		const p = prompter(
			{
				"aws configure list-profiles": "dev\nprod\n",
				"aws --profile prod ec2": "web\ti-1\napi\ti-2\n",
			},
			{ profile: ["prod"], target: ["api\ti-2"] },
		);
		const result = resolveCommand(
			makeItem("aws --profile <profile> ssm start-session --target <target>", {
				profile: variable({ command: "aws configure list-profiles" }),
				target: variable({
					command: "aws --profile <profile> ec2",
					column: 2,
					selectOne: false,
				}),
			}),
			p,
		);
		expect(result).toBe("aws --profile prod ssm start-session --target i-2");
		expect(p.ran).toEqual([
			"aws configure list-profiles",
			"aws --profile prod ec2",
		]);
	});

	it("auto-selects a single candidate and prompts for free text", () => {
		const p = prompter(
			{ "echo git@github.com:me/dots.git": "git@github.com:me/dots.git\n" },
			{ username: "me", repo: "dots" },
		);
		const result = resolveCommand(
			makeItem("ghq get <git_repo>", {
				git_repo: variable({
					command: "echo git@github.com:<username>/<repo>.git",
				}),
			}),
			p,
		);
		expect(result).toBe("ghq get git@github.com:me/dots.git");
		expect(p.asked).toEqual(["username", "repo"]);
	});

	it("skips header lines and joins multiple selections", () => {
		const p = prompter(
			{ "docker ps": "CONTAINER ID   IMAGE\nabc   nginx\ndef   redis\n" },
			{ ids: ["abc   nginx", "def   redis"] },
		);
		const result = resolveCommand(
			makeItem("docker stop <ids>", {
				ids: variable({
					command: "docker ps",
					headers: 1,
					column: 1,
					multi: true,
				}),
			}),
			p,
		);
		expect(result).toBe("docker stop abc def");
	});

	it("returns null when cancelled", () => {
		const p = prompter({}, {});
		expect(
			resolveCommand(makeItem("tar czf <output>.tar.gz", {}), p),
		).toBeNull();
	});
});

function scopedSection(when: Partial<NonNullable<Section["when"]>>): Section {
	return {
		tags: ["t"],
		variables: {},
		entries: [{ description: "d", alias: null, command: "c" }],
		when: { paths: [], files: [], commands: [], ...when },
	};
}

describe("when conditions", () => {
	const env: Environment = {
		cwd: "/home/me/code/github.com/d-issy/dotfiles/apps",
		home: "/home/me",
		exists: (path) =>
			path === "/home/me/code/github.com/d-issy/dotfiles/apps/Makefile",
		hasCommand: (name) => name === "make",
	};

	it("is active without conditions", () => {
		expect(isActive(scopedSection({}), env)).toBe(true);
		expect(isActive({ tags: [], variables: {}, entries: [] }, env)).toBe(true);
	});

	it("matches paths under a directory with ~ expanded", () => {
		expect(
			isActive(
				scopedSection({ paths: ["~/code/github.com/d-issy/dotfiles"] }),
				env,
			),
		).toBe(true);
		expect(
			isActive(scopedSection({ paths: ["~/code/github.com/d-issy/dot"] }), env),
		).toBe(false);
	});

	it("requires one of the files in the current directory", () => {
		expect(
			isActive(scopedSection({ files: ["justfile", "Makefile"] }), env),
		).toBe(true);
		expect(isActive(scopedSection({ files: ["justfile"] }), env)).toBe(false);
	});

	it("requires every command", () => {
		expect(isActive(scopedSection({ commands: ["make"] }), env)).toBe(true);
		expect(isActive(scopedSection({ commands: ["make", "just"] }), env)).toBe(
			false,
		);
	});

	it("drops inactive sections from items and alias expansion", () => {
		const scoped: Config = {
			...config,
			sections: [
				...config.sections,
				{
					...scopedSection({ files: ["justfile"] }),
					entries: [
						{ description: "d", alias: "just", command: "just <recipe>" },
					],
				},
			],
		};
		expect(findAlias(items(scoped), "just")).toBeDefined();
		expect(findAlias(items(scoped, env), "just")).toBeUndefined();
		expect(findAlias(items(scoped, env), "codexu")).toBeDefined();
	});
});
