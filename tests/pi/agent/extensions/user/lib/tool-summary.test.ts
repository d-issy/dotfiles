import { stripVTControlCharacters } from "node:util";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import {
	AssistantMessageComponent,
	ToolExecutionComponent,
	UserMessageComponent,
	initTheme,
} from "@earendil-works/pi-coding-agent";
import {
	Container,
	type TUI,
	Text,
	resetCapabilitiesCache,
	setCapabilities,
	visibleWidth,
} from "@earendil-works/pi-tui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installToolSummary } from "#pi-user/lib/tool-summary";

const nativeRender = Container.prototype.render;
const theme = { fg: (_color: string, text: string): string => text };
let uninstall: () => void;
let nextId = 0;

beforeEach(() => {
	vi.useFakeTimers();
	initTheme("dark");
	setCapabilities({ images: null, trueColor: false, hyperlinks: false });
	uninstall = installToolSummary(() => theme);
});
afterEach(() => {
	uninstall();
	vi.restoreAllMocks();
	vi.useRealTimers();
	resetCapabilitiesCache();
});

function tool(
	name: string,
	complete = true,
	command = "printf 'running'",
): ToolExecutionComponent {
	const component = new ToolExecutionComponent(
		name,
		`call-${nextId++}`,
		{
			path: "example.ts",
			command,
			pattern: "example",
			oldText: "before",
			newText: "after",
			content: "const example = 1;",
		},
		{},
		undefined,
		{ requestRender: vi.fn() } as unknown as TUI,
		process.cwd(),
	);
	if (complete) {
		finish(component);
		vi.advanceTimersByTime(3000);
	}
	return component;
}

function finish(component: ToolExecutionComponent, isError = false): void {
	component.updateResult({
		content: [{ type: "text", text: isError ? "Command failed" : "result" }],
		details: { diff: "-1 before\n+1 after", firstChangedLine: 1 },
		isError,
	});
}

function container(...children: Container[]): Container {
	const chat = new Container();
	for (const child of children) chat.addChild(child);
	return chat;
}

function assistant(
	text?: string,
	thinking?: string,
): AssistantMessageComponent {
	const message = {
		role: "assistant",
		content: [
			...(text ? [{ type: "text", text }] : []),
			...(thinking ? [{ type: "thinking", thinking }] : []),
			{ type: "toolCall", id: "call", name: "read", arguments: {} },
		],
		stopReason: "toolUse",
	} as AssistantMessage;
	return new AssistantMessageComponent(message);
}

function plainLines(chat: Container, width = 100): string[] {
	return chat
		.render(width)
		.map((line) => stripVTControlCharacters(line).trimEnd());
}

function summaries(chat: Container): string[] {
	return plainLines(chat).filter((line) => /^ [✓✗]/u.test(line));
}

