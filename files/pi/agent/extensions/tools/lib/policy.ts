import type { ToolCallEvent } from "@earendil-works/pi-coding-agent";
import { isSecretPath } from "./secrets.js";

export type ModeName = "explore" | "write" | "yolo";

export type ToolPolicy<TInput = unknown> = {
	name: string;
	allowedModes: readonly ModeName[];
	extractSecretPaths?: (input: TInput) => readonly string[];
	secretBlockReason?: (modeName: ModeName) => string;
	notAllowedReason?: (modeName: ModeName) => string;
};

export type PolicyRegistry = {
	register<TInput>(policy: ToolPolicy<TInput>): void;
	getActiveToolsForMode(modeName: ModeName): string[];
	checkToolAllowed(
		modeName: ModeName,
		event: ToolCallEvent,
	): string | undefined;
	checkSecretBlock(
		modeName: ModeName,
		event: ToolCallEvent,
	): string | undefined;
};

function createPolicyRegistry(): PolicyRegistry {
	const policies = new Map<string, ToolPolicy>();

	return {
		register(policy) {
			policies.set(policy.name, policy as ToolPolicy);
		},
		getActiveToolsForMode(modeName) {
			const tools: string[] = [];
			for (const policy of policies.values()) {
				if (policy.allowedModes.includes(modeName)) tools.push(policy.name);
			}
			return tools;
		},
		checkToolAllowed(modeName, event) {
			const policy = policies.get(event.toolName);
			if (!policy) return undefined;
			if (policy.allowedModes.includes(modeName)) return undefined;
			return (
				policy.notAllowedReason?.(modeName) ??
				`${event.toolName} is not available in ${modeName} mode.`
			);
		},
		checkSecretBlock(modeName, event) {
			const policy = policies.get(event.toolName);
			if (!policy?.extractSecretPaths) return undefined;
			if (!policy.allowedModes.includes(modeName)) return undefined;
			const paths = policy.extractSecretPaths(event.input as never);
			if (!paths.some(isSecretPath)) return undefined;
			return (
				policy.secretBlockReason?.(modeName) ??
				`${policy.name} on secret files is disabled in ${modeName} mode.`
			);
		},
	};
}

export const policyRegistry: PolicyRegistry = createPolicyRegistry();
