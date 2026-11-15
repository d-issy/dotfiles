import { readFileSync } from "node:fs";

export interface Replacement {
	from: string;
	to: string;
}

export interface Variable {
	// Shell command producing candidates; null when `values` is used.
	command: string | null;
	values: string[];
	json: string | null;
	separator: string | null;
	match: string | null;
	replace: Replacement[];
	unique: boolean;
	sort: boolean;
	column: number | null;
	headers: number;
	delimiter: string | null;
	multi: boolean;
	selectOne: boolean;
}

export interface Entry {
	description: string;
	alias: string | null;
	command: string;
}

export interface When {
	paths: string[];
	files: string[];
	commands: string[];
}

export interface Section {
	tags: string[];
	variables: Record<string, Variable>;
	entries: Entry[];
	when?: When;
}

export interface Environment {
	cwd: string;
	home: string;
	exists(path: string): boolean;
	hasCommand(name: string): boolean;
}

export interface Config {
	fzf: {
		command: string;
		options: string[];
		variableOptions: string[];
	};
	sections: Section[];
}

export interface Item {
	section: Section;
	entry: Entry;
}

// Matches placeholders such as <name> or <main-file>.
const PLACEHOLDER = /<([A-Za-z0-9_-]+)>/gu;
// Default column delimiter: runs of two or more spaces, or a tab.
const DEFAULT_DELIMITER = "\\s{2,}|\\t";
const FIELD_SEPARATOR = "\u001F";

const TAG_WIDTH = 24;
const DESCRIPTION_WIDTH = 48;
const CYAN = "\u001B[36m";
const BLUE = "\u001B[34m";
const YELLOW = "\u001B[33m";
const RESET = "\u001B[0m";

export function loadConfig(path: string): Config {
	return JSON.parse(readFileSync(path, "utf8")) as Config;
}

function expandHome(path: string, home: string): string {
	if (path === "~") return home;
	return path.startsWith("~/") ? `${home}${path.slice(1)}` : path;
}

function isUnder(cwd: string, directory: string): boolean {
	const base = directory.replace(/\/+$/u, "");
	return cwd === base || cwd.startsWith(`${base}/`);
}

// A section is active when every configured condition holds: the cwd is under
// one of `paths`, one of `files` exists in the cwd, and all `commands` exist.
export function isActive(section: Section, env: Environment): boolean {
	const when = section.when;
	if (when === undefined) return true;
	if (
		when.paths.length > 0 &&
		!when.paths.some((path) => isUnder(env.cwd, expandHome(path, env.home)))
	)
		return false;
	if (
		when.files.length > 0 &&
		!when.files.some((file) => env.exists(`${env.cwd}/${file}`))
	)
		return false;
	return when.commands.every((command) => env.hasCommand(command));
}

export function items(config: Config, env?: Environment): Item[] {
	return config.sections
		.filter((section) => env === undefined || isActive(section, env))
		.flatMap((section) => section.entries.map((entry) => ({ section, entry })));
}

export function findAlias(list: Item[], query: string): Item | undefined {
	const name = query.trim();
	if (name === "") return undefined;
	return list.find((item) => item.entry.alias === name);
}

export interface Channel {
	name: string | null;
	items: Item[];
}

// Narrows to the sections whose tags start with the first word of the
// command line (e.g. "docker ..." -> docker), or keeps every item.
export function channel(list: Item[], query: string): Channel {
	const word = query.trim().split(/\s+/u)[0] ?? "";
	if (word === "") return { name: null, items: list };
	const matches = list.filter((item) =>
		item.section.tags.some((tag) => tag.split(/\s+/u)[0] === word),
	);
	return matches.length === 0
		? { name: null, items: list }
		: { name: word, items: matches };
}

export function placeholders(command: string): string[] {
	const names: string[] = [];
	for (const match of command.matchAll(PLACEHOLDER)) {
		const name = match[1];
		if (name !== undefined && !names.includes(name)) names.push(name);
	}
	return names;
}

export function substitute(
	command: string,
	values: ReadonlyMap<string, string>,
): string {
	return command.replace(
		PLACEHOLDER,
		(placeholder, name: string) => values.get(name) ?? placeholder,
	);
}

export function extractColumn(
	line: string,
	column: number | null,
	delimiter: string | null,
): string {
	if (column === null) return line;
	const fields = line.split(new RegExp(delimiter ?? DEFAULT_DELIMITER, "u"));
	return (fields[column - 1] ?? "").trim();
}

function pad(text: string, width: number): string {
	return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function columnWidth(values: string[], max: number): number {
	return Math.min(max, Math.max(0, ...values.map((value) => value.length)));
}

function oneLine(text: string): string {
	return text.replace(/\s*\n\s*/gu, " ; ").trim();
}

function describe(entry: Entry): string {
	return entry.alias === null
		? entry.description
		: `${entry.description} :: ${entry.alias}`;
}

const TAGS_HEADER = "TAGS";
const DESCRIPTION_HEADER = "DESCRIPTION :: ALIAS";
const COMMAND_HEADER = "COMMAND";

function tagText(item: Item): string {
	return item.section.tags.join(", ");
}

function widths(list: Item[]): { tag: number; description: number } {
	return {
		tag: columnWidth([TAGS_HEADER, ...list.map(tagText)], TAG_WIDTH),
		description: columnWidth(
			[DESCRIPTION_HEADER, ...list.map((item) => describe(item.entry))],
			DESCRIPTION_WIDTH,
		),
	};
}

// Column titles aligned with formatLines, plus the active channel if any.
export function formatHeader(list: Item[], channelName: string | null): string {
	const { tag, description } = widths(list);
	const columns = `${pad(TAGS_HEADER, tag)}  ${pad(DESCRIPTION_HEADER, description)}  ${COMMAND_HEADER}`;
	return channelName === null ? columns : `channel: ${channelName}\n${columns}`;
}

// Each line is "<index><US><display>" so fzf can hide the index with --with-nth.
export function formatLines(list: Item[]): string[] {
	const tags = list.map(tagText);
	const { tag: tagWidth, description: descriptionWidth } = widths(list);
	return list.map((item, index) => {
		const { entry } = item;
		const description =
			entry.alias === null
				? `${BLUE}${pad(entry.description, descriptionWidth)}${RESET}`
				: `${BLUE}${entry.description}${RESET} :: ${YELLOW}${entry.alias}${RESET}${" ".repeat(Math.max(0, descriptionWidth - describe(entry).length))}`;
		return [
			String(index),
			FIELD_SEPARATOR,
			`${CYAN}${pad(tags[index] ?? "", tagWidth)}${RESET}  `,
			`${description}  `,
			oneLine(entry.command),
		].join("");
	});
}

export function parseSelection(line: string): number | undefined {
	const index = Number.parseInt(line.split(FIELD_SEPARATOR)[0] ?? "", 10);
	return Number.isNaN(index) ? undefined : index;
}

export const FZF_LINE_OPTIONS = [
	"--ansi",
	"--delimiter",
	FIELD_SEPARATOR,
	"--with-nth",
	"2..",
];
