export type Color = readonly [red: number, green: number, blue: number];

type Palette = Readonly<{
	blue: Color;
	green: Color;
	yellow: Color;
	red: Color;
	overlay0: Color;
}>;

// Catppuccin flavors (https://catppuccin.com). Each flavor is a full palette;
// switch the active one via ACTIVE_THEME below.
const catppuccin = {
	latte: {
		blue: [30, 102, 245],
		green: [64, 160, 43],
		yellow: [223, 142, 29],
		red: [210, 15, 57],
		overlay0: [156, 160, 176],
	},
	frappe: {
		blue: [140, 170, 238],
		green: [166, 209, 137],
		yellow: [229, 200, 144],
		red: [231, 130, 132],
		overlay0: [115, 121, 148],
	},
	macchiato: {
		blue: [138, 173, 244],
		green: [166, 218, 149],
		yellow: [238, 212, 159],
		red: [237, 135, 150],
		overlay0: [110, 115, 141],
	},
	mocha: {
		blue: [137, 180, 250],
		green: [166, 227, 161],
		yellow: [249, 226, 175],
		red: [243, 139, 168],
		overlay0: [108, 112, 134],
	},
} as const satisfies Readonly<Record<string, Palette>>;

export type ThemeName = keyof typeof catppuccin;

// Switch the active theme here.
const ACTIVE_THEME: ThemeName = "macchiato";

const palette: Palette = catppuccin[ACTIVE_THEME];

// Semantic roles are the only color vocabulary the rest of the app uses,
// so swapping themes never touches code outside this file.
export const colors = {
	accent: palette.blue,
	positive: palette.green,
	caution: palette.yellow,
	alert: palette.red,
	muted: palette.overlay0,
} as const satisfies Readonly<Record<string, Color>>;

export type ColorRole = keyof typeof colors;

export function fg([red, green, blue]: Color, text: string): string {
	return `\x1b[38;2;${red};${green};${blue}m${text}\x1b[39m`;
}
