import type { ToolCallEvent } from "@earendil-works/pi-coding-agent";
import { isSecretPath } from "./secrets";

export type ModeName = "read" | "write" | "yolo";

export type ToolPolicy<TInput = unknown> = {
	name: string;
	allowedModes: readonly ModeName[];
	extractSecretPaths?: (input: TInput) => readonly string[];
	secretBlockReason?: (modeName: ModeName) => string;
	notAllowedReason?: (modeName: ModeName) => string;
};

export type PolicyRegistry = {
	register<TInput>(policy: ToolPolicy<TInput>): void;
	clearListeners(): void;
	setNotificationsEnabled(enabled: boolean): void;
	onChange(listener: () => void): () => void;
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
	const listeners = new Set<() => void>();
	let notificationsEnabled = false;
	let pendingChange = false;

	function notifyChange(): void {
		for (const listener of Array.from(listeners)) {
			try {
				listener();
			} catch {
				listeners.delete(listener);
			}
		}
	}

	return {
		register(policy) {
			policies.set(policy.name, policy as ToolPolicy);
			if (!notificationsEnabled) {
				pendingChange = true;
				return;
			}
			notifyChange();
		},
		clearListeners() {
			listeners.clear();
		},
		setNotificationsEnabled(enabled) {
			notificationsEnabled = enabled;
			if (!enabled || !pendingChange) return;
			pendingChange = false;
			notifyChange();
		},
		onChange(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
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

const POLICY_REGISTRY_KEY = Symbol.for("pi.dotfiles.policyRegistry");

type GlobalWithPolicyRegistry = typeof globalThis & {
	[POLICY_REGISTRY_KEY]?: PolicyRegistry;
};

const globalWithPolicyRegistry = globalThis as GlobalWithPolicyRegistry;

export const policyRegistry: PolicyRegistry = (globalWithPolicyRegistry[
	POLICY_REGISTRY_KEY
] ??= createPolicyRegistry());

// Extension files can be evaluated while pi's action runtime is not ready.
// Keep change notifications paused until mode.ts enables them from session_start.
policyRegistry.setNotificationsEnabled(false);
