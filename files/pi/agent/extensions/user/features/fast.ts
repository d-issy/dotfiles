import { type AssistantMessage, calculateCost } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const ANTHROPIC_FAST_BETA = "fast-mode-2026-02-01";
const ANTHROPIC_FAST_MODEL_IDS = new Set([
	"claude-opus-5-5",
	"claude-opus-5",
	"claude-opus-4-8",
]);
const OPENAI_CODEX_FAST_MODEL_IDS = new Set([
	"gpt-6-astra",
	"gpt-6.1-sol",
	"gpt-6-sol",
	"gpt-6-luna",
	"gpt-5.6-terra",
	"gpt-5.6-sol",
	"gpt-5.6-luna",
	"gpt-5.5",
	"gpt-5.4",
]);

type FastModel = NonNullable<ExtensionContext["model"]>;
type ModelIdentity = Pick<FastModel, "provider" | "id">;
export type SpeedMode = "fast" | "ultrafast";

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
	return typeof value === "object" && value !== null;
}

function supportsAnthropicFast(model: ModelIdentity | undefined): boolean {
	return (
		model?.provider === "anthropic" && ANTHROPIC_FAST_MODEL_IDS.has(model.id)
	);
}

function getFastCostMultiplier(
	model: ModelIdentity | undefined,
): number | undefined {
	if (supportsAnthropicFast(model)) return 2;
	if (
		model?.provider !== "openai-codex" ||
		!OPENAI_CODEX_FAST_MODEL_IDS.has(model.id)
	) {
		return undefined;
	}
	return model.id === "gpt-5.5" ? 2.5 : 2;
}

export function supportsFast(model: ModelIdentity | undefined): boolean {
	return (
		supportsAnthropicFast(model) ||
		(model?.provider === "openai-codex" &&
			OPENAI_CODEX_FAST_MODEL_IDS.has(model.id))
	);
}

export function supportsUltrafast(model: ModelIdentity | undefined): boolean {
	// GPT-6.1 Sol Ultrafast is announced for later; enable it once support and rates are published.
	// https://learn.chatgpt.com/docs/models#gpt-61-sol
	return model?.provider === "openai-codex" && model.id === "gpt-6-astra";
}

export function enableFastPayload(
	payload: unknown,
	model: ModelIdentity | undefined,
	mode: SpeedMode = "fast",
): unknown {
	if (!isRecord(payload) || payload.model !== model?.id) return undefined;
	if (mode === "ultrafast") {
		return supportsUltrafast(model)
			? { ...payload, service_tier: "ultrafast" }
			: undefined;
	}
	if (supportsAnthropicFast(model)) return { ...payload, speed: "fast" };
	if (
		model?.provider === "openai-codex" &&
		OPENAI_CODEX_FAST_MODEL_IDS.has(model.id)
	) {
		return { ...payload, service_tier: "priority" };
	}
	return undefined;
}

export function adjustFastCost(
	message: AssistantMessage,
	model: FastModel | undefined,
	mode: SpeedMode = "fast",
): AssistantMessage {
	// Purchased-credit rates; included subscription usage has a separate multiplier.
	const multiplier =
		mode === "ultrafast"
			? supportsUltrafast(model)
				? 6
				: undefined
			: getFastCostMultiplier(model);
	if (
		multiplier === undefined ||
		message.provider !== model?.provider ||
		message.model !== model.id
	) {
		return message;
	}

	const usage = {
		...message.usage,
		cost: { ...message.usage.cost },
	};
	const cost = calculateCost(model, usage);
	usage.cost = {
		input: cost.input * multiplier,
		output: cost.output * multiplier,
		cacheRead: cost.cacheRead * multiplier,
		cacheWrite: cost.cacheWrite * multiplier,
		total: cost.total * multiplier,
	};
	return { ...message, usage };
}

export function addAnthropicFastBeta(
	headers: Record<string, string | null>,
): void {
	const headerName =
		Object.keys(headers).find(
			(name) => name.toLowerCase() === "anthropic-beta",
		) ?? "anthropic-beta";
	const features = (headers[headerName] ?? "")
		.split(",")
		.map((feature) => feature.trim())
		.filter(Boolean);

	if (!features.includes(ANTHROPIC_FAST_BETA)) {
		features.push(ANTHROPIC_FAST_BETA);
	}
	headers[headerName] = features.join(",");
}

export interface FastController {
	onChange?: () => void;
	getMode: (model: ModelIdentity | undefined) => SpeedMode | undefined;
	setMode: (
		mode: SpeedMode | undefined,
		model: ModelIdentity | undefined,
	) => void;
	isEnabled: (model: ModelIdentity | undefined) => boolean;
	setEnabled: (enabled: boolean, model: ModelIdentity | undefined) => void;
}

export function registerFastFeature(pi: ExtensionAPI): FastController {
	let mode: SpeedMode | undefined;
	let activeFastRequest: { model: FastModel; mode: SpeedMode } | undefined;
	const controller: FastController = {
		getMode: (model) => {
			if (mode === "ultrafast")
				return supportsUltrafast(model) ? mode : undefined;
			return mode === "fast" && supportsFast(model) ? mode : undefined;
		},
		setMode: (value, model) => {
			mode =
				value === "ultrafast"
					? supportsUltrafast(model)
						? value
						: undefined
					: value === "fast" && supportsFast(model)
						? value
						: undefined;
			controller.onChange?.();
		},
		isEnabled: (model) => controller.getMode(model) === "fast",
		setEnabled: (value, model) =>
			controller.setMode(value ? "fast" : undefined, model),
	};

	for (const speed of ["fast", "ultrafast"] as const) {
		const label = speed === "fast" ? "Fast" : "Ultrafast";
		pi.registerCommand(speed, {
			description: `Toggle ${label} mode for supported models`,
			handler: async (args, ctx) => {
				if (args.trim()) {
					ctx.ui.notify(`Usage: /${speed}`, "warning");
					return;
				}
				if (
					!(speed === "fast"
						? supportsFast(ctx.model)
						: supportsUltrafast(ctx.model))
				) {
					ctx.ui.notify(
						`${label} mode is not available for this model`,
						"warning",
					);
					return;
				}

				controller.setMode(mode === speed ? undefined : speed, ctx.model);
				ctx.ui.notify(
					`${label} mode ${mode === speed ? "enabled" : "disabled"}`,
					"info",
				);
			},
		});
	}

	pi.on("model_select", (event, ctx) => {
		if (!mode || controller.getMode(event.model)) return;

		const label = mode === "fast" ? "Fast" : "Ultrafast";
		controller.setMode(undefined, event.model);
		ctx.ui.notify(`${label} mode disabled for the selected model`, "info");
	});

	pi.on("before_provider_request", (event, ctx) => {
		const requestMode = controller.getMode(ctx.model);
		if (!requestMode) return;
		const payload = enableFastPayload(event.payload, ctx.model, requestMode);
		if (payload !== undefined && ctx.model)
			activeFastRequest = { model: ctx.model, mode: requestMode };
		return payload;
	});

	pi.on("before_provider_headers", (event, ctx) => {
		if (!controller.isEnabled(ctx.model) || !supportsAnthropicFast(ctx.model))
			return;
		addAnthropicFastBeta(event.headers);
	});

	pi.on("message_end", (event) => {
		if (event.message.role !== "assistant" || !activeFastRequest) return;

		const message = adjustFastCost(
			event.message,
			activeFastRequest.model,
			activeFastRequest.mode,
		);
		activeFastRequest = undefined;
		return { message };
	});

	return controller;
}

export default registerFastFeature;