describe("tool summaries (real Pi components)", () => {
	it("counts git read operations together and writes by subcommand across bash calls", () => {
		const chat = container(
			tool("bash", true, "git status; git diff; git log"),
			tool("bash", true, "git show; git remote -v; git add a; git add b"),
		);
		expect(summaries(chat)).toEqual([
			" ✓ git-read op ×5 · run ×1 (git add ×2)",
		]);
		chat.addChild(assistant("Next group"));
		chat.addChild(tool("bash", true, "ls x; ls y"));
		expect(summaries(chat)[1]).toBe(" ✓ run ×1 (ls ×2)");
	});

	it("shows the three most recent operation categories with their total counts", () => {
		const chat = container(
			tool("bash", true, "ls a; cat b; pwd; git status; ls c"),
		);
		expect(summaries(chat)).toEqual([
			" ✓ run ×1 (pwd ×1, ls ×2) · read ×1 · git-read op ×1",
		]);
	});

	it("keeps unlabeled operations inside run counts across mixed bash calls", () => {
		const chat = container(
			tool("read"),
			tool("bash", true, "cat a; pnpm run build; gh pr list"),
			tool("bash", true, "pnpm run build; rg foo a; unknown action"),
		);
		expect(summaries(chat)).toEqual([
			" ✓ read ×2 · run ×2 (gh pr list ×1, pnpm run build ×2, unknown ×1) · grep ×1",
		]);
	});

	it("summarizes loop bodies and omits noisy operations", () => {
		const chat = container(
			tool(
				"bash",
				true,
				'for f in *.ts; do echo "$f"; cat "$f" | sort | uniq; pnpm test "$f"; done',
			),
		);
		expect(summaries(chat)).toEqual([" ✓ read ×1 · run ×1 (pnpm test ×1)"]);
	});

	it("does not display script bodies or unsupported arguments in run details", () => {
		const chat = container(
			tool("bash", true, "python3 - <<PY\nprint('private body')\nPY"),
			tool("bash", true, 'pnpm run build "$(cat private-file)"'),
		);
		expect(summaries(chat)).toEqual([
			" ✓ run ×2 (python ×1, pnpm run build ×1)",
		]);
	});

	it("combines all completed tool kinds without changing the component tree", () => {
		const tools = [
			tool("read"),
			tool("read"),
			tool("ls"),
			tool("find"),
			tool("grep"),
			tool("bash"),
			tool("edit"),
			tool("write"),
			tool("powershell"),
			tool("custom"),
		];
		const chat = container(...tools);
		expect(plainLines(chat, 160)).toEqual([
			"",
			" ✓ read ×2 · ls ×1 · find ×1 · grep ×1 · edit ×1 · write ×1 · powershell ×1 · custom ×1",
		]);
		expect(chat.children).toEqual(tools);
		expect(chat.children[0]).toBe(tools[0]);
	});

	it("keeps bash visible until three seconds after completion", () => {
		vi.useFakeTimers();
		const bash = tool("bash", false);
		const chat = container(tool("read"), bash, tool("grep"));
		expect(chat.render(100)).toEqual([
			"",
			" ✓ read ×1 · grep ×1",
			...bash.render(100),
		]);
		expect(plainLines(chat).join("\n")).toContain("printf 'running'");

		bash.markExecutionStarted();
		bash.updateResult(
			{
				content: [{ type: "text", text: "streaming output" }],
				isError: false,
			},
			true,
		);
		expect(chat.render(100)).toEqual([
			"",
			" ✓ read ×1 · grep ×1",
			...bash.render(100),
		]);
		expect(plainLines(chat).join("\n")).toContain("streaming output");

		finish(bash);
		vi.advanceTimersByTime(2999);
		expect(plainLines(chat).join("\n")).toContain("printf 'running'");
		vi.advanceTimersByTime(1);
		expect(plainLines(chat)).toEqual(["", " ✓ read ×1 · grep ×1"]);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("requests a redraw when the bash grace period expires and cancels on uninstall", () => {
		const bash = tool("bash", false);
		const ui = (
			bash as unknown as { ui: { requestRender: ReturnType<typeof vi.fn> } }
		).ui;
		finish(bash);
		ui.requestRender.mockClear();
		vi.advanceTimersByTime(2999);
		expect(ui.requestRender).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(ui.requestRender).toHaveBeenCalledOnce();
		finish(tool("bash", false));
		uninstall();
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each(["read", "custom"])("hides pending %s unless expanded", (name) => {
		const row = tool(name, false);
		const chat = container(row);
		expect(chat.render(100)).toEqual([]);
		row.setExpanded(true);
		expect(chat.render(100)).toEqual(nativeRender.call(chat, 100));
	});

	it.each(["edit", "write"])(
		"shows pending %s and summarizes immediately on completion",
		(name) => {
			const row = tool(name, false);
			const chat = container(tool("read"), row, tool("grep"));
			expect(chat.render(100)).toEqual([
				"",
				" ✓ read ×1 · grep ×1",
				...row.render(100),
			]);
			finish(row);
			expect(plainLines(chat)).toEqual([
				"",
				` ✓ read ×1 · ${name} ×1 · grep ×1`,
			]);
			expect(vi.getTimerCount()).toBe(0);
			row.setExpanded(true);
			expect(chat.render(100).join("\n")).toContain(row.render(100).join("\n"));
		},
	);

	it("places thinking before summaries and bash previews after them through the grace period", () => {
		const bash = tool("bash", false);
		const thinking = assistant(undefined, "Considering options");
		const chat = container(tool("read"), bash, thinking, tool("grep"));
		const expected = (): string[] => [
			...thinking.render(100),
			"",
			" ✓ read ×1 · grep ×1",
			...bash.render(100),
		];
		expect(chat.render(100)).toEqual(expected());
		finish(bash);
		expect(chat.render(100)).toEqual(expected());
		vi.advanceTimersByTime(3000);
		expect(chat.render(100)).toEqual([
			...thinking.render(100),
			"",
			" ✓ read ×1 · grep ×1",
		]);
	});

	it("folds parallel calls as each finishes, not before", () => {
		const read = tool("read", false);
		const grep = tool("grep", false);
		const chat = container(read, grep);
		expect(chat.render(100)).toEqual([]);
		finish(grep);
		expect(chat.render(100)).toEqual(["", " ✓ grep ×1"]);
		finish(read);
		expect(plainLines(chat)).toEqual(["", " ✓ read ×1 · grep ×1"]);
	});

	it.each(["bash", "read", "custom"])(
		"keeps failed %s visible between thinking while summarizing only successes",
		(name) => {
			const failed = tool(name, false);
			finish(failed, true);
			const before = assistant(undefined, "Before failure");
			const after = assistant(undefined, "After failure");
			const chat = container(tool("read"), before, failed, after, tool("grep"));
			const expected = (): string[] => [
				...before.render(100),
				...failed.render(100),
				...after.render(100),
				"",
				" ✓ read ×1 · grep ×1",
			];
			expect(chat.render(100)).toEqual(expected());
			vi.advanceTimersByTime(5000);
			expect(chat.render(100)).toEqual(expected());
			expect(plainLines(chat).join("\n")).toContain("Command failed");
			expect(container(failed).render(100)).toEqual(failed.render(100));
			failed.setExpanded(true);
			expect(container(failed).render(100)).toEqual(failed.render(100));
		},
	);

	it("ignores tool-only assistant rows but splits at assistant and user messages", () => {
		const chat = container(
			tool("read"),
			assistant(),
			tool("grep"),
			assistant("I will check the next file."),
			tool("read"),
			new UserMessageComponent("Check another directory."),
			tool("ls"),
		);
		expect(summaries(chat)).toEqual([
			" ✓ read ×1 · grep ×1",
			" ✓ read ×1",
			" ✓ ls ×1",
		]);
		const output = plainLines(chat).join("\n");
		expect(output).toContain("I will check the next file.");
		expect(output).toContain("Check another directory.");
	});

	it("aggregates across thinking but not other visible transcript entries", () => {
		const thinking = assistant(undefined, "Considering options");
		const chat = container(tool("read"), thinking, tool("grep"));
		expect(chat.render(100)).toEqual([
			...thinking.render(100),
			"",
			" ✓ read ×1 · grep ×1",
		]);
		chat.addChild(new Text("Notice", 0, 0));
		chat.addChild(tool("ls"));
		expect(summaries(chat)).toEqual([" ✓ read ×1 · grep ×1", " ✓ ls ×1"]);
	});

	it("separates groups when an assistant has both thinking and text", () => {
		const chat = container(
			tool("read"),
			assistant("Checking more", "Considering options"),
			tool("grep"),
		);
		expect(summaries(chat)).toEqual([" ✓ read ×1", " ✓ grep ×1"]);
		expect(plainLines(chat).join("\n")).toContain("Checking more");
	});

	it.each([undefined, "Considering options"])(
		"re-evaluates boundaries when a streaming assistant acquires text (thinking: %s)",
		(thinking) => {
			const message = assistant(undefined, thinking);
			const chat = container(tool("read"), message, tool("grep"));
			expect(summaries(chat)).toEqual([" ✓ read ×1 · grep ×1"]);
			message.updateContent(
				{
					role: "assistant",
					content: [{ type: "text", text: "Checking more" }],
				} as AssistantMessage,
				true,
			);
			expect(summaries(chat)).toEqual([" ✓ read ×1", " ✓ grep ×1"]);
		},
	);

	it("uses the exact original rendering when expanded, including diffs and repeated toggles", () => {
		const tools = [
			"read",
			"bash",
			"edit",
			"write",
			"grep",
			"find",
			"ls",
			"custom",
		].map((name) => tool(name));
		const chat = container(assistant("Checking files"), ...tools);
		const compact = chat.render(120);
		for (let iteration = 0; iteration < 3; iteration++) {
			for (const row of tools) row.setExpanded(true);
			for (const width of [40, 120]) {
				expect(chat.render(width)).toEqual(nativeRender.call(chat, width));
			}
			expect(summaries(chat)).toEqual([]);
			for (const row of tools) row.setExpanded(false);
			expect(chat.render(120)).toEqual(compact);
		}
	});

	it("hides inline images in the summary and restores the original image output on expansion", () => {
		setCapabilities({ images: "iterm2", trueColor: false, hyperlinks: false });
		const read = tool("read", false);
		read.updateResult({
			content: [
				{
					type: "image",
					mimeType: "image/png",
					data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN2kAAAAASUVORK5CYII=",
				},
			],
			isError: false,
		});
		const chat = container(read);
		expect(plainLines(chat)).toEqual(["", " ✓ read ×1"]);
		read.setExpanded(true);
		expect(chat.render(80)).toEqual(nativeRender.call(chat, 80));
		expect(chat.render(80).join("\n")).toContain("\x1b]1337;File=");
	});

	it("derives groups from the current tree after resume, clearing and reconstruction", () => {
		const chat = container(tool("read"), tool("read"));
		expect(summaries(chat)).toEqual([" ✓ read ×2"]);
		chat.clear();
		chat.addChild(tool("bash"));
		expect(summaries(chat)).toEqual([]);
		const resumed = container(tool("grep"), assistant(), tool("find"));
		expect(summaries(resumed)).toEqual([" ✓ grep ×1 · find ×1"]);
		expect(summaries(chat)).toEqual([]);
	});

	it("leaves the original display visible if Pi's private field contract changes", () => {
		const read = tool("read");
		Object.assign(read, { isPartial: undefined });
		const chat = container(read);
		expect(chat.render(80)).toEqual(nativeRender.call(chat, 80));
		expect(summaries(chat)).toEqual([]);
	});

	it("keeps Pi 0.85+ mouse hit regions aligned with compact output", () => {
		const bash = tool("bash", false);
		const chat = container(tool("read"), bash, tool("grep"));
		const mouseContainer = Object.assign(chat, {
			mouseLayout: undefined as
				| {
						width: number;
						children: Array<{ component: Container; height: number }>;
				  }
				| undefined,
		});
		const output = chat.render(80);
		const layout = mouseContainer.mouseLayout;
		expect(layout?.width).toBe(80);
		expect(layout?.children).toHaveLength(2);
		expect(layout?.children[0]?.height).toBe(2);
		expect(layout?.children[0]?.component.render(80)).toEqual(
			output.slice(0, 2),
		);
		expect(layout?.children[1]?.component).toBe(bash);
		expect(layout?.children[1]?.height).toBe(bash.render(80).length);
		expect(layout?.children.reduce((sum, child) => sum + child.height, 0)).toBe(
			output.length,
		);
	});

	it("does not alter unrelated containers", () => {
		const panel = new Container();
		panel.addChild(new Text("Ordinary text", 1, 1));
		expect(panel.render(80)).toEqual(nativeRender.call(panel, 80));
	});

	it.each([1, 2, 10, 30, 120])(
		"keeps the summary within %i terminal columns",
		(width) => {
			const chat = container(tool("read"), tool("bash"), tool("日本語"));
			const lines = chat.render(width);
			expect(lines).toHaveLength(2);
			for (const line of lines)
				expect(visibleWidth(line)).toBeLessThanOrEqual(width);
		},
	);

	it("reads the current theme on every render", () => {
		uninstall();
		const first = { fg: vi.fn(theme.fg) };
		const second = { fg: vi.fn(theme.fg) };
		let current = first;
		uninstall = installToolSummary(() => current);
		const read = tool("read");
		const chat = container(read);
		chat.render(80);
		expect(first.fg).toHaveBeenCalledWith("success", " ✓ read ×1");
		current = second;
		chat.render(80);
		expect(second.fg).toHaveBeenCalledWith("success", " ✓ read ×1");
		finish(read, true);
		second.fg.mockClear();
		expect(chat.render(80)).toEqual(read.render(80));
		expect(second.fg).not.toHaveBeenCalled();
	});

	it("restores the original renderer on uninstall", () => {
		const chat = container(tool("read"), tool("bash"));
		uninstall();
		expect(Container.prototype.render).toBe(nativeRender);
		expect(chat.render(80)).toEqual(nativeRender.call(chat, 80));
		uninstall();
		expect(Container.prototype.render).toBe(nativeRender);
	});

	it("does not clobber a later extension wrapper and disables its own rendering", () => {
		const ours = Container.prototype.render;
		function later(this: Container, width: number): string[] {
			return ours.call(this, width);
		}
		Container.prototype.render = later;
		try {
			uninstall();
			expect(Container.prototype.render).toBe(later);
			const chat = container(tool("read"));
			expect(chat.render(80)).toEqual(nativeRender.call(chat, 80));
		} finally {
			Container.prototype.render = nativeRender;
		}
	});
});
