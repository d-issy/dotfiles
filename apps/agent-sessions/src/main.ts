import { projectName } from "./render";
import {
	discoverSessions,
	sessionRows,
	sessionRuntime,
	toRows,
} from "./sessions";
import { formatAge, formatDuration, oneLine, parseDuration } from "./text";
import { Tui } from "./tui";

const USAGE = `dot-agent-sessions - watch Claude Code and Codex sessions live

Usage:
  dot-agent-sessions [--window DURATION] [--list]

Options:
  -w, --window DURATION  Include Codex sessions updated within DURATION
                         (e.g. 30m, 2h, 1d). Default: 2h.
  -l, --list             Print the session list once and exit.
  -h, --help             Show this help.

Running Claude Code sessions and their subagents are always listed; finished
subagents stay for 10 minutes. Select a session and press enter to follow its
log in real time.`;

function fail(message: string): never {
	process.stderr.write(`dot-agent-sessions: ${message}\n${USAGE}\n`);
	process.exit(2);
}

function printList(windowMs: number): void {
	const now = Date.now();
	const rows = sessionRows(toRows(discoverSessions(windowMs, now)));
	for (const { session, tree } of rows) {
		const columns = [
			session.agent,
			session.status,
			session.model ?? "-",
			formatDuration(sessionRuntime(session, now) ?? 0),
			formatAge(now - session.updatedAt),
			projectName(session.cwd),
			`${tree}${session.title}`,
			oneLine(session.last ?? "").slice(0, 120),
		];
		process.stdout.write(`${columns.join("\t")}\n`);
	}
}

function main(argv: string[]): void {
	let windowMs = 2 * 3_600_000;
	let list = false;
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index] ?? "";
		if (arg === "-h" || arg === "--help") {
			process.stdout.write(`${USAGE}\n`);
			return;
		}
		if (arg === "-l" || arg === "--list") {
			list = true;
		} else if (arg === "-w" || arg === "--window") {
			const parsed = parseDuration(argv[index + 1] ?? "");
			if (parsed === undefined)
				fail(`invalid duration: ${argv[index + 1] ?? ""}`);
			windowMs = parsed;
			index += 1;
		} else {
			fail(`unknown argument: ${arg}`);
		}
	}
	if (list || !process.stdout.isTTY || !process.stdin.isTTY) {
		printList(windowMs);
		return;
	}
	new Tui(windowMs).start();
}

main(process.argv.slice(2));
