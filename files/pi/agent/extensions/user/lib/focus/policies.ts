import type {
	EditToolInput,
	FindToolInput,
	GrepToolInput,
	LsToolInput,
	ReadToolInput,
	WriteToolInput,
} from "@earendil-works/pi-coding-agent";
import { makeSecretActionReason, policyRegistry } from "../policy";

export function registerBuiltInFocusPolicies(): void {
	policyRegistry.register({
		name: "bash",
		notAllowedReason: (focus) =>
			`Running bash commands is disabled in ${focus} focus.`,
	});
	policyRegistry.register<ReadToolInput>({
		name: "read",
		extractSecretPaths: (input) => [input.path],
		secretBlockReason: makeSecretActionReason("Reading"),
	});
	policyRegistry.register<WriteToolInput>({
		name: "write",
		extractSecretPaths: (input) => [input.path],
		secretBlockReason: makeSecretActionReason("Writing to"),
	});
	policyRegistry.register<EditToolInput>({
		name: "edit",
		extractSecretPaths: (input) => [input.path],
		secretBlockReason: makeSecretActionReason("Writing to"),
	});
	policyRegistry.register<GrepToolInput>({
		name: "grep",
		extractSecretPaths: (input) => (input.path ? [input.path] : []),
		secretBlockReason: makeSecretActionReason("Grepping"),
	});
	policyRegistry.register<FindToolInput>({ name: "find" });
	policyRegistry.register<LsToolInput>({ name: "ls" });
}
