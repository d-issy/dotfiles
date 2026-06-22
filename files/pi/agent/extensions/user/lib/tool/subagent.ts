import { fileURLToPath } from "node:url";
import {
	type AgentToolResult,
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

const MAX_TITLE_LEN = 30;

/** Format the one-line call display: `subagent <title> in <focus>`. */
function renderSubagentCall(rawArgs: unknown, theme: Theme): Component {
	const args = rawArgs as SubagentInput;
	const titlePart = args.title
		? args.title.length > MAX_TITLE_LEN
			? `${args.title.slice(0, MAX_TITLE_LEN)}…`
			: args.title
		: null;
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
				execute: async (_toolCallId, params, signal, onUpdate, ctx) => {
					const { focus, prompt, title } = params as SubagentInput;
					if (allowedFocusNames.size > 0 && !allowedFocusNames.has(focus)) {
						const available = [...allowedFocusNames].join(", ");
						return {
							content: [
								{
									type: "text" as const,
									text: `Cannot spawn subagent: focus "${focus}" is not spawnable. Available focuses: ${available}.`,
								},
							],
							details: {
								focus,
								title,
								prompt,
								toolCallCount: 0,
								durationMs: 0,
								stderr: `unknown spawnable focus: ${focus}`,
							} satisfies SubagentDetails,
							isError: true,
						};
					}
					const headerTitle = title ?? focus;
					const t =
						headerTitle.length > MAX_TITLE_LEN
							? `${headerTitle.slice(0, MAX_TITLE_LEN)}…`
							: headerTitle;
					const header = `${t} (focus=${focus})`;
					const startedAt = Date.now();
					let toolCallCount = 0;
					const allToolCalls: Array<{
						name: string;
						args: Record<string, unknown>;
						startTime: number;
					}> = [];

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
					let signalCleanup: (() => void) | undefined;
					let unsubscribe: (() => void) | undefined;
					let aborted = false;
					let lastTail = "";
					let runningTimer: ReturnType<typeof setInterval> | undefined;
					if (onUpdate) {
						onUpdate({
							content: [
								{
									type: "text" as const,
									text: `${fg(colors.muted, "(starting...)")}\n${fg(colors.positive, "◉ Running")}  0.0s`,
								},
							],
							details: {
								_status: "starting",
								toolCallCount: 0,
								durationMs: 0,
								title,
								focus,
							},
						});
						runningTimer = setInterval(() => {
							const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
							const text = `${fg(colors.muted, "(starting...)")}\n${fg(colors.positive, "◉ Running")}  ${elapsed}s`;
							onUpdate({
								content: [{ type: "text" as const, text }],
								details: {
									_status: "starting",
									toolCallCount: 0,
									durationMs: Date.now() - startedAt,
									title,
									focus,
								},
							});
						}, 1000);
					}

					if (signal) {
						const onAbort = (): void => {
							aborted = true;
							client.abort().catch(() => {});
						};
						if (signal.aborted) {
							onAbort();
						} else {
							signal.addEventListener("abort", onAbort, { once: true });
							signalCleanup = () =>
								signal.removeEventListener("abort", onAbort);
						}
					}

					try {
						await client.start();

						unsubscribe = client.onEvent((event) => {
							if (event.type === "tool_execution_start") {
								toolCallCount++;
								const ev = event as {
									toolName: string;
									args: Record<string, unknown>;
								};
								const toolName = ev.toolName;
								allToolCalls.push({
									name: toolName,
									args: ev.args ?? {},
									startTime: Date.now(),
								});
								// Build tail display: latest 3 tools, older ones summarized
								const maxVisible = 3;
								const shown = allToolCalls.slice(-maxVisible);
								const hidden = allToolCalls.length - shown.length;
								const lines: string[] = [];
								if (hidden > 0) {
									const tailPart = `── (other ${hidden} tool${hidden !== 1 ? "s" : ""}...) ──`;
									lines.push(fg(colors.muted, tailPart));
								}
								const offset = allToolCalls.length - shown.length;
								for (let i = 0; i < shown.length; i++) {
									const tc = shown[i];
									const isRunning = i === shown.length - 1;
									const tcIndex = offset + i + 1;
									const p = Object.entries(tc.args)
										.filter(([, v]) => v !== undefined)
										.map(([k, v]) => `${k}=${formatArg(v)}`)
										.join(", ");
									const argsStr = p ? ` (${p})` : "";
									const durationStr =
										!isRunning && i + 1 < shown.length
											? `  ${((shown[i + 1].startTime - tc.startTime) / 1000).toFixed(1)}s`
											: "";
									const runningMarker = isRunning
										? `  ${fg(colors.muted, "← running")}`
										: "";
									lines.push(
										fg(
											colors.muted,
											`${String(tcIndex).padStart(2)}. ${tc.name}${argsStr}${durationStr}${runningMarker}`,
										),
									);
								}
								lastTail = lines.join("\n");
								const toolUsage =
									toolCallCount > 0
										? ` (${toolCallCount} tool${toolCallCount !== 1 ? "s" : ""} used)`
										: "";
								lines.push(
									`${fg(colors.positive, "◉ Running")}  ${((Date.now() - startedAt) / 1000).toFixed(1)}s${toolUsage}`,
								);
								if (onUpdate) {
									onUpdate({
										content: [{ type: "text", text: lines.join("\n") }],
										details: {
											_status: "running",
											currentTool: toolName,
											toolCallCount,
											durationMs: Date.now() - startedAt,
											title,
											focus,
										},
									});
								}
								clearInterval(runningTimer);
								runningTimer = setInterval(() => {
									const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
									const u =
										toolCallCount > 0
											? ` (${toolCallCount} tool${toolCallCount !== 1 ? "s" : ""} used)`
											: "";
									const text = `${lastTail}\n${fg(colors.positive, "◉ Running")}  ${elapsed}s${u}`;
									if (onUpdate) {
										onUpdate({
											content: [{ type: "text", text }],
											details: {
												_status: "running",
												toolCallCount,
												durationMs: Date.now() - startedAt,
												title,
												focus,
											},
										});
									}
								}, 1000);
							}
						});

						await client.prompt(prompt);

						await client.waitForIdle(SUBAGENT_TIMEOUT_MS);

						const result = await client.getLastAssistantText();
						const durationMs = Date.now() - startedAt;
						const stats = await client.getSessionStats().catch(() => undefined);

						if (aborted) {
							const details: SubagentDetails = {
								toolCallCount,
								durationMs,
								prompt,
								title,
								focus,
								_status: "aborted",
							};
							if (onUpdate) {
								onUpdate({
									content: [{ type: "text", text: `${header} was cancelled` }],
									details: {
										...details,
										_status: "aborted",
									},
								});
							}
							return {
								content: [
									{
										type: "text" as const,
										text: `${header} was cancelled`,
									},
								],
								details,
								isError: true,
							};
						}
						const details: SubagentDetails = {
							toolCallCount,
							durationMs,
							prompt,
							title,
							focus,
							usage: stats
								? {
										inputTokens: stats.tokens.input,
										outputTokens: stats.tokens.output,
										cacheReadTokens: stats.tokens.cacheRead,
										cacheWriteTokens: stats.tokens.cacheWrite,
										totalTokens: stats.tokens.total,
										cost: stats.cost,
									}
								: undefined,
						};

						return {
							content: [
								{
									type: "text" as const,
									text: `\n${result ?? "(subagent produced no output)"}`,
								},
							],
							details,
						};
					} catch (error) {
						const message =
							error instanceof Error ? error.message : String(error);
						const stderr = client.getStderr();

						const details: SubagentDetails = {
							toolCallCount,
							durationMs: Date.now() - startedAt,
							prompt,
							title,
							focus,
							stderr: stderr || undefined,
						};

						if (onUpdate) {
							onUpdate({
								content: [
									{ type: "text", text: `${header} failed: ${message}` },
								],
								details: {
									_status: "error",
									stderr: stderr || undefined,
									toolCallCount,
									durationMs: Date.now() - startedAt,
								},
							});
						}

						return {
							content: [
								{
									type: "text" as const,
									text: `${header} failed: ${message}`,
								},
							],
							details,
							isError: true,
						};
					} finally {
						clearInterval(runningTimer);
						unsubscribe?.();
						signalCleanup?.();
						await client.stop().catch(() => {});
					}
				},
			},
			isErrorResult: (details) => {
				if (!details) return false;
				const d = details as SubagentDetails;
				return d.stderr !== undefined || d["_status"] === "aborted";
			},
		}),
	);
}
