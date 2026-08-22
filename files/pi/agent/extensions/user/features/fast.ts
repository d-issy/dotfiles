import { type AssistantMessage, calculateCost } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const ANTHROPIC_FAST_BETA = "fast-mode-2026-02-01";
const ANTHROPIC_FAST_MODEL_IDS = new Set(["claude-opus-4-8", "claude-opus-5"]);
const OPENAI_CODEX_FAST_MODEL_IDS = new Set([
	"gpt-5.4",
	"gpt-5.5",
	"gpt-5.6-luna",
	"gpt-5.6-sol",
	"gpt-5.6-terra",
]);

type FastModel = NonNullable<ExtensionContext["model"]>;
type ModelIdentity = Pick<FastModel, "provider" | "id">;

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

export function enableFastPayload(
	payload: unknown,
	model: ModelIdentity | undefined,
): unknown {
	if (!isRecord(payload) || payload.model !== model?.id) return undefined;
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
): AssistantMessage {
	const multiplier = getFastCostMultiplier(model);
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

export function registerFastFeature(
	pi: ExtensionAPI,
): (model: ModelIdentity | undefined) => boolean {
	let enabled = false;
	let activeFastRequest: FastModel | undefined;

	pi.registerCommand("fast", {
		description: "Toggle Fast mode for supported models",
		handler: async (args, ctx) => {
			if (args.trim()) {
				ctx.ui.notify("Usage: /fast", "warning");
				return;
			}
			if (!supportsFast(ctx.model)) {
				ctx.ui.notify("Fast mode is not available for this model", "warning");
				return;
			}

			enabled = !enabled;
			ctx.ui.notify(`Fast mode ${enabled ? "enabled" : "disabled"}`, "info");
		},
	});

	pi.on("model_select", (event, ctx) => {
		if (!enabled || supportsFast(event.model)) return;

		enabled = false;
		ctx.ui.notify("Fast mode disabled for the selected model", "info");
	});

	pi.on("before_provider_request", (event, ctx) => {
		if (!enabled || !supportsFast(ctx.model)) return;
		const payload = enableFastPayload(event.payload, ctx.model);
		if (payload !== undefined && ctx.model) activeFastRequest = ctx.model;
		return payload;
	});

	pi.on("before_provider_headers", (event, ctx) => {
		if (!enabled || !supportsAnthropicFast(ctx.model)) return;
		addAnthropicFastBeta(event.headers);
	});

	pi.on("message_end", (event) => {
		if (event.message.role !== "assistant" || !activeFastRequest) return;

		const message = adjustFastCost(event.message, activeFastRequest);
		activeFastRequest = undefined;
		return { message };
	});

	return (model) => enabled && supportsFast(model);
}

export default registerFastFeature;
