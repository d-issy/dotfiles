import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import { ENTER_FOCUS_TOOL, isTerminatingFocusResult } from "../lib/focus";
import { formatHumanElapsed, formatLiveElapsed } from "../lib/time";

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

function formatMetricsLine(
	ctx: ExtensionContext,
	completed: boolean,
	elapsed: string,
): string {
	const line = completed ? `Worked for ${elapsed}` : elapsed;
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
	let thinkingStartedAt: number | undefined;
	let completedThinkingMs = 0;
	let thoughtDisplayUntil: number | undefined;
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
		thinkingStartedAt = undefined;
		completedThinkingMs = 0;
		thoughtDisplayUntil = undefined;
	}

	function getElapsedMs(now = Date.now()): number {
		return startedAt === undefined ? 0 : now - startedAt;
	}

	function getElapsed(now = Date.now()): string {
		return formatHumanElapsed(getElapsedMs(now));
	}

	function getLiveElapsed(now = Date.now()): string {
		return formatLiveElapsed(getElapsedMs(now));
	}

	function getThinkingElapsedMs(now = Date.now()): number {
		return (
			completedThinkingMs +
			(phase === "Thinking" && thinkingStartedAt !== undefined
				? now - thinkingStartedAt
				: 0)
		);
	}

	function setPhase(nextPhase: WorkPhase, now = Date.now()): void {
		if (phase === nextPhase) return;

		if (phase === "Thinking" && thinkingStartedAt !== undefined) {
			completedThinkingMs += now - thinkingStartedAt;
			thinkingStartedAt = undefined;
		}

		phase = nextPhase;
		if (phase === "Thinking") {
			thinkingStartedAt = now;
			thoughtDisplayUntil = undefined;
		} else {
			thoughtDisplayUntil = now + 1000;
		}
	}

	function buildLine(
		ctx: ExtensionContext,
		completed: boolean,
		now = Date.now(),
	): string {
		return formatMetricsLine(ctx, completed, getElapsed(now));
	}

	function buildLiveMetrics(now = Date.now()): string {
		if (phase === "Thinking") {
			return `${getLiveElapsed(now)} total · ${formatLiveElapsed(
				getThinkingElapsedMs(now),
			)} thinking`;
		}
		if (thoughtDisplayUntil !== undefined && now < thoughtDisplayUntil) {
			return `${getLiveElapsed(now)} total · ${formatLiveElapsed(completedThinkingMs)} thought`;
		}
		return getLiveElapsed(now);
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
			formatWorkingMessage(
				ctx,
				phase,
				ctx.ui.theme.fg("dim", buildLiveMetrics()),
			),
		);
	}

	pi.on("before_agent_start", async (_event, ctx) => {
		stopTickTimer();
		clearWidget(ctx);
		resetTurnMetrics();
		setPhase("Working");
		startedAt = Date.now();
		updateWorkingMessage(ctx);
		tickTimer = setInterval(() => updateWorkingMessage(ctx), TICK_MS);
	});

	pi.on("message_update", async (event, ctx) => {
		if (event.message.role !== "assistant" || startedAt === undefined) return;
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
		setPhase(hasThinking && !hasVisibleWork ? "Thinking" : "Working");
		updateWorkingMessage(ctx);
	});

	pi.on("tool_execution_end", async (event) => {
		if (event.toolName !== ENTER_FOCUS_TOOL) return;
		preserveWorkingAfterAgentEnd = isTerminatingFocusResult(event.result);
	});

	pi.on("message_end", async (event, ctx) => {
		if (event.message.role !== "assistant" || startedAt === undefined) return;

		setPhase("Working");

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
