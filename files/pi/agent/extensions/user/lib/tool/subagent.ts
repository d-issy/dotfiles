import { fileURLToPath } from "node:url";
import {
	type AgentToolResult,
	type AgentToolUpdateCallback,
	type ExtensionContext,
	RpcClient,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import { type Component, Text } from "@earendil-works/pi-tui";
import { type TSchema, Type } from "typebox";
import { type ToolCatalog, defineToolContribution } from "./catalog";
import { colors, fg } from "../theme";
export const SUBAGENT_TOOL = "subagent";

/** A focus that may be launched as a subagent (name + human description). */
export type SpawnableFocus = {
	readonly name: string;
	readonly description?: string;
};

type SubagentInput = {
	readonly focus: string;
	readonly prompt: string;
	readonly title?: string;
};

/**
 * Build the parameter schema. When the set of spawnable focuses is known, the
 * `focus` field is constrained to those names (enum) and each is enumerated in
 * the description so the LLM can pick the right one. When unknown (e.g. unit
 * tests registering the tool standalone), it falls back to a free-form string.
 */
function buildSubagentSchema(focuses: readonly SpawnableFocus[]): TSchema {
	const focusList = focuses
		.map((f) => (f.description ? `${f.name} — ${f.description}` : f.name))
		.join("; ");
	const focusDescription =
		focuses.length > 0
			? `Name of the focus the subagent should use. Available: ${focusList}.`
			: "Name of the focus the subagent should use.";
	const focusSchema =
		focuses.length > 0
			? Type.Union(
					focuses.map((f) => Type.Literal(f.name)),
					{ description: focusDescription },
				)
			: Type.String({ description: focusDescription });
	return Type.Object({
		focus: focusSchema,
		prompt: Type.String({
			description:
				"Task instruction to pass to the subagent. Be specific and self-contained.",
		}),
		title: Type.Optional(
			Type.String({
				description:
					"Short label for the subagent task (3–5 words). Defaults to focus name.",
			}),
		),
	});
}

/**
 * Maximum time to wait for the subagent to go idle, in milliseconds. Override
 * with `PI_SUBAGENT_TIMEOUT_MS`. Defaults to 10 minutes so that genuinely long
 * delegated work is not cut short mid-task.
 */
const SUBAGENT_TIMEOUT_MS = (() => {
	const raw = Number(process.env.PI_SUBAGENT_TIMEOUT_MS);
	return Number.isFinite(raw) && raw > 0 ? raw : 600_000;
})();

export type SubagentDetails = {
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
	/** @internal */
	readonly _status?: string;
	/** @internal */
	readonly currentTool?: string;
	/** Original prompt that was passed to the subagent. */
	readonly prompt?: string;
	/** Title passed to the subagent. */
	readonly title?: string;
	/** Focus the subagent runs in. */
	readonly focus?: string;
};

type SubagentResult = AgentToolResult<SubagentDetails>;
/** A result flagged as an error (the `isError` flag is an extension of the base shape). */
type SubagentErrorResult = SubagentResult & { isError: true };

const MAX_TITLE_LEN = 30;

/** Truncate a label to `MAX_TITLE_LEN`, appending an ellipsis when clipped. */
function truncateTitle(label: string): string {
	return label.length > MAX_TITLE_LEN
		? `${label.slice(0, MAX_TITLE_LEN)}…`
		: label;
}

/** Format the one-line call display: `subagent <title> in <focus>`. */
function renderSubagentCall(rawArgs: unknown, theme: Theme): Component {
	const args = rawArgs as SubagentInput;
	const titlePart = args.title ? truncateTitle(args.title) : null;
	const titleDisplay = titlePart ?? theme.fg("dim", "...");
	const inPart = theme.fg("dim", " in ");
	const focusDisplay = args.focus
		? theme.fg("warning", args.focus)
		: theme.fg("dim", "...");
	const text = `${theme.bold("subagent")} ${titleDisplay}${inPart}${focusDisplay}`;
	return new Text(text, 0, 0);
}

/**
 * Determine the icon and state label for a finalized result. Partial/streaming
 * frames render their own state line (see `renderSubagentResult`), so this is
 * only ever called for the terminal state.
 */
function getStateDisplay(
	details: SubagentDetails | undefined,
	theme: Theme,
): string {
	if (details?.["_status"] === "aborted") {
		return `${theme.fg("error", "✗")} ${theme.fg("dim", "Cancelled")}`;
	}
	return `${fg(colors.positive, "✓")} ${theme.fg("dim", "Completed")}`;
}

function renderSubagentResult(
	result: AgentToolResult<SubagentDetails>,
	options: { expanded: boolean; isPartial: boolean },
	theme: Theme,
): Component {
	if (options.isPartial) {
		// Content already includes state line at bottom (from onUpdate)
		const text = result.content
			.filter((c) => c.type === "text")
			.map((c) => c.text)
			.join("\n");
		return new Text(text, 0, 0);
	}

	const isAborted = result.details?.["_status"] === "aborted";
	const durationMs = result.details?.durationMs ?? 0;
	const duration = `${(durationMs / 1000).toFixed(1)}s`;
	const toolCount = result.details?.toolCallCount ?? 0;
	const usage = result.details?.usage;
	const tokenStr = usage
		? `, ${(usage.inputTokens / 1000).toFixed(1)}K in / ${(usage.outputTokens / 1000).toFixed(1)}K out`
		: "";
	const stats = `${duration} (${toolCount} tool${toolCount !== 1 ? "s" : ""} used${tokenStr})`;

	if (!options.expanded) {
		// Collapsed – state + stats
		const stateDisplay = getStateDisplay(result.details, theme);
		return new Text(`${stateDisplay} ${theme.fg("dim", stats)}`, 0, 0);
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
		? `${stateDisplay} ${theme.fg("dim", stats)}`
		: `${theme.fg("dim", "prompt:")}\n${promptText ?? ""}\n\n${theme.fg("dim", "response:")}\n${contentText}\n\n${stateDisplay} ${theme.fg("dim", stats)}`;
	return new Text(expandedText, 0, 0);
}

/** Format a single tool-call argument value for display. */
function formatArg(v: unknown): string {
	if (typeof v === "string") {
		return v.length > 50 ? `"${v.slice(0, 50)}…"` : `"${v}"`;
	}
	if (Array.isArray(v)) return `[${v.join(", ")}]`;
	return String(v);
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

/**
 * Owns the live progress UI for a running subagent: the initial "starting"
 * frame, the rolling tool tail (latest 3 tools, older ones summarized), and the
 * 1s heartbeat timer. Keeping all `onUpdate` emission here lets `execute` deal
 * only with lifecycle and final results.
 */
class SubagentProgress {
	private readonly toolCalls: ToolCallRecord[] = [];
	private lastTail = "";
	private timer: ReturnType<typeof setInterval> | undefined;

	constructor(
		private readonly startedAt: number,
		private readonly title: string | undefined,
		private readonly focus: string,
		private readonly onUpdate:
			| AgentToolUpdateCallback<SubagentDetails>
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
		this.timer = setInterval(() => this.emitStarting(), 1000);
	}

	/** Record a `tool_execution_start` event and refresh the live display. */
	recordToolStart(toolName: string, args: Record<string, unknown>): void {
		this.toolCalls.push({ name: toolName, args, startTime: Date.now() });
		this.lastTail = this.buildTail();
		if (this.onUpdate) {
			this.onUpdate({
				content: [
					{ type: "text", text: `${this.lastTail}\n${this.runningLine()}` },
				],
				details: {
					_status: "running",
					currentTool: toolName,
					toolCallCount: this.count,
					durationMs: this.elapsedMs(),
					title: this.title,
					focus: this.focus,
				},
			});
		}
		this.restartRunningTimer();
	}

	/** Stop the heartbeat timer (idempotent). */
	stop(): void {
		clearInterval(this.timer);
	}

	private elapsedMs(): number {
		return Date.now() - this.startedAt;
	}

	private elapsedLabel(): string {
		return (this.elapsedMs() / 1000).toFixed(1);
	}

	private toolUsageSuffix(): string {
		return this.count > 0
			? ` (${this.count} tool${this.count !== 1 ? "s" : ""} used)`
			: "";
	}

	private runningLine(): string {
		return `${fg(colors.positive, "◉ Running")}  ${this.elapsedLabel()}s${this.toolUsageSuffix()}`;
	}

	private emitStarting(): void {
		this.onUpdate?.({
			content: [
				{
					type: "text",
					text: `${fg(colors.muted, "(starting...)")}\n${fg(colors.positive, "◉ Running")}  ${this.elapsedLabel()}s`,
				},
			],
			details: {
				_status: "starting",
				toolCallCount: 0,
				durationMs: this.elapsedMs(),
				title: this.title,
				focus: this.focus,
			},
		});
	}

	private restartRunningTimer(): void {
		clearInterval(this.timer);
		if (!this.onUpdate) return;
		this.timer = setInterval(() => {
			this.onUpdate?.({
				content: [
					{ type: "text", text: `${this.lastTail}\n${this.runningLine()}` },
				],
				details: {
					_status: "running",
					toolCallCount: this.count,
					durationMs: this.elapsedMs(),
					title: this.title,
					focus: this.focus,
				},
			});
		}, 1000);
	}

	/**
	 * Per-tool own run time: the time until the next tool started. The running
	 * (latest) tool has no successor yet, so it has no duration. This is always a
	 * single tool's elapsed time, never a cumulative total across tools.
	 */
	private ownDurationMs(index: number): number | undefined {
		const lastIndex = this.toolCalls.length - 1;
		if (index >= lastIndex) return undefined;
		return (
			this.toolCalls[index + 1].startTime - this.toolCalls[index].startTime
		);
	}

	/** Build the rolling tail: latest 3 tools shown, older ones summarized. */
	private buildTail(): string {
		const maxVisible = 3;
		// Durations shorter than this are too quick to be meaningful (e.g. they
		// would render as 0.0s), so the tool is still shown but its seconds are
		// omitted.
		const minDurationMs = 1000;
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
			const tc = this.toolCalls[index];
			const duration = this.ownDurationMs(index);
			const p = Object.entries(tc.args)
				.filter(([, v]) => v !== undefined)
				.map(([k, v]) => `${k}=${formatArg(v)}`)
				.join(", ");
			const argsStr = p ? ` (${p})` : "";
			// Show the tool regardless; only hide the seconds when too short.
			const durationStr =
				duration !== undefined && duration >= minDurationMs
					? `  ${(duration / 1000).toFixed(1)}s`
					: "";
			const runningMarker =
				index === lastIndex ? `  ${fg(colors.muted, "← running")}` : "";
			lines.push(
				fg(
					colors.muted,
					`${String(index + 1).padStart(2)}. ${tc.name}${argsStr}${durationStr}${runningMarker}`,
				),
			);
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

/** Map RpcClient session stats into the `usage` shape of `SubagentDetails`. */
function buildUsage(
	stats: Awaited<ReturnType<RpcClient["getSessionStats"]>> | undefined,
): SubagentDetails["usage"] {
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
	input: SubagentInput,
): SubagentErrorResult | undefined {
	if (allowedFocusNames.size === 0 || allowedFocusNames.has(input.focus)) {
		return undefined;
	}
	const available = [...allowedFocusNames].join(", ");
	return {
		content: [
			{
				type: "text" as const,
				text: `Cannot spawn subagent: focus "${input.focus}" is not spawnable. Available focuses: ${available}.`,
			},
		],
		details: {
			focus: input.focus,
			title: input.title,
			prompt: input.prompt,
			toolCallCount: 0,
			durationMs: 0,
			stderr: `unknown spawnable focus: ${input.focus}`,
		} satisfies SubagentDetails,
		isError: true,
	};
}

/**
 * Build the subagent `execute` handler, capturing the resolved CLI path and the
 * spawnable allow-list. Kept out of the tool definition object so the (long)
 * lifecycle logic reads as a standalone unit: validate → spawn → stream
 * progress → return the terminal result.
 */
const createSubagentExecute =
	(cliPath: string, allowedFocusNames: ReadonlySet<string>) =>
	async (
		_toolCallId: string,
		params: unknown,
		signal: AbortSignal | undefined,
		onUpdate: AgentToolUpdateCallback<SubagentDetails> | undefined,
		ctx: ExtensionContext,
	): Promise<SubagentResult> => {
		const input = params as SubagentInput;
		const rejection = rejectNonSpawnableFocus(allowedFocusNames, input);
		if (rejection) return rejection;

		const { focus, prompt, title } = input;
		const header = `${truncateTitle(title ?? focus)} (focus=${focus})`;
		const startedAt = Date.now();
		const progress = new SubagentProgress(startedAt, title, focus, onUpdate);

		const client = new RpcClient({
			cliPath,
			cwd: ctx.cwd,
			env: { PI_SUBAGENT: "1" },
			args: [
				"--focus",
				focus,
				"--no-session",
				"--exclude-tools",
				SUBAGENT_TOOL,
			],
		});

		// Build the terminal result for a cancelled run (also notifies the UI).
		const cancelledResult = (durationMs: number): SubagentErrorResult => {
			const details: SubagentDetails = {
				toolCallCount: progress.count,
				durationMs,
				prompt,
				title,
				focus,
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
		): SubagentResult => ({
			content: [
				{
					type: "text" as const,
					text: `\n${text ?? "(subagent produced no output)"}`,
				},
			],
			details: {
				toolCallCount: progress.count,
				durationMs,
				prompt,
				title,
				focus,
				usage: buildUsage(stats),
			},
		});

		// Build the terminal result for a failed run (also notifies the UI).
		const failedResult = (error: unknown): SubagentErrorResult => {
			const message = error instanceof Error ? error.message : String(error);
			const stderr = client.getStderr();
			const durationMs = Date.now() - startedAt;
			onUpdate?.({
				content: [{ type: "text", text: `${header} failed: ${message}` }],
				details: {
					_status: "error",
					stderr: stderr || undefined,
					toolCallCount: progress.count,
					durationMs,
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
				if (event.type !== "tool_execution_start") return;
				const ev = event as {
					toolName: string;
					args: Record<string, unknown>;
				};
				progress.recordToolStart(ev.toolName, ev.args ?? {});
			});

			await client.prompt(prompt);
			await client.waitForIdle(SUBAGENT_TIMEOUT_MS);

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

export function registerSubagentTool(
	catalog: ToolCatalog,
	spawnableFocuses: readonly SpawnableFocus[] = [],
): void {
	if (process.env.PI_SUBAGENT === "1") return;

	const cliPath = resolvePiCliPath();
	const allowedFocusNames = new Set(spawnableFocuses.map((f) => f.name));

	catalog.register(
		defineToolContribution({
			policy: {
				name: SUBAGENT_TOOL,
				notAllowedReason: (focus) =>
					`subagent can only be used when no focus is active. Current focus: ${focus}. Use enter_focus to exit the current focus first.`,
			},
			definition: {
				name: SUBAGENT_TOOL,
				label: "subagent",
				description:
					"Spawn a subagent (child agent) to work on an isolated subtask in the specified focus. Multiple subagents can be called in the same turn and run in parallel. Returns only the subagent's final message.",
				promptSnippet: "Spawn a subagent for an isolated subtask",
				promptGuidelines: [
					"Use subagent to delegate independent subtasks to a child agent running in a specific focus.",
					"Multiple subagent calls in the same turn run in parallel via executionMode: 'parallel'.",
					"The subagent receives the focus prompt and tools, and returns only its final message.",
					"Subagents cannot spawn further subagents (single level only).",
					"Choose the focus that matches the subtask; the focus parameter lists the available focuses and what each is for.",
				],
				parameters: buildSubagentSchema(spawnableFocuses),
				executionMode: "parallel",
				renderCall: renderSubagentCall,
				renderResult: renderSubagentResult,
				execute: createSubagentExecute(cliPath, allowedFocusNames),
			},
			isErrorResult: (details) => {
				if (!details) return false;
				const d = details as SubagentDetails;
				return d.stderr !== undefined || d["_status"] === "aborted";
			},
		}),
	);
}
