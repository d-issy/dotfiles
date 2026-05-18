const SECRET_PATTERNS: readonly RegExp[] = [
	/(^|\/)\.env(\..+)?$/u,
	/(^|\/)\.envrc$/u,
];

export function isSecretPath(path: string): boolean {
	return SECRET_PATTERNS.some((re) => re.test(path));
}
