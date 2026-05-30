import {
	type BashToolInput,
	type EditToolInput,
	type FindToolInput,
	type GrepToolInput,
	type LsToolInput,
	type ReadToolInput,
	type WriteToolInput,
} from "@earendil-works/pi-coding-agent";
import {
	type ModeName,
	makeSecretActionReason,
	policyRegistry,
} from "../policy";

const READ_MODES: readonly ModeName[] = ["read", "write", "yolo"];
const WRITE_MODES: readonly ModeName[] = ["write", "yolo"];
const NAVIGATE_MODES: readonly ModeName[] = ["read", "write", "yolo"];

export function registerBuiltInPolicies(): void {
	policyRegistry.register<BashToolInput>({
		name: "bash",
		allowedModes: ["yolo"],
		notAllowedReason: (mode) =>
			`Running bash commands is disabled in ${mode} mode.`,
	});
	policyRegistry.register<ReadToolInput>({
		name: "read",
		allowedModes: READ_MODES,
		extractSecretPaths: (input) => [input.path],
		secretBlockReason: makeSecretActionReason("Reading"),
	});
	policyRegistry.register<WriteToolInput>({
		name: "write",
		allowedModes: WRITE_MODES,
		extractSecretPaths: (input) => [input.path],
		secretBlockReason: makeSecretActionReason("Writing to"),
	});
	policyRegistry.register<EditToolInput>({
		name: "edit",
		allowedModes: WRITE_MODES,
		extractSecretPaths: (input) => [input.path],
		secretBlockReason: makeSecretActionReason("Writing to"),
	});
	policyRegistry.register<GrepToolInput>({
		name: "grep",
		allowedModes: NAVIGATE_MODES,
		extractSecretPaths: (input) => (input.path ? [input.path] : []),
		secretBlockReason: makeSecretActionReason("Grepping"),
	});
	policyRegistry.register<FindToolInput>({
		name: "find",
		allowedModes: NAVIGATE_MODES,
	});
	policyRegistry.register<LsToolInput>({
		name: "ls",
		allowedModes: NAVIGATE_MODES,
	});
}
