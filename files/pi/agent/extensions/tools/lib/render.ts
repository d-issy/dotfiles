import type { Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

export function renderToolHeader(
	name: string,
	paths: string[],
	theme: Theme,
	options?: { destination?: string; suffix?: string },
): Text {
	let text = theme.fg("toolTitle", theme.bold(name));
	if (paths.length === 1) {
		text += ` ${theme.fg("accent", paths[0])}`;
	} else if (paths.length > 1) {
		text += ` ${theme.fg("accent", `${paths.length} items`)}`;
	}
	if (options?.destination) {
		text += theme.fg("dim", " -> ");
		text += theme.fg("accent", options.destination);
	}
	if (options?.suffix) {
		text += theme.fg("dim", ` ${options.suffix}`);
	}
	return new Text(text, 0, 0);
}
