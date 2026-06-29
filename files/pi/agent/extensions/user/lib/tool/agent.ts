import { fileURLToPath } from "node:url";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import {
	type AgentToolResult,
	type AgentToolUpdateCallback,
	type ExtensionContext,
	RpcClient,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import {
	type Component,
	Text,
	sliceByColumn,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import { type TSchema, Type } from "typebox";
import { type ToolCatalog, defineToolContribution } from "./catalog";
import {
	confirmFocusTransition,
	isFocusAllowedForSession,
} from "../focus/confirmation";
import { type Color, colors, fg } from "../theme";
import { formatHumanElapsed, formatLiveElapsed } from "../time";
export const AGENT_TOOL = "agent";

/** A focus that may be launched as an agent (name + human description). */
export type SpawnableFocus = {
	readonly name: string;
	readonly description?: string;
	/** The focus transition type (e.g. "auto", "confirm", "manual"). */
	readonly transition?: string;
};

type AgentInput = {
	readonly focus: string;
	readonly prompt: string;
	readonly title: string;
};

/** Mutable set of spawnable focus names, initialised at tool registration time
 * and extendable later (e.g. with project-defined focuses after session start).
 * The agent execute handler closes over this same Set reference, so updates
 * are visible to all future invocations. */
const spawnableFocusNames = new Set<string>();

/** Mutable set of focus names that require user confirmation before spawning. */
const confirmFocusNames = new Set<string>();

/** Extend the spawnable focus set with additional focuses at runtime. */
export function extendSpawnableFocuses(
	focuses: readonly SpawnableFocus[],
): void {
	for (const f of focuses) spawnableFocusNames.add(f.name);
}

/** Extend the confirm-transition focus set at runtime. */
export function extendConfirmFocuses(names: readonly string[]): void {
	for (const n of names) confirmFocusNames.add(n);
}
/**
 * Build the parameter schema. When the set of spawnable focuses is known, the
 * `focus` field is constrained to those names (enum) and each is enumerated in
 * the description so the LLM can pick the right one. When unknown (e.g. unit
 * tests registering the tool standalone), it falls back to a free-form string.
 */
function buildAgentSchema(focuses: readonly SpawnableFocus[]): TSchema {
	const focusList = focuses
		.map((f) => (f.description ? `${f.name} — ${f.description}` : f.name))
		.join("; ");
	const focusDescription =
		focuses.length > 0
			? `Name of the focus the agent should use. Available: ${focusList}.`
			: "Name of the focus the agent should use.";
	return Type.Object({
		focus: Type.String({ description: focusDescription }),
		prompt: Type.String({
			description:
				"Task instruction to pass to the agent. Be specific and self-contained.",
		}),
		title: Type.String({
			description:
				"Short label for the agent task (3–5 words). Defaults to focus name.",
		}),
	});
}

/**
 * Maximum time to wait for the agent to go idle, in milliseconds. Override
 * with `PI_AGENT_TIMEOUT_MS`. Defaults to 10 minutes so that genuinely long
 * delegated work is not cut short mid-task.
 */
const AGENT_TIMEOUT_MS = (() => {
	const raw = Number(process.env.PI_AGENT_TIMEOUT_MS);
	return Number.isFinite(raw) && raw > 0 ? raw : 600_000;
})();

export type AgentDetails = {
	readonly usage?: {
		readonly inputTokens: number;
		readonly outputTokens: number;
		readonly cacheReadTokens: number;
		readonly cacheWriteTokens: number;
		readonly totalTokens: number;
		readonly cost: number;
	};
	readonly toolCallCount: number;
	readonly durationMs: number;
	readonly stderr?: string;
	readonly toolCalls?: readonly ToolCallRecord[];
	/** @internal */
	readonly _status?: string;
	/** @internal */
	readonly _runningLine?: string;
	/** @internal */
	readonly currentTool?: string;
	/** Original prompt that was passed to the agent. */
	readonly prompt?: string;
	/** Title passed to the agent. */
	readonly title?: string;
	/** Focus the agent runs in. */
	readonly focus?: string;
};
type AgentResult = AgentToolResult<AgentDetails>;
/** A result flagged as an error (the `isError` flag is an extension of the base shape). */
type AgentErrorResult = AgentResult & { isError: true };

function truncateMiddleToWidth(text: string, width: number): string {
	if (visibleWidth(text) <= width) return text;
	if (width <= 1) return truncateToWidth(text, width, "");

	const ellipsis = "…";
	const remainingWidth = width - visibleWidth(ellipsis);
	const headWidth = Math.ceil(remainingWidth / 2);
	const tailWidth = Math.floor(remainingWidth / 2);
	const textWidth = visibleWidth(text);
	return `${sliceByColumn(text, 0, headWidth, true)}${ellipsis}${sliceByColumn(text, textWidth - tailWidth, tailWidth, true)}`;
}

function truncateAgentLine(line: string, width: number): string {
	if (visibleWidth(line) <= width) return line;

	const argsStart = line.indexOf(" (");
	const argsEnd = line.lastIndexOf(")");
	if (argsStart === -1 || argsEnd <= argsStart + 2) {
		return truncateToWidth(line, width, "");
	}

	const prefix = line.slice(0, argsStart + 2);
	const args = line.slice(argsStart + 2, argsEnd);
	const suffix = line.slice(argsEnd);
	const argsWidth = width - visibleWidth(prefix) - visibleWidth(suffix);
	if (argsWidth <= 0) return truncateToWidth(line, width, "");

	return `${prefix}${truncateMiddleToWidth(args, argsWidth)}${suffix}`;
}

/** Render each input line as one terminal row by truncating instead of wrapping. */
class OneLinePerRowText implements Component {
	constructor(private readonly text: string) {}

	render(width: number): string[] {
		return this.text.split("\n").map((line) => truncateAgentLine(line, width));
	}

	invalidate(): void {}
}

/** Format the one-line call display: `agent <title> in <focus>`. */
function renderAgentCall(rawArgs: unknown, theme: Theme): Component {
	const args = rawArgs as AgentInput;
	const titlePart = args.title || null;
	const titleDisplay = titlePart
		? theme.fg("accent", titlePart)
		: theme.fg("dim", "...");
	const focusPart = theme.fg("toolOutput", ` in ${args.focus || "..."}`);
	const text = `${theme.bold("agent")} ${titleDisplay}${focusPart}`;
	return new Text(text, 0, 0);
}

/**
 * Determine the icon and state label for a finalized result. Partial/streaming
 * frames render their own state line (see `renderAgentResult`), so this is
 * only ever called for the terminal state.
 */
function getStateDisplay(
	details: AgentDetails | undefined,
	theme: Theme,
): string {
	if (details?.["_status"] === "aborted") {
		return `${theme.fg("error", "✗")} ${theme.fg("dim", "Cancelled")}`;
	}
	if (details?.stderr) {
		return `${theme.fg("error", "✗")} ${theme.fg("error", "Error")}`;
	}
	return `${fg(colors.positive, "✓")} ${theme.fg("dim", "Completed")}`;
}

function renderAgentResult(
	result: AgentToolResult<AgentDetails>,
	options: { expanded: boolean; isPartial: boolean },
	theme: Theme,
): Component {
	if (options.isPartial) {
		const text = result.content
			.filter((c) => c.type === "text")
			.map((c) => c.text)
			.join("\n");
		if (!options.expanded) return new OneLinePerRowText(text);

		const promptText = result.details?.prompt?.trim();
		const toolCalls = result.details?.toolCalls ?? [];
		const toolText = formatToolCallRecords(toolCalls, { truncateArgs: false });
		const runningLine = result.details?.["_runningLine"];
		const statusText = runningLine ?? text.trim();
		const runningParts = [
			promptText ? `${theme.fg("dim", "prompt:")}\n${promptText}` : undefined,
			toolText ? `${theme.fg("dim", "tools:")}\n${toolText}` : undefined,
			statusText,
		].filter((part): part is string => part !== undefined && part.length > 0);
		return new Text(runningParts.join("\n\n"), 0, 0);
	}

	const isAborted = result.details?.["_status"] === "aborted";
	const durationMs = result.details?.durationMs ?? 0;
	const duration = formatHumanElapsed(durationMs);
	const toolCount = result.details?.toolCallCount ?? 0;
	const usage = result.details?.usage;
	const tokenStr = usage
		? `, ${(usage.inputTokens / 1000).toFixed(1)}K in / ${(usage.outputTokens / 1000).toFixed(1)}K out`
		: "";
	const stats = `${duration} (${toolCount} tool${toolCount !== 1 ? "s" : ""} used${tokenStr})`;

	if (!options.expanded) {
		// Collapsed – state + stats
		const stateDisplay = getStateDisplay(result.details, theme);
		if (result.details?.stderr && !isAborted) {
			const errorText = result.content
				.filter((c) => c.type === "text")
				.map((c) => c.text)
				.join("\n");
			return new OneLinePerRowText(
				`${stateDisplay} ${theme.fg("error", errorText)} ${theme.fg("dim", stats)}`,
			);
		}
		return new OneLinePerRowText(`${stateDisplay} ${theme.fg("dim", stats)}`);
	}

	// Expanded – prompt + response + state + stats
	const contentText = result.content
		.filter((c) => c.type === "text")
		.map((c) => c.text)
		.join("\n")
		.trim();
	const promptText = result.details?.prompt?.trim();
	const stateDisplay = getStateDisplay(result.details, theme);
	const expandedText = isAborted
		? `${promptText ? `${theme.fg("dim", "prompt:")}\n${promptText}\n\n` : ""}${stateDisplay} ${theme.fg("dim", stats)}`
		: [
				promptText ? `${theme.fg("dim", "prompt:")}\n${promptText}` : undefined,
				`${theme.fg("dim", "response:")}\n${contentText}`,
				`${stateDisplay} ${theme.fg("dim", stats)}`,
			]
				.filter((part): part is string => part !== undefined)
				.join("\n\n");
	return new Text(expandedText, 0, 0);
}

/** Format a single tool-call argument value for display. */
function formatArg(v: unknown, options: { truncate: boolean }): string {
	if (typeof v === "string") {
		return options.truncate && v.length > 80
			? `"${v.slice(0, 80)}…"`
			: `"${v}"`;
	}
	if (typeof v === "number" || typeof v === "boolean" || v == null) {
		return String(v);
	}
	try {
		const json = JSON.stringify(v);
		if (!json) return String(v);
		return options.truncate && json.length > 120
			? `${json.slice(0, 120)}…`
			: json;
	} catch {
		return Object.prototype.toString.call(v);
	}
}
function formatToolCallRecords(
	toolCalls: readonly ToolCallRecord[],
	options: { truncateArgs?: boolean } = {},
): string {
	return toolCalls
		.map((_, index) => formatToolCallRecord(toolCalls, index, options))
		.join("\n");
}

function formatToolCallRecord(
	toolCalls: readonly ToolCallRecord[],
	index: number,
	options: { truncateArgs?: boolean } = {},
): string {
	const minDurationMs = 1000;
	const tc = toolCalls[index];
	const next = toolCalls[index + 1];
	const duration = next ? next.startTime - tc.startTime : undefined;
	const p = Object.entries(tc.args)
		.filter(([, v]) => v !== undefined)
		.map(
			([k, v]) =>
				`${k}=${formatArg(v, { truncate: options.truncateArgs ?? true })}`,
		)
		.join(", ");
	const argsStr = p ? ` (${p})` : "";
	const durationStr =
		duration !== undefined && duration >= minDurationMs
			? `  ${formatLiveElapsed(duration)}`
			: "";
	const runningMarker =
		index === toolCalls.length - 1 ? `  ${fg(colors.muted, "← running")}` : "";
	return fg(
		colors.muted,
		`${String(index + 1).padStart(2)}. ${tc.name}${argsStr}${durationStr}${runningMarker}`,
	);
}

/** Resolve the pi CLI entry point so RpcClient can spawn a child process. */
function resolvePiCliPath(): string {
	const piEntryUrl = import.meta.resolve("@earendil-works/pi-coding-agent");
	const entryPath = fileURLToPath(piEntryUrl);
	const cliPath = entryPath.replace(/\/dist\/index\.js$/u, "/dist/cli.js");
	if (cliPath === entryPath) {
		throw new Error(
			`Unable to derive pi CLI path from package entry: ${entryPath}`,
		);
	}
	return cliPath;
}

type ToolCallRecord = {
	readonly name: string;
	readonly args: Record<string, unknown>;
	readonly startTime: number;
};

function addAssistantUsage(
	current: AgentDetails["usage"] | undefined,
	message: AssistantMessage,
): AgentDetails["usage"] {
	const usage = message.usage;
	return {
		inputTokens: (current?.inputTokens ?? 0) + (usage.input ?? 0),
		outputTokens: (current?.outputTokens ?? 0) + (usage.output ?? 0),
		cacheReadTokens: (current?.cacheReadTokens ?? 0) + (usage.cacheRead ?? 0),
		cacheWriteTokens:
			(current?.cacheWriteTokens ?? 0) + (usage.cacheWrite ?? 0),
		totalTokens:
			(current?.totalTokens ?? 0) +
			(usage.totalTokens ??
				(usage.input ?? 0) +
					(usage.output ?? 0) +
					(usage.cacheRead ?? 0) +
					(usage.cacheWrite ?? 0)),
		cost: (current?.cost ?? 0) + (usage.cost?.total ?? 0),
	};
}

/**
 * Owns the live progress UI for a running agent: the initial "starting"
 * frame, the rolling tool tail (latest 3 tools, older ones summarized), and the
 * 1s heartbeat timer. Keeping all `onUpdate` emission here lets `execute` deal
 * only with lifecycle and final results.
 */
class AgentProgress {
	private readonly toolCalls: ToolCallRecord[] = [];
	private lastTail = "";
	private timer: ReturnType<typeof setInterval> | undefined;
	private usage: AgentDetails["usage"] | undefined;

	constructor(
		private readonly startedAt: number,
		private readonly title: string | undefined,
		private readonly focus: string,
		private readonly prompt: string,
		private readonly onUpdate:
			| AgentToolUpdateCallback<AgentDetails>
			| undefined,
	) {}

	/** Number of tool calls observed so far. */
	get count(): number {
		return this.toolCalls.length;
	}

	/** Emit the initial "starting" frame and begin the heartbeat. */
	start(): void {
		if (!this.onUpdate) return;
		this.emitStarting();
		this.timer = setInterval(() => this.emitStarting(), 120);
	}

	/** Record a `tool_execution_start` event and refresh the live display. */
	recordToolStart(toolName: string, args: Record<string, unknown>): void {
		this.toolCalls.push({ name: toolName, args, startTime: Date.now() });
		this.lastTail = this.buildTail(false);
		this.emitProgress();
		this.restartRunningTimer();
	}

	/** Accumulate finalized child assistant usage and refresh parent live details. */
	recordAssistantUsage(message: AssistantMessage): void {
		this.usage = addAssistantUsage(this.usage, message);
		this.emitProgress();
	}

	/** Snapshot the observed tool calls for terminal rendering. */
	snapshot(): readonly ToolCallRecord[] {
		return [...this.toolCalls];
	}

	/** Stop the heartbeat timer (idempotent). */
	stop(): void {
		clearInterval(this.timer);
	}

	private elapsedMs(): number {
		return Date.now() - this.startedAt;
	}

	private elapsedLabel(): string {
		return formatLiveElapsed(this.elapsedMs());
	}

	private get runningIcon(): string {
		return Math.floor(this.elapsedMs() / 600) % 2 === 0 ? "◉" : "○";
	}

	private get glossyRunningLabel(): string {
		// A brightness wave flows left-to-right across "Running", wrapping around.
		// Position is derived from elapsed time so it advances smoothly between
		// timer ticks; a Gaussian profile gives each character a soft gradient
		// between the positive (green) colour and a bright green.
		const text = "Running";
		const len = text.length;
		const speedMs = 220; // ms per character (~1.5s per full sweep)
		const pos = (this.elapsedMs() / speedMs) % len;
		const sigma = 1.3;
		return text
			.split("")
			.map((char, i) => {
				let dist = Math.abs(i - pos);
				dist = Math.min(dist, len - dist);
				const brightness = Math.exp(-(dist * dist) / (2 * sigma * sigma));
				return fg(this.shineColor(brightness), char);
			})
			.join("");
	}

	private shineColor(brightness: number): Color {
		const [r, g, b] = colors.positive;
		const t = Math.max(0, Math.min(1, brightness));
		// Peak at a bright green (200, 255, 200) instead of pure white
		return [
			Math.round(r + (200 - r) * t),
			Math.round(g + (255 - g) * t),
			Math.round(b + (200 - b) * t),
		] as Color;
	}

	private runningLine(): string {
		return `${fg(colors.positive, this.runningIcon)} ${this.glossyRunningLabel}  ${this.elapsedLabel()}`;
	}

	private emitStarting(): void {
		const runningLine = `${fg(colors.positive, this.runningIcon)} ${this.glossyRunningLabel}  ${this.elapsedLabel()}`;
		this.onUpdate?.({
			content: [
				{
					type: "text",
					text: `${fg(colors.muted, "(starting...)")}\n${runningLine}`,
				},
			],
			details: this.details("starting", runningLine),
		});
	}

	private emitProgress(): void {
		if (!this.onUpdate) return;
		if (this.count === 0) {
			this.emitStarting();
			return;
		}

		const runningLine = this.runningLine();
		this.onUpdate({
			content: [
				{
					type: "text",
					text: `${this.lastTail}\n${runningLine}`,
				},
			],
			details: this.details(
				"running",
				runningLine,
				this.toolCalls.at(-1)?.name,
			),
		});
	}

	private restartRunningTimer(): void {
		clearInterval(this.timer);
		if (!this.onUpdate) return;
		this.timer = setInterval(() => this.emitProgress(), 120);
	}

	private details(
		status: "starting" | "running",
		runningLine: string,
		currentTool?: string,
	): AgentDetails {
		return {
			_status: status,
			_runningLine: runningLine,
			currentTool,
			toolCallCount: this.count,
			toolCalls: this.toolCalls,
			durationMs: this.elapsedMs(),
			title: this.title,
			focus: this.focus,
			prompt: this.prompt,
			usage: this.usage,
		};
	}

	private promptBlock(): string {
		return `${fg(colors.muted, "prompt:")}\n${this.prompt.trim()}`;
	}

	/** Build the tool list. Collapsed views show the latest 3; expanded views show all. */
	private buildTail(expanded: boolean): string {
		const maxVisible = expanded ? this.toolCalls.length : 3;
		const lines: string[] = [];
		const lastIndex = this.toolCalls.length - 1;
		const firstVisible = Math.max(0, this.toolCalls.length - maxVisible);

		const hidden = firstVisible;
		if (hidden > 0) {
			lines.push(
				fg(
					colors.muted,
					`── (other ${hidden} tool${hidden !== 1 ? "s" : ""}...) ──`,
				),
			);
		}

		for (let index = firstVisible; index <= lastIndex; index++) {
			lines.push(formatToolCallRecord(this.toolCalls, index));
		}
		return lines.join("\n");
	}
}

/**
 * Wire abort propagation from `signal` to the running RpcClient. Returns a
 * cleanup function (or undefined when there is nothing to clean up), and invokes
 * `markAborted` so the caller can branch on cancellation after `waitForIdle`.
 */
function wireAbort(
	signal: AbortSignal | undefined,
	client: RpcClient,
	markAborted: () => void,
): (() => void) | undefined {
	if (!signal) return undefined;
	const onAbort = (): void => {
		markAborted();
		client.abort().catch(() => {});
	};
	if (signal.aborted) {
		onAbort();
		return undefined;
	}
	signal.addEventListener("abort", onAbort, { once: true });
	return () => signal.removeEventListener("abort", onAbort);
}

/** Map RpcClient session stats into the `usage` shape of `AgentDetails`. */
function buildUsage(
	stats: Awaited<ReturnType<RpcClient["getSessionStats"]>> | undefined,
): AgentDetails["usage"] {
	if (!stats) return undefined;
	return {
		inputTokens: stats.tokens.input,
		outputTokens: stats.tokens.output,
		cacheReadTokens: stats.tokens.cacheRead,
		cacheWriteTokens: stats.tokens.cacheWrite,
		totalTokens: stats.tokens.total,
		cost: stats.cost,
	};
}

/**
 * Reject a focus that is not in the spawnable set before any process is spawned.
 * Returns the error result, or undefined when the focus is allowed (or when no
 * allow-list is configured, e.g. standalone unit tests).
 */
function rejectNonSpawnableFocus(
	allowedFocusNames: ReadonlySet<string>,
	input: AgentInput,
): AgentErrorResult | undefined {
	if (allowedFocusNames.size === 0 || allowedFocusNames.has(input.focus)) {
		return undefined;
	}
	return {
		content: [
			{
				type: "text" as const,
				text: `Agent focus "${input.focus}" does not exist.`,
			},
		],
		details: {
			focus: input.focus,
			title: input.title,
			prompt: input.prompt,
			toolCallCount: 0,
			durationMs: 0,
			stderr: `unknown spawnable focus: ${input.focus}`,
		} satisfies AgentDetails,
		isError: true,
	};
}

/**
 * Build the agent `execute` handler, capturing the resolved CLI path and the
 * spawnable allow-list. Kept out of the tool definition object so the (long)
 * lifecycle logic reads as a standalone unit: validate → spawn → stream
 * progress → return the terminal result.
 */
const createAgentExecute =
	(cliPath: string, allowedFocusNames: ReadonlySet<string>) =>
	async (
		_toolCallId: string,
		params: unknown,
		signal: AbortSignal | undefined,
		onUpdate: AgentToolUpdateCallback<AgentDetails> | undefined,
		ctx: ExtensionContext,
	): Promise<AgentResult> => {
		const input = params as AgentInput;
		const rejection = rejectNonSpawnableFocus(allowedFocusNames, input);
		if (rejection) return rejection;

		/* Confirm-transition focuses require user permission before spawning */
		if (confirmFocusNames.has(input.focus)) {
			if (!ctx.hasUI) {
				const err: AgentErrorResult = {
					content: [
						{
							type: "text" as const,
							text: `Cannot spawn agent: focus "${input.focus}" requires interactive confirmation.`,
						},
					],
					details: {
						focus: input.focus,
						title: input.title,
						prompt: input.prompt,
						toolCallCount: 0,
						durationMs: 0,
						stderr: `denied: no interactive confirmation available for focus "${input.focus}"`,
					} satisfies AgentDetails,
					isError: true,
				};
				return err;
			}

			/* Re-check session state in case a parallel agent already obtained permission */
			if (isFocusAllowedForSession(input.focus)) {
				/* Already allowed this session — skip dialog */
			} else {
				const decision = await confirmFocusTransition(
					ctx,
					"agent",
					input.focus,
					input.title,
					input.prompt,
				);
				if (!decision || decision.choice.startsWith("deny")) {
					const reason = decision?.rejectReason;
					const text = reason
						? `User denied agent in focus "${input.focus}": ${reason}`
						: `User denied agent in focus "${input.focus}".`;
					const err: AgentErrorResult = {
						content: [{ type: "text" as const, text }],
						details: {
							focus: input.focus,
							title: input.title,
							prompt: input.prompt,
							toolCallCount: 0,
							durationMs: 0,
							stderr: reason ?? `denied by user: "${input.focus}"`,
						} satisfies AgentDetails,
						isError: true,
					};
					return err;
				}
				// A session-level decision (allow/deny "for this session") is
				// persisted inside confirmFocusTransition while it holds the UI
				// lock, so parallel agents racing on the same focus observe it
				// without prompting again. Nothing to remember here.
			}
		}
		const { focus, prompt, title } = input;
		const header = `${title ?? focus} (focus=${focus})`;
		const startedAt = Date.now();
		const progress = new AgentProgress(
			startedAt,
			title,
			focus,
			prompt,
			onUpdate,
		);

		const client = new RpcClient({
			cliPath,
			cwd: ctx.cwd,
			env: { PI_AGENT: "1" },
			args: ["--focus", focus, "--no-session", "--exclude-tools", AGENT_TOOL],
		});

		// Build the terminal result for a cancelled run (also notifies the UI).
		const cancelledResult = (durationMs: number): AgentErrorResult => {
			const details: AgentDetails = {
				toolCallCount: progress.count,
				durationMs,
				prompt,
				title,
				focus,
				toolCalls: progress.snapshot(),
				_status: "aborted",
			};
			onUpdate?.({
				content: [{ type: "text", text: `${header} was cancelled` }],
				details,
			});
			return {
				content: [{ type: "text" as const, text: `${header} was cancelled` }],
				details,
				isError: true,
			};
		};

		// Build the terminal result for a successful run.
		const completedResult = (
			text: string | null | undefined,
			durationMs: number,
			stats: Awaited<ReturnType<RpcClient["getSessionStats"]>> | undefined,
		): AgentResult => ({
			content: [
				{
					type: "text" as const,
					text: `\n${text ?? "(agent produced no output)"}`,
				},
			],
			details: {
				toolCallCount: progress.count,
				durationMs,
				prompt,
				title,
				focus,
				toolCalls: progress.snapshot(),
				usage: buildUsage(stats),
			},
		});

		// Build the terminal result for a failed run (also notifies the UI).
		const failedResult = (error: unknown): AgentErrorResult => {
			const message = error instanceof Error ? error.message : String(error);
			const stderr = client.getStderr();
			const durationMs = Date.now() - startedAt;
			onUpdate?.({
				content: [{ type: "text", text: `${header} failed: ${message}` }],
				details: {
					_status: "error",
					stderr: stderr || undefined,
					toolCallCount: progress.count,
					toolCalls: progress.snapshot(),
					durationMs,
					prompt,
					title,
					focus,
				},
			});
			return {
				content: [
					{ type: "text" as const, text: `${header} failed: ${message}` },
				],
				details: {
					toolCallCount: progress.count,
					durationMs,
					prompt,
					title,
					focus,
					toolCalls: progress.snapshot(),
					stderr: stderr || undefined,
				},
				isError: true,
			};
		};

		let aborted = false;
		progress.start();
		const signalCleanup = wireAbort(signal, client, () => {
			aborted = true;
		});
		let unsubscribe: (() => void) | undefined;

		try {
			await client.start();

			unsubscribe = client.onEvent((event) => {
				if (event.type === "tool_execution_start") {
					const ev = event as {
						toolName: string;
						args: Record<string, unknown>;
					};
					progress.recordToolStart(ev.toolName, ev.args ?? {});
					return;
				}

				if (
					event.type === "message_end" &&
					event.message.role === "assistant" &&
					event.message.usage
				) {
					progress.recordAssistantUsage(event.message as AssistantMessage);
				}
			});

			await client.prompt(prompt);
			await client.waitForIdle(AGENT_TIMEOUT_MS);

			const text = await client.getLastAssistantText();
			const durationMs = Date.now() - startedAt;
			const stats = await client.getSessionStats().catch(() => undefined);

			return aborted
				? cancelledResult(durationMs)
				: completedResult(text, durationMs, stats);
		} catch (error) {
			return failedResult(error);
		} finally {
			progress.stop();
			unsubscribe?.();
			signalCleanup?.();
			await client.stop().catch(() => {});
		}
	};

export function registerAgentTool(
	catalog: ToolCatalog,
	spawnableFocuses: readonly SpawnableFocus[] = [],
): void {
	confirmFocusNames.clear();
	for (const f of spawnableFocuses) {
		spawnableFocusNames.add(f.name);
		if (f.transition === "confirm") confirmFocusNames.add(f.name);
	}
	const cliPath = resolvePiCliPath();
	catalog.register(
		defineToolContribution({
			policy: {
				name: AGENT_TOOL,
				notAllowedReason: (focus) =>
					`agent can only be used when no focus is active. Current focus: ${focus}. Use enter_focus to exit the current focus first.`,
			},
			definition: {
				name: AGENT_TOOL,
				label: "agent",
				description:
					"Spawn an agent (child agent) to work on an isolated subtask in the specified focus. Multiple agents can be called in the same turn and run in parallel. Returns only the agent's final message.",
				promptSnippet: "Spawn an agent for an isolated subtask",
				promptGuidelines: [
					"Use agent to delegate independent subtasks to a child agent running in a specific focus.",
					"Multiple agent calls in the same turn run in parallel via executionMode: 'parallel'.",
					"The agent receives the focus prompt and tools, and returns only its final message.",
					"Agents cannot spawn further agents (single level only).",
					"Choose the focus that matches the subtask; the focus parameter lists the available focuses and what each is for.",
				],
				parameters: buildAgentSchema(spawnableFocuses),
				executionMode: "parallel",
				renderCall: renderAgentCall,
				renderResult: renderAgentResult,
				execute: createAgentExecute(cliPath, spawnableFocusNames),
			},
			isErrorResult: (details) => {
				if (!details) return false;
				const d = details as AgentDetails;
				return d.stderr !== undefined || d["_status"] === "aborted";
			},
		}),
	);
}
