export type FocusName = string;

export function makeSecretActionReason(
	verb: string,
): (focusName: FocusName) => string {
	return (focusName) =>
		`${verb} secret files is disabled in ${focusName} focus.`;
}

export type ToolPolicy<TInput = unknown> = {
	readonly name: string;
	readonly extractSecretPaths?: (input: TInput) => readonly string[];
	readonly secretBlockReason?: (focusName: FocusName) => string;
	readonly notAllowedReason?: (focusName: FocusName) => string;
};
