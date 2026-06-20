import {
	DynamicBorder,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	matchesKey,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import {
	createRefinableExtensionEditorComponent,
	decodePrintableInput,
} from "../ui";
import { type KeyedPanelItem, renderKeyedPanelItem } from "../ui/keyed-panel";

export type FocusConfirmDecision =
	| "allow-once"
	| "deny-once"
	| "allow-session"
	| "deny-session";

type FocusConfirmItem = KeyedPanelItem & {
	value: FocusConfirmDecision;
};

export type ExitFocusDecision =
	| { confirmed: true }
	| { confirmed: false; rejectReason?: string };

type ExitFocusAction = "confirm" | "deny" | "deny-with-reason" | "reason-input";

type ExitFocusItem = KeyedPanelItem & {
	value: Exclude<ExitFocusAction, "reason-input">;
};

const sessionAllowedConfirmFocuses = new Set<string>();
const sessionDeniedConfirmFocuses = new Set<string>();
const DIALOG_HORIZONTAL_PADDING = 1;

function dialogContentWidth(width: number): number {
	return Math.max(1, width - DIALOG_HORIZONTAL_PADDING * 2);
}

function padDialogLine(line: string, width: number): string {
	const contentWidth = width - DIALOG_HORIZONTAL_PADDING * 2;
	if (contentWidth < 1) return truncateToWidth(line, width, "");
	const content = truncateToWidth(line, contentWidth, "");
	return `${" ".repeat(DIALOG_HORIZONTAL_PADDING)}${content}${" ".repeat(
		Math.max(0, contentWidth - visibleWidth(content)) +
			DIALOG_HORIZONTAL_PADDING,
	)}`;
}

function wrapLine(line: string, width: number): string[] {
	const maxWidth = Math.max(1, width);
	if (!line) return [""];
	const lines: string[] = [];
	let current = "";
	for (const char of line) {
		const next = current + char;
		if (visibleWidth(next) <= maxWidth) {
			current = next;
			continue;
		}

		const breakIndex = current.search(/\s+\S*$/u);
		if (breakIndex > 0) {
			lines.push(current.slice(0, breakIndex).trimEnd());
			current = `${current.slice(breakIndex).trimStart()}${char}`;
			continue;
		}

		if (current) lines.push(current.trimEnd());
		current = char.trimStart();
	}
	if (current || lines.length === 0) lines.push(current);
	return lines;
}

function wrapPrefixedText(
	prefix: string,
	text: string,
	width: number,
): string[] {
	const continuationPrefix = " ".repeat(visibleWidth(prefix));
	return text
		.trim()
		.split("\n")
		.flatMap((line, index) => {
			const linePrefix = index === 0 ? prefix : continuationPrefix;
			const lineWidth = Math.max(1, width - visibleWidth(linePrefix));
			return wrapLine(line, lineWidth).map(
				(wrapped, wrappedIndex) =>
					`${wrappedIndex === 0 ? linePrefix : continuationPrefix}${wrapped}`,
			);
		});
}

function renderReasonLines(
	theme: { fg(role: string, text: string): string },
	reason: string,
	width: number,
): string[] {
	return wrapPrefixedText("Reason: ", reason, dialogContentWidth(width)).map(
		(line) => padDialogLine(theme.fg("dim", line), width),
	);
}

function focusConfirmItems(): readonly FocusConfirmItem[] {
	return [
		{
			key: "y",
			value: "allow-once",
			label: "Allow once",
			description: "Enter this focus once.",
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

function exitFocusItems(): readonly ExitFocusItem[] {
	return [
		{
			key: "y",
			value: "confirm",
			label: "Yes",
			description: "Exit this focus and return to base focus.",
		},
		{
			key: "n",
			value: "deny",
			label: "No",
			description: "Stay in this focus without a reject reason.",
		},
		{
			key: "r",
			value: "deny-with-reason",
			label: "No with reason",
			description: "Stay in this focus and write a reject reason.",
		},
	];
}

export async function confirmFocusTransition(
	ctx: ExtensionContext,
	name: string,
	reason: string,
): Promise<FocusConfirmDecision | undefined> {
	const items = focusConfirmItems();
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
					const contentWidth = dialogContentWidth(width);
					return [
						...border.render(width),
						padDialogLine(
							theme.fg("accent", theme.bold(`Enter focus: ${name}`)),
							width,
						),
						...renderReasonLines(theme, reason, width),
						...items.map((item, index) =>
							padDialogLine(
								renderKeyedPanelItem(theme, item, {
									width: contentWidth,
									selected: index === selectedIndex,
									labelWidth: 30,
								}),
								width,
							),
						),
						padDialogLine(
							theme.fg(
								"dim",
								"y/n/a/d select • ↑↓ navigate • enter select • esc cancel",
							),
							width,
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

async function editExitRejectReason(
	ctx: ExtensionContext,
	name: string,
	reason: string,
	initialValue: string | undefined,
): Promise<string | undefined> {
	const title = [
		"Provide Reject Reason",
		"",
		`Focus: ${name}`,
		reason.trim() ? `Exit reason: ${reason.trim()}` : undefined,
	]
		.filter((line): line is string => line !== undefined)
		.join("\n");
	return ctx.ui.custom<string | undefined>((tui, _theme, keybindings, done) =>
		createRefinableExtensionEditorComponent(
			ctx,
			tui,
			keybindings,
			title,
			initialValue ?? "",
			(value) => done(value),
			() => done(undefined),
			{},
			{ notifyLabel: "a reject reason" },
		),
	);
}

async function chooseExitFocusAction(
	ctx: ExtensionContext,
	name: string,
	reason: string,
	initialIndex: number,
): Promise<{ action: ExitFocusAction; index: number } | undefined> {
	const items = exitFocusItems();
	return ctx.ui.custom<{ action: ExitFocusAction; index: number } | undefined>(
		(tui, theme, keybindings, done) => {
			const border = new DynamicBorder((text) => theme.fg("accent", text));
			let selectedIndex = Math.min(initialIndex, items.length - 1);
			const move = (delta: -1 | 1): void => {
				selectedIndex = (selectedIndex + delta + items.length) % items.length;
			};
			const finish = (action: ExitFocusAction): void => {
				done({ action, index: selectedIndex });
			};
			const select = (item: ExitFocusItem): void => finish(item.value);
			return {
				render(width: number) {
					const contentWidth = dialogContentWidth(width);
					return [
						...border.render(width),
						padDialogLine(
							theme.fg("accent", theme.bold(`Exit focus: ${name}`)),
							width,
						),
						...renderReasonLines(theme, reason, width),
						...items.map((item, index) =>
							padDialogLine(
								renderKeyedPanelItem(theme, item, {
									width: contentWidth,
									selected: index === selectedIndex,
									labelWidth: 26,
								}),
								width,
							),
						),
						padDialogLine(
							theme.fg(
								"dim",
								"y/n/r select • ↑↓ navigate • Enter select • Tab write reject reason • Esc cancel",
							),
							width,
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
					if (matchesKey(data, "tab")) {
						finish("reason-input");
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

export async function confirmExitFocusTransition(
	ctx: ExtensionContext,
	name: string,
	reason: string,
): Promise<ExitFocusDecision | undefined> {
	let selectedIndex = 0;
	let rejectReason: string | undefined;
	while (true) {
		// oxlint-disable-next-line no-await-in-loop -- reason editing may return to the same confirmation.
		const result = await chooseExitFocusAction(
			ctx,
			name,
			reason,
			selectedIndex,
		);
		if (!result) return undefined;
		selectedIndex = result.index;
		if (result.action === "confirm") return { confirmed: true };
		if (result.action === "deny") return { confirmed: false };
		// oxlint-disable-next-line no-await-in-loop -- reason editing is part of the confirmation flow.
		const input = await editExitRejectReason(ctx, name, reason, rejectReason);
		if (input === undefined) continue;
		rejectReason = input.trim() || undefined;
		if (rejectReason) return { confirmed: false, rejectReason };
	}
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
