const SECRET_PATTERNS: readonly RegExp[] = [
	/(^|\/)\.env(\..+)?$/,
	/(^|\/)\.envrc$/,
];

export function isSecretPath(path: string): boolean {
	return SECRET_PATTERNS.some((re) => re.test(path));
}
