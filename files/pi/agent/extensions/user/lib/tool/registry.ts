import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Static, TSchema } from "typebox";
import type { ToolPolicy } from "../policy";

/**
 * One agent tool as data: its permission policy plus the pi tool definition.
 * Feature-agnostic lib modules (file, …) register tools into {@link toolRegistry};
 * the `tool` feature drains the registry and wires each one into pi. Mirrors
 * {@link ToolPolicy} / `policyRegistry`, one concern up.
 */
export type Tool<TParams extends TSchema = TSchema, TDetails = unknown> = {
	readonly policy: ToolPolicy<Static<TParams>>;
	readonly definition: ToolDefinition<TParams, TDetails>;
};

export type ToolRegistry = {
	/**
	 * Register a tool. Its policy's secret-path input and its definition's
	 * params/execute are checked against the *same* schema; the per-tool
	 * generics are then erased so tools can live in one heterogeneous list.
	 */
	register<TParams extends TSchema, TDetails>(
		tool: Tool<TParams, TDetails>,
	): void;
	list(): readonly Tool[];
};

function createToolRegistry(): ToolRegistry {
	const tools: Tool[] = [];

	return {
		register(tool) {
			tools.push(tool as Tool);
		},
		list() {
			return tools;
		},
	};
}

export const toolRegistry: ToolRegistry = createToolRegistry();
