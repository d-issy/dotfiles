import type {
	ToolCallEvent,
	ToolDefinition,
	ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
import type { Static, TSchema } from "typebox";
import type { ToolPolicy } from "../policy";
import { isSecretPath } from "../secrets";

/**
 * One user-extension tool as a single contribution: the pi tool definition,
 * its focus/permission policy, and optional result classification hooks.
 *
 * Keeping these pieces together makes adding a tool a local change and avoids
 * mismatches between registration, focus guards, and tool-result handling.
 */
export type ToolContributionSource =
	| "core-user"
	| "project"
	| "focus-management";

export type ToolContribution<
	TParams extends TSchema = TSchema,
	TDetails = unknown,
> = {
	readonly source?: ToolContributionSource;
	readonly policy: ToolPolicy<Static<TParams>>;
	readonly definition: ToolDefinition<TParams, TDetails>;
	readonly isErrorResult?: (details: TDetails) => boolean;
};

export type Tool = ToolContribution;

export function defineToolContribution<
	TParams extends TSchema,
	TDetails = unknown,
>(
	tool: ToolContribution<TParams, TDetails>,
): ToolContribution<TParams, TDetails> {
	return tool;
}

export type ToolCatalog = {
	/** Register a complete extension-owned tool contribution. */
	register<TParams extends TSchema, TDetails>(
		tool: ToolContribution<TParams, TDetails>,
	): void;
	/** Register policy for tools not owned by this extension, e.g. pi built-ins. */
	registerPolicy<TInput>(policy: ToolPolicy<TInput>): void;
	list(): readonly ToolContribution[];
	toolResultError(event: ToolResultEvent): { isError: true } | undefined;
	checkToolAllowed(
		focusName: string | undefined,
		allowedToolNames: ReadonlySet<string>,
		event: ToolCallEvent,
	): string | undefined;
	checkSecretBlock(
		focusName: string | undefined,
		event: ToolCallEvent,
	): string | undefined;
};

export function createToolCatalog(): ToolCatalog {
	const tools: ToolContribution[] = [];
	const policies = new Map<string, ToolPolicy>();

	return {
		register(tool) {
			const name = tool.definition.name;
			if (tool.policy.name !== name) {
				throw new Error(
					`Tool contribution '${name}' has mismatched policy '${tool.policy.name}'.`,
				);
			}
			const existingIndex = tools.findIndex(
				(candidate) => candidate.definition.name === name,
			);
			if (existingIndex === -1) tools.push(tool as ToolContribution);
			else tools[existingIndex] = tool as ToolContribution;
			policies.set(name, tool.policy as ToolPolicy);
		},
		registerPolicy(policy) {
			policies.set(policy.name, policy as ToolPolicy);
		},
		list() {
			return tools;
		},
		toolResultError(event) {
			const tool = tools.find(
				(candidate) => candidate.definition.name === event.toolName,
			);
			if (!tool?.isErrorResult) return undefined;
			return tool.isErrorResult(event.details) ? { isError: true } : undefined;
		},
		checkToolAllowed(focusName, allowedToolNames, event) {
			if (allowedToolNames.has(event.toolName)) return undefined;
			if (!focusName) {
				return `${event.toolName} is not available because no focus is active. Use enter_focus to enter an appropriate focus first.`;
			}
			const policy = policies.get(event.toolName);
			return (
				policy?.notAllowedReason?.(focusName) ??
				`${event.toolName} is not available in ${focusName} focus.`
			);
		},
		checkSecretBlock(focusName, event) {
			const policy = policies.get(event.toolName);
			if (!policy?.extractSecretPaths) return undefined;
			const paths = policy.extractSecretPaths(event.input as never);
			if (!paths.some(isSecretPath)) return undefined;
			if (!focusName) {
				return `${policy.name} on secret files is disabled because no focus is active. Use enter_focus to enter an appropriate focus first.`;
			}
			return (
				policy.secretBlockReason?.(focusName) ??
				`${policy.name} on secret files is disabled in ${focusName} focus.`
			);
		},
	};
}
