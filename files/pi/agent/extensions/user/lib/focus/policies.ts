import type {
	EditToolInput,
	FindToolInput,
	GrepToolInput,
	LsToolInput,
	ReadToolInput,
	WriteToolInput,
} from "@earendil-works/pi-coding-agent";
import { makeSecretActionReason } from "../policy";
import type { ToolCatalog } from "../tool";

export function registerBuiltInFocusPolicies(catalog: ToolCatalog): void {
	catalog.registerPolicy({
		name: "bash",
		notAllowedReason: (focus) =>
			`Running bash commands is disabled in ${focus} focus.`,
	});
	catalog.registerPolicy<ReadToolInput>({
		name: "read",
		extractSecretPaths: (input) => [input.path],
		secretBlockReason: makeSecretActionReason("Reading"),
	});
	catalog.registerPolicy<WriteToolInput>({
		name: "write",
		extractSecretPaths: (input) => [input.path],
		secretBlockReason: makeSecretActionReason("Writing to"),
	});
	catalog.registerPolicy<EditToolInput>({
		name: "edit",
		extractSecretPaths: (input) => [input.path],
		secretBlockReason: makeSecretActionReason("Writing to"),
	});
	catalog.registerPolicy<GrepToolInput>({
		name: "grep",
		extractSecretPaths: (input) => (input.path ? [input.path] : []),
		secretBlockReason: makeSecretActionReason("Grepping"),
	});
	catalog.registerPolicy<FindToolInput>({ name: "find" });
	catalog.registerPolicy<LsToolInput>({ name: "ls" });
}
