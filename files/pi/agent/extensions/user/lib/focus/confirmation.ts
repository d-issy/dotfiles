import {
	DynamicBorder,
	type ExtensionContext,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { decodePrintableInput } from "../ui";

export type FocusConfirmDecision =
	| "allow-once"
	| "deny-once"
	| "allow-session"
	| "deny-session";

type FocusConfirmItem = {
	key: string;
	value: FocusConfirmDecision;
	label: string;
	description: string;
};

const sessionAllowedConfirmFocuses = new Set<string>();
const sessionDeniedConfirmFocuses = new Set<string>();

function focusConfirmItems(description: string): readonly FocusConfirmItem[] {
	return [
		{
			key: "y",
			value: "allow-once",
			label: "Allow once",
			description,
		},
		{
			key: "n",
			value: "deny-once",
			label: "Deny once",
			description: "Decline this request only.",
		},
		{
			key: "a",
			value: "allow-session",
			label: "Allow this session only",
			description: "Enter this focus without asking again in this session.",
		},
		{
			key: "d",
			value: "deny-session",
			label: "Deny this session only",
			description: "Decline this focus without asking again in this session.",
		},
	];
}

function renderFocusConfirmItem(
	theme: Theme,
	item: FocusConfirmItem,
	selected: boolean,
	width: number,
): string {
	const prefix = selected ? theme.fg("accent", "→ ") : "  ";
	const key = theme.fg("accent", item.key);
	const label = selected ? theme.fg("accent", item.label) : item.label;
	const left = `${prefix}${key}  ${label}`;
	const gap = " ".repeat(Math.max(1, 30 - visibleWidth(left)));
	return truncateToWidth(
		`${left}${theme.fg("muted", gap + item.description)}`,
		width,
		"",
	);
}

export async function confirmFocusTransition(
	ctx: ExtensionContext,
	name: string,
	description: string,
	reason: string,
): Promise<FocusConfirmDecision | undefined> {
	const items = focusConfirmItems(description);
	return ctx.ui.custom<FocusConfirmDecision | undefined>(
		(tui, theme, keybindings, done) => {
			const border = new DynamicBorder((text) => theme.fg("accent", text));
			let selectedIndex = 0;
			const move = (delta: -1 | 1): void => {
				selectedIndex = (selectedIndex + delta + items.length) % items.length;
			};
			const select = (item: FocusConfirmItem): void => done(item.value);
			return {
				render(width: number) {
					return [
						...border.render(width),
						truncateToWidth(
							theme.fg("accent", theme.bold(`Enter focus: ${name}`)),
							width,
							"",
						),
						truncateToWidth(theme.fg("dim", `Reason: ${reason}`), width, ""),
						...items.map((item, index) =>
							renderFocusConfirmItem(
								theme,
								item,
								index === selectedIndex,
								width,
							),
						),
						truncateToWidth(
							theme.fg(
								"dim",
								"y/n/a/d select • ↑↓ navigate • enter select • esc cancel",
							),
							width,
							"",
						),
						...border.render(width),
					];
				},
				invalidate: () => border.invalidate(),
				handleInput(data: string) {
					if (keybindings.matches(data, "tui.select.up")) {
						move(-1);
						tui.requestRender();
						return;
					}
					if (keybindings.matches(data, "tui.select.down")) {
						move(1);
						tui.requestRender();
						return;
					}
					if (keybindings.matches(data, "tui.select.confirm")) {
						select(items[selectedIndex]);
						return;
					}
					if (keybindings.matches(data, "tui.select.cancel")) {
						done(undefined);
						return;
					}
					const input = decodePrintableInput(data);
					if (!input) return;
					const key = input.toLowerCase();
					const item = items.find((entry) => entry.key === key);
					if (item) select(item);
				},
			};
		},
	);
}

export function rememberFocusTransitionDecision(
	name: string,
	decision: FocusConfirmDecision,
): void {
	if (decision === "allow-session") {
		sessionDeniedConfirmFocuses.delete(name);
		sessionAllowedConfirmFocuses.add(name);
	}
	if (decision === "deny-session") {
		sessionAllowedConfirmFocuses.delete(name);
		sessionDeniedConfirmFocuses.add(name);
	}
}

export function clearFocusTransitionDecisions(): void {
	sessionAllowedConfirmFocuses.clear();
	sessionDeniedConfirmFocuses.clear();
}

export function isFocusAllowedForSession(name: string): boolean {
	return sessionAllowedConfirmFocuses.has(name);
}

export function isFocusDeniedForSession(name: string): boolean {
	return sessionDeniedConfirmFocuses.has(name);
}
