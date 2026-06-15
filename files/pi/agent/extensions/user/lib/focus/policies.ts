import type {
	EditToolInput,
	FindToolInput,
	GrepToolInput,
	LsToolInput,
	ReadToolInput,
	WriteToolInput,
} from "@earendil-works/pi-coding-agent";
import { makeSecretActionReason } from "../policy";
import { toolCatalog } from "../tool";

export function registerBuiltInFocusPolicies(): void {
	toolCatalog.registerPolicy({
		name: "bash",
		notAllowedReason: (focus) =>
			`Running bash commands is disabled in ${focus} focus.`,
	});
	toolCatalog.registerPolicy<ReadToolInput>({
		name: "read",
		extractSecretPaths: (input) => [input.path],
		secretBlockReason: makeSecretActionReason("Reading"),
	});
	toolCatalog.registerPolicy<WriteToolInput>({
		name: "write",
		extractSecretPaths: (input) => [input.path],
		secretBlockReason: makeSecretActionReason("Writing to"),
	});
	toolCatalog.registerPolicy<EditToolInput>({
		name: "edit",
		extractSecretPaths: (input) => [input.path],
		secretBlockReason: makeSecretActionReason("Writing to"),
	});
	toolCatalog.registerPolicy<GrepToolInput>({
		name: "grep",
		extractSecretPaths: (input) => (input.path ? [input.path] : []),
		secretBlockReason: makeSecretActionReason("Grepping"),
	});
	toolCatalog.registerPolicy<FindToolInput>({ name: "find" });
	toolCatalog.registerPolicy<LsToolInput>({ name: "ls" });
}
