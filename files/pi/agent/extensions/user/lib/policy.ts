import type { ToolCallEvent } from "@earendil-works/pi-coding-agent";
import { isSecretPath } from "./secrets";

export type FocusName = string;

export function makeSecretActionReason(
	verb: string,
): (focusName: FocusName) => string {
	return (focusName) =>
		`${verb} secret files is disabled in ${focusName} focus.`;
}

export type ToolPolicy<TInput = unknown> = {
	name: string;
	extractSecretPaths?: (input: TInput) => readonly string[];
	secretBlockReason?: (focusName: FocusName) => string;
	notAllowedReason?: (focusName: FocusName) => string;
};

export type PolicyRegistry = {
	register<TInput>(policy: ToolPolicy<TInput>): void;
	checkToolAllowed(
		focusName: FocusName,
		allowedToolNames: ReadonlySet<string>,
		event: ToolCallEvent,
	): string | undefined;
	checkSecretBlock(
		focusName: FocusName,
		event: ToolCallEvent,
	): string | undefined;
};

function createPolicyRegistry(): PolicyRegistry {
	const policies = new Map<string, ToolPolicy>();

	return {
		register(policy) {
			policies.set(policy.name, policy as ToolPolicy);
		},
		checkToolAllowed(focusName, allowedToolNames, event) {
			if (allowedToolNames.has(event.toolName)) return undefined;
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
			return (
				policy.secretBlockReason?.(focusName) ??
				`${policy.name} on secret files is disabled in ${focusName} focus.`
			);
		},
	};
}

export const policyRegistry: PolicyRegistry = createPolicyRegistry();
