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
const OPENAI_FAST_MODEL_IDS = new Set([
	"gpt-6.1-sol",
	"gpt-6-astra",
	"gpt-6-sol",
	"gpt-6-luna",
	"gpt-5.6-terra",
	"gpt-5.6-sol",
	"gpt-5.6-luna",
	"gpt-5.5",
	"gpt-5.4",
]);

// Audited against all 464 OpenRouter models' /endpoints on 2026-09-30.
// https://openrouter.ai/docs/guides/features/service-tiers
// Keep only models with explicit /fast, /priority, or /ultrafast endpoints.
export const OPENROUTER_FAST_MODEL_IDS = new Set([
	"anthropic/claude-opus-5.5",
	"anthropic/claude-opus-5",
	"anthropic/claude-opus-4.8",
	"deepseek/deepseek-v4.1-flash",
	"deepseek/deepseek-v4-flash-0731",
	"google/gemini-3.8-flash",
	"google/gemini-3.7-flash",
	"google/gemini-3.6-flash",
	"google/gemini-3.5-flash",
	"google/gemini-3.5-flash-lite",
	"google/gemini-3.1-pro-preview",
	"google/gemini-3.1-flash-lite",
	"google/gemini-3.1-flash-lite-preview",
	"google/gemini-3-flash-preview",
	"google/gemini-2.5-pro",
	"google/gemini-2.5-pro-preview",
	"google/gemini-2.5-flash",
	"google/gemini-2.5-flash-image",
	"google/gemini-2.5-flash-lite",
	"moonshotai/kimi-k3",
	"openai/gpt-6.1-sol-pro",
	"openai/gpt-6.1-sol",
	"openai/gpt-6-astra-pro",
	"openai/gpt-6-astra",
	"openai/gpt-6-sol-pro",
	"openai/gpt-6-sol",
	"openai/gpt-6-luna-pro",
	"openai/gpt-6-luna",
	"openai/gpt-5.6-terra-pro",
	"openai/gpt-5.6-terra",
	"openai/gpt-5.6-sol-pro",
	"openai/gpt-5.6-sol",
	"openai/gpt-5.6-luna-pro",
	"openai/gpt-5.6-luna",
	"openai/gpt-5.5",
	"openai/gpt-5.4",
	"openai/gpt-5.4-mini",
	"openai/gpt-5.3-codex",
	"openai/gpt-5.2",
	"openai/gpt-5.1",
	"x-ai/grok-4.7",
	"x-ai/grok-4.6",
	"x-ai/grok-4.5",
	"x-ai/grok-4.3",
	"x-ai/grok-4.20-multi-agent",
	"x-ai/grok-4.20",
	"x-ai/grok-build-0.1",
	"z-ai/glm-5.3",
	"z-ai/glm-5.2",
]);
export const OPENROUTER_ULTRAFAST_MODEL_IDS = new Set([
	"openai/gpt-6-astra-pro",
	"openai/gpt-6-astra",
]);

type FastModel = NonNullable<ExtensionContext["model"]>;
type ModelIdentity = Pick<FastModel, "provider" | "id">;
export type SpeedMode = "fast" | "ultrafast";

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
	return typeof value === "object" && value !== null;
}

interface SpeedProfile {
	fastModels: ReadonlySet<string>;
	ultrafastModels: ReadonlySet<string>;
	fastMultiplier: (id: string) => number | undefined;
	ultrafastMultiplier: number | undefined;
	fastPayload: RecordLike;
}

const OPENAI_SPEED_PROFILE: SpeedProfile = {
	fastModels: OPENAI_FAST_MODEL_IDS,
	// GPT-6.1 Sol Ultrafast is announced for later; wait for published support and rates.
	// https://learn.chatgpt.com/docs/models#gpt-61-sol
	ultrafastModels: new Set(["gpt-6-astra"]),
	fastMultiplier: (id) => (id === "gpt-5.5" ? 2.5 : 2),
	ultrafastMultiplier: 6,
	fastPayload: { service_tier: "priority" },
};

const SPEED_PROFILES: Readonly<Partial<Record<string, SpeedProfile>>> = {
	openai: OPENAI_SPEED_PROFILE,
	"openai-codex": OPENAI_SPEED_PROFILE,
	openrouter: {
		fastModels: OPENROUTER_FAST_MODEL_IDS,
		ultrafastModels: OPENROUTER_ULTRAFAST_MODEL_IDS,
		// Routing can fall back off-tier; rates depend on the serving endpoint.
		fastMultiplier: () => undefined,
		ultrafastMultiplier: undefined,
		fastPayload: { service_tier: "priority" },
	},
	"opencode-go": {
		// Go forwards Responses request fields unchanged; upstream tier execution
		// is not guaranteed. Do not assume OpenAI's rates for Go subscription usage.
		// https://opencode.ai/docs/go/
		fastModels: new Set(["gpt-6-luna", "gpt-5.6-luna", "grok-4.7", "grok-4.6"]),
		ultrafastModels: new Set(),
		fastMultiplier: () => undefined,
		ultrafastMultiplier: undefined,
		fastPayload: { service_tier: "priority" },
	},
	anthropic: {
		fastModels: ANTHROPIC_FAST_MODEL_IDS,
		ultrafastModels: new Set(),
		fastMultiplier: () => 2,
		ultrafastMultiplier: 0,
		fastPayload: { speed: "fast" },
	},
};

function getSpeedProfile(
	model: ModelIdentity | undefined,
	mode: SpeedMode = "fast",
): SpeedProfile | undefined {
	const profile = model && SPEED_PROFILES[model.provider];
	return model &&
		profile?.[mode === "fast" ? "fastModels" : "ultrafastModels"].has(model.id)
		? profile
		: undefined;
}

function supportsAnthropicFast(model: ModelIdentity | undefined): boolean {
	return model?.provider === "anthropic" && supportsFast(model);
}

export function supportsFast(model: ModelIdentity | undefined): boolean {
	return getSpeedProfile(model) !== undefined;
}

export function supportsUltrafast(model: ModelIdentity | undefined): boolean {
	return getSpeedProfile(model, "ultrafast") !== undefined;
}

export function enableFastPayload(
	payload: unknown,
	model: ModelIdentity | undefined,
	mode: SpeedMode = "fast",
): unknown {
	if (!isRecord(payload) || payload.model !== model?.id) return undefined;
	const profile = getSpeedProfile(model, mode);
	return profile
		? {
				...payload,
				...(mode === "ultrafast"
					? { service_tier: "ultrafast" }
					: profile.fastPayload),
			}
		: undefined;
}

export function adjustFastCost(
	message: AssistantMessage,
	model: FastModel | undefined,
	mode: SpeedMode = "fast",
): AssistantMessage {
	// Purchased-credit rates; included subscription usage has a separate multiplier.
	const profile = getSpeedProfile(model, mode);
	const multiplier =
		mode === "ultrafast"
			? profile?.ultrafastMultiplier
			: model && profile?.fastMultiplier(model.id);
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
