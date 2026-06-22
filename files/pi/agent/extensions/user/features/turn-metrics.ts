import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import { ENTER_FOCUS_TOOL, isTerminatingFocusResult } from "../lib/focus";

const WIDGET_KEY = "turn-metrics";
const TICK_MS = 1000;
const DEFAULT_INDICATOR_FRAMES = [
	"⠋",
	"⠙",
	"⠹",
	"⠸",
	"⠼",
	"⠴",
	"⠦",
	"⠧",
	"⠇",
	"⠏",
] as const;
const DEFAULT_INDICATOR_INTERVAL_MS = 80;

type WorkPhase = "Thinking" | "Working";
type PhaseColor = "accent" | "warning";

function formatElapsed(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const seconds = totalSeconds % 60;
	const minutes = Math.floor(totalSeconds / 60) % 60;
	const hours = Math.floor(totalSeconds / 3600);

	if (hours > 0) {
		return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
	}

	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}

	return `${seconds}s`;
}

function formatTokenCount(tokens: number): string {
	if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}m`;
	if (tokens >= 10_000) return `${Math.round(tokens / 1000)}k`;
	if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
	return tokens.toString();
}

function formatTokenMetrics(inputTokens: number, outputTokens: number): string {
	const parts: string[] = [];
	if (inputTokens > 0) parts.push(`↑ ${formatTokenCount(inputTokens)}`);
	if (outputTokens > 0) parts.push(`↓ ${formatTokenCount(outputTokens)}`);
	return parts.join(" ");
}

function formatTurnMetrics(
	elapsed: string,
	inputTokens: number,
	outputTokens: number,
	toolCalls: number,
): string {
	const parts = [elapsed];
	const tokenMetrics = formatTokenMetrics(inputTokens, outputTokens);
	if (tokenMetrics) parts.push(tokenMetrics);
	if (toolCalls > 0) parts.push(`${toolCalls} tool uses`);
	return parts.join(" · ");
}

function formatMetricsLine(
	ctx: ExtensionContext,
	completed: boolean,
	elapsed: string,
	inputTokens: number,
	outputTokens: number,
	toolCalls: number,
): string {
	const metrics = formatTurnMetrics(
		elapsed,
		inputTokens,
		outputTokens,
		toolCalls,
	);
	const line = completed ? `Worked for ${metrics}` : metrics;
	return ctx.ui.theme.fg("dim", line);
}

function getPhaseColor(phase: WorkPhase): PhaseColor {
	return phase === "Thinking" ? "warning" : "accent";
}

function formatWorkingMessage(
	ctx: ExtensionContext,
	phase: WorkPhase,
	metrics: string,
): string {
	const phaseColor = getPhaseColor(phase);
	return [
		ctx.ui.theme.fg(phaseColor, `${phase}...`),
		" ",
		ctx.ui.theme.fg("dim", "("),
		metrics,
		ctx.ui.theme.fg("dim", ")"),
	].join("");
}

function register(pi: ExtensionAPI): void {
	let startedAt: number | undefined;
	let phase: WorkPhase = "Working";
	let workingIndicatorPhase: WorkPhase | undefined;
	let tickTimer: ReturnType<typeof setInterval> | undefined;
	let completedInputTokens = 0;
	let completedOutputTokens = 0;
	let currentInputTokens = 0;
	let currentOutputTokens = 0;
	let toolCalls = 0;
	let preserveWorkingAfterAgentEnd = false;

	function stopTickTimer(): void {
		if (!tickTimer) return;
		clearInterval(tickTimer);
		tickTimer = undefined;
	}

	function setWidgetLine(ctx: ExtensionContext, line: string): void {
		if (!ctx.hasUI) return;
		ctx.ui.setWidget(WIDGET_KEY, [line], { placement: "aboveEditor" });
	}

	function clearWidget(ctx: ExtensionContext): void {
		if (!ctx.hasUI) return;
		ctx.ui.setWidget(WIDGET_KEY, undefined);
	}

	function resetTurnMetrics(): void {
		completedInputTokens = 0;
		completedOutputTokens = 0;
		currentInputTokens = 0;
		currentOutputTokens = 0;
		toolCalls = 0;
	}

	function setCurrentUsage(inputTokens: number, outputTokens: number): void {
		currentInputTokens = inputTokens;
		currentOutputTokens = outputTokens;
	}

	function commitCurrentUsage(): void {
		completedInputTokens += currentInputTokens;
		completedOutputTokens += currentOutputTokens;
		currentInputTokens = 0;
		currentOutputTokens = 0;
	}

	function getElapsed(now = Date.now()): string {
		return formatElapsed(startedAt === undefined ? 0 : now - startedAt);
	}

	function buildLine(
		ctx: ExtensionContext,
		completed: boolean,
		now = Date.now(),
	): string {
		return formatMetricsLine(
			ctx,
			completed,
			getElapsed(now),
			completedInputTokens + currentInputTokens,
			completedOutputTokens + currentOutputTokens,
			toolCalls,
		);
	}

	function updateWorkingIndicator(ctx: ExtensionContext): void {
		if (workingIndicatorPhase === phase) return;
		workingIndicatorPhase = phase;

		if (phase === "Working") {
			ctx.ui.setWorkingIndicator();
			return;
		}

		ctx.ui.setWorkingIndicator({
			frames: DEFAULT_INDICATOR_FRAMES.map((frame) =>
				ctx.ui.theme.fg(getPhaseColor(phase), frame),
			),
			intervalMs: DEFAULT_INDICATOR_INTERVAL_MS,
		});
	}

	function clearWorking(ctx: ExtensionContext): void {
		if (!ctx.hasUI) return;
		workingIndicatorPhase = undefined;
		ctx.ui.setWorkingMessage();
		ctx.ui.setWorkingIndicator();
	}

	function updateWorkingMessage(ctx: ExtensionContext): void {
		if (!ctx.hasUI || startedAt === undefined) return;
		updateWorkingIndicator(ctx);
		ctx.ui.setWorkingMessage(
			formatWorkingMessage(ctx, phase, buildLine(ctx, false)),
		);
	}

	pi.on("before_agent_start", async (_event, ctx) => {
		stopTickTimer();
		clearWidget(ctx);
		resetTurnMetrics();
		phase = "Working";
		startedAt = Date.now();
		updateWorkingMessage(ctx);
		tickTimer = setInterval(() => updateWorkingMessage(ctx), TICK_MS);
	});

	pi.on("message_update", async (event, ctx) => {
		if (event.message.role !== "assistant" || startedAt === undefined) return;
		setCurrentUsage(event.message.usage.input, event.message.usage.output);
		let hasThinking = false;
		let hasVisibleWork = false;
		for (const content of event.message.content) {
			if (content.type === "thinking" && content.thinking.trim())
				hasThinking = true;
			else if (
				(content.type === "text" && content.text.trim()) ||
				content.type === "toolCall"
			)
				hasVisibleWork = true;
		}
		phase = hasThinking && !hasVisibleWork ? "Thinking" : "Working";
		updateWorkingMessage(ctx);
	});

	pi.on("tool_execution_start", async (_event, ctx) => {
		toolCalls++;
		updateWorkingMessage(ctx);
	});
	pi.on("tool_execution_end", async (event) => {
		if (event.toolName !== ENTER_FOCUS_TOOL) return;
		preserveWorkingAfterAgentEnd = isTerminatingFocusResult(event.result);
	});

	pi.on("message_end", async (event, ctx) => {
		if (event.message.role !== "assistant" || startedAt === undefined) return;

		setCurrentUsage(event.message.usage.input, event.message.usage.output);
		commitCurrentUsage();

		if (event.message.content.some((content) => content.type === "toolCall"))
			return;

		clearWorking(ctx);
		setWidgetLine(ctx, buildLine(ctx, true));
		startedAt = undefined;
	});
	pi.on("agent_end", async (_event, ctx) => {
		if (preserveWorkingAfterAgentEnd) {
			preserveWorkingAfterAgentEnd = false;
			updateWorkingMessage(ctx);
			return;
		}

		stopTickTimer();
		startedAt = undefined;
		clearWorking(ctx);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		stopTickTimer();
		startedAt = undefined;
		clearWorking(ctx);
		clearWidget(ctx);
	});
}

export function createTurnMetricsFeature(): Feature {
	return { name: "turn-metrics", register };
}

export default createTurnMetricsFeature();
