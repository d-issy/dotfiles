export type Color = readonly [red: number, green: number, blue: number];

export const catppuccin = {
	blue: [138, 173, 244],
	green: [166, 218, 149],
	overlay0: [110, 115, 141],
	red: [237, 135, 150],
	yellow: [238, 212, 159],
} as const satisfies Readonly<Record<string, Color>>;

export type ColorName = keyof typeof catppuccin;

export function fg([red, green, blue]: Color, text: string): string {
	return `\x1b[38;2;${red};${green};${blue}m${text}\x1b[39m`;
}
