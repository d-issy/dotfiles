export type ToolErrorCode =
	| "empty_path"
	| "outside_repo"
	| "inside_git"
	| "ignored"
	| "not_found"
	| "destination_exists"
	| "destination_not_directory"
	| "secret"
	| "aborted"
	| "missing_input";

export class ToolError extends Error {
	constructor(
		public readonly code: ToolErrorCode,
		public readonly operation: string,
		public readonly context: string,
	) {
		super(formatToolError(code, operation, context));
		this.name = "ToolError";
	}
}

function formatToolError(
	code: ToolErrorCode,
	operation: string,
	context: string,
): string {
	switch (code) {
		case "empty_path":
			return "Path must not be empty.";
		case "outside_repo":
			return `${operation} outside the repository is not allowed: ${context}`;
		case "inside_git":
			return `${operation} inside .git is not allowed: ${context}`;
		case "ignored":
			return `${operation} ignored files is not allowed: ${context}`;
		case "not_found":
			return `No such file or directory: ${context}`;
		case "destination_exists":
			return `Destination already exists: ${context}. Remove it with rm, or move it aside with mv, before retrying.`;
		case "destination_not_directory":
			return `Destination must be an existing directory when moving multiple sources: ${context}`;
		case "secret":
			return `${operation} secret files is not allowed: ${context}`;
		case "aborted":
			return "Tool execution was aborted.";
		case "missing_input":
			return `${operation} requires at least one ${context}.`;
	}
}

export function isErrnoCode(error: unknown, code: string | number): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code: unknown }).code === code
	);
}
