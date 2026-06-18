import type {
	BeforeProviderRequestEvent,
	ExtensionAPI,
	ExtensionHandler,
} from "@earendil-works/pi-coding-agent";
import type { FocusController } from "./controller";
import type { FocusRuntime } from "./runtime";

type PayloadRecord = Record<string, unknown>;

function isRecord(value: unknown): value is PayloadRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function payloadToolName(value: unknown): string | undefined {
	if (!isRecord(value)) return undefined;
	if (typeof value.name === "string") return value.name;
	if (isRecord(value.function) && typeof value.function.name === "string") {
		return value.function.name;
	}
	return undefined;
}

function filterPayloadTool(
	tool: unknown,
	allowedToolNames: ReadonlySet<string>,
): unknown | undefined {
	if (!isRecord(tool)) {
		return tool;
	}
	if (Array.isArray(tool.functionDeclarations)) {
		const functionDeclarations = tool.functionDeclarations.filter(
			(declaration) => {
				const name = payloadToolName(declaration);
				return name ? allowedToolNames.has(name) : true;
			},
		);
		if (functionDeclarations.length === 0) return undefined;
		return { ...tool, functionDeclarations };
	}
	const name = payloadToolName(tool);
	return name && !allowedToolNames.has(name) ? undefined : tool;
}

function filterPayloadToolArray(
	tools: readonly unknown[],
	allowedToolNames: ReadonlySet<string>,
): unknown[] {
	return tools
		.map((tool) => filterPayloadTool(tool, allowedToolNames))
		.filter((tool) => tool !== undefined);
}

function filterProviderPayloadTools(
	payload: unknown,
	allowedToolNames: ReadonlySet<string>,
): unknown {
	if (Array.isArray(payload)) {
		return payload.map((value) =>
			filterProviderPayloadTools(value, allowedToolNames),
		);
	}
	if (!isRecord(payload)) return payload;

	const next: PayloadRecord = {};
	for (const [key, value] of Object.entries(payload)) {
		if (key === "tools" && Array.isArray(value)) {
			const tools = filterPayloadToolArray(value, allowedToolNames);
			if (tools.length > 0) next[key] = tools;
			continue;
		}
		next[key] = filterProviderPayloadTools(value, allowedToolNames);
	}
	if (!("tools" in next)) delete next.toolConfig;
	return next;
}

export const filterProviderTools =
	(
		pi: ExtensionAPI,
		focus: FocusController,
		runtime?: FocusRuntime,
	): ExtensionHandler<BeforeProviderRequestEvent, unknown> =>
	async (event) =>
		filterProviderPayloadTools(
			event.payload,
			focus.allowedToolNames(pi, {
				includeManagementTools: runtime?.lockedFocusName === undefined,
			}),
		);
