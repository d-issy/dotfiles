import type {
	AgentToolResult,
	ExtensionContext,
	Theme,
	ThemeColor,
} from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import {
	Text,
	matchesKey,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import { type Static, Type } from "typebox";
import type { ToolPolicy } from "../policy";
import { decodePrintableInput } from "../ui";
import { toolRegistry } from "./registry";

const choiceSchema = Type.Object({
	label: Type.String({ description: "User-visible choice label." }),
	description: Type.Optional(
		Type.String({
			description:
				"Short explanation for this choice. Optional in schema, but include it when useful for the user.",
		}),
	),
	recommended: Type.Optional(
		Type.Boolean({
			description:
				"Mark this choice as recommended. The UI appends (recommend) automatically.",
		}),
	),
});

const askUserQuestionSchema = Type.Object({
	question: Type.String({
		description: "Question to ask the user, including any necessary context.",
	}),
	choices: Type.Array(choiceSchema, {
		description:
			"Choices to present. Use clear labels and add descriptions when useful.",
	}),
	multiple: Type.Optional(
		Type.Boolean({
			description: "Allow selecting more than one choice. Defaults to false.",
		}),
	),
});

type AskUserQuestionInput = Static<typeof askUserQuestionSchema>;
type AskUserQuestionChoice = AskUserQuestionInput["choices"][number];

const ASK_USER_QUESTION_TOOL = "ask-user-question";

type AskUserQuestionDetails =
	| {
			status: "answered";
			multiple: boolean;
			selected: string[];
			otherText?: string;
	  }
	| {
			status: "chat_requested";
			multiple: boolean;
			selected: string[];
			otherText?: string;
	  }
	| {
			status: "cancelled";
			multiple: boolean;
			selected: string[];
			otherText?: string;
	  }
	| {
			status: "invalid";
			reason: string;
	  };

type QuestionLabels = ReturnType<typeof labels>;
type QuestionAction =
	| { type: "choice"; label: string }
	| { type: "other" }
	| { type: "other-input" }
	| { type: "chat" }
	| { type: "done" }
	| { type: "cancel" };

type QuestionResult = {
	readonly action: QuestionAction;
	readonly index: number;
};

type QuestionRow = {
	readonly action: QuestionAction;
	readonly label: string;
	readonly description: string;
	readonly selected?: boolean;
	readonly recommended?: boolean;
	readonly section?: "choice" | "action";
};

const OTHER_LABEL = "Other";
const CHAT_LABEL = "Ask about this question";
const DONE_LABEL = "Done";

function labels(): {
	other: string;
	chat: string;
	done: string;
	otherPlaceholder: string;
	doneDescription: string;
	chatDescription: string;
	helpSingle: string;
	helpMultiple: string;
} {
	return {
		other: OTHER_LABEL,
		chat: CHAT_LABEL,
		done: DONE_LABEL,
		otherPlaceholder: "Free-form answer",
		doneDescription: "Finish with the selected answers",
		chatDescription:
			"Discuss this question in normal chat instead of answering now",
		helpSingle: "↑↓/j/k move • Enter select • Tab edits Other • Esc cancel",
		helpMultiple:
			"↑↓/j/k move • Space toggles/activates • Enter done • Tab edits Other • Esc cancel",
	};
}

function validateInput(params: AskUserQuestionInput): string | undefined {
	const text = labels();
	const reserved = new Set([text.other, text.chat, text.done]);
	const seen = new Set<string>();
	for (const choice of params.choices) {
		const label = choice.label.trim();
		if (!label) return "Choice labels must be non-empty.";
		if (reserved.has(label)) return `Choice label is reserved: ${label}`;
		if (seen.has(label)) return `Duplicate choice label: ${label}`;
		seen.add(label);
	}

	const multiple = params.multiple ?? false;
	const recommendedCount = params.choices.filter(
		(choice) => choice.recommended === true,
	).length;
	if (!multiple && recommendedCount !== 1) {
		return "Single-choice questions must have exactly one recommended choice.";
	}
	return undefined;
}

function formatSelection(details: {
	readonly selected: readonly string[];
	readonly otherText?: string;
}): string {
	const selected = details.selected.map((label) =>
		label === OTHER_LABEL && details.otherText
			? `${OTHER_LABEL}: ${details.otherText}`
			: label,
	);
	if (selected.length > 0) return selected.join(", ");
	return details.otherText ? `${OTHER_LABEL}: ${details.otherText}` : "none";
}

function resultText(details: AskUserQuestionDetails): string {
	if (details.status === "invalid") {
		return `Question was invalid: ${details.reason}`;
	}
	if (details.status === "cancelled") {
		return "User cancelled the question.";
	}
	if (details.status === "chat_requested") {
		return `User wants to discuss this question in chat instead of answering now. Current selection: ${formatSelection(details)}`;
	}
	const label = details.multiple ? "answers" : "answer";
	return `User selected ${label}: ${formatSelection(details)}`;
}

function resultColor(details: AskUserQuestionDetails): ThemeColor {
	if (details.status === "answered") return "success";
	if (details.status === "invalid") return "error";
	if (details.status === "cancelled") return "error";
	return "accent";
}

function renderInterviewResult(
	result: AgentToolResult<AskUserQuestionDetails>,
	options: { readonly expanded: boolean },
	theme: Theme,
): Text {
	const text = resultText(result.details);
	const display = options.expanded ? text : (text.split("\n")[0] ?? "");
	return new Text(theme.fg(resultColor(result.details), display), 0, 0);
}

function isErrorInterviewResult(details: AskUserQuestionDetails): boolean {
	return details.status === "cancelled" || details.status === "invalid";
}

function invalidResult(
	reason: string,
): AgentToolResult<AskUserQuestionDetails> {
	const details = { status: "invalid" as const, reason };
	return {
		content: [{ type: "text", text: resultText(details) }],
		details,
	};
}

function answeredResult(
	details: AskUserQuestionDetails,
): AgentToolResult<AskUserQuestionDetails> {
	return {
		content: [{ type: "text", text: resultText(details) }],
		details,
	};
}

function selectedChoices(
	choices: readonly AskUserQuestionChoice[],
	selected: ReadonlySet<string>,
): string[] {
	return choices
		.map((choice) => choice.label)
		.filter((label) => selected.has(label));
}

function appendOther(selected: string[], otherSelected: boolean): string[] {
	return otherSelected ? [...selected, OTHER_LABEL] : selected;
}

function choiceDescription(choice: AskUserQuestionChoice): string {
	return choice.description?.trim() || "";
}

function choiceLabel(choice: AskUserQuestionChoice): string {
	return choice.recommended === true
		? `${choice.label} (recommend)`
		: choice.label;
}

function otherDescription(
	text: QuestionLabels,
	multiple: boolean,
	otherText: string | undefined,
): string {
	if (!multiple) {
		return otherText
			? `${otherText} (Tab to edit)`
			: "Press Tab or Enter to write a custom answer";
	}
	return otherText
		? `${otherText} (Tab to edit)`
		: "Press Tab to write a custom answer";
}

function makeRows(
	params: AskUserQuestionInput,
	text: QuestionLabels,
	multiple: boolean,
	selected: ReadonlySet<string>,
	otherText: string | undefined,
	otherSelected: boolean,
): QuestionRow[] {
	const choiceRows = params.choices.map((choice) => ({
		action: { type: "choice" as const, label: choice.label },
		label: choiceLabel(choice),
		description: choiceDescription(choice),
		selected: selected.has(choice.label),
		recommended: choice.recommended === true,
		section: "choice" as const,
	}));
	return [
		...choiceRows,
		{
			action: { type: "other" },
			label: text.other,
			description: otherDescription(text, multiple, otherText),
			selected: otherSelected,
			section: "choice",
		},
		...(multiple
			? [
					{
						action: { type: "done" as const },
						label: text.done,
						description: text.doneDescription,
						section: "action" as const,
					},
				]
			: []),
		{
			action: { type: "chat" },
			label: text.chat,
			description: text.chatDescription,
			section: "action",
		},
	];
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
		if (current) lines.push(current.trimEnd());
		current = char.trimStart();
	}
	if (current || lines.length === 0) lines.push(current);
	return lines;
}

function wrapText(text: string, width: number): string[] {
	return text.split("\n").flatMap((line) => wrapLine(line, width));
}

function renderQuestionLines(
	theme: Theme,
	line: string,
	width: number,
): string[] {
	return wrapLine(line, width).map((wrapped) =>
		truncateToWidth(theme.fg("accent", theme.bold(wrapped)), width, ""),
	);
}

function styledLabel(theme: Theme, row: QuestionRow, label: string): string {
	if (row.recommended) return theme.fg("success", label);
	return label;
}

function renderRow(
	theme: Theme,
	row: QuestionRow,
	options: { width: number; current: boolean; multiple: boolean },
): string[] {
	const pointer = options.current ? theme.fg("accent", "→") : " ";
	const checkbox =
		row.section === "choice" && options.multiple
			? row.selected
				? theme.fg("success", "[x]")
				: theme.fg("muted", "[ ]")
			: "";
	const prefix = checkbox ? `${pointer} ${checkbox} ` : `${pointer} `;
	const prefixWidth = visibleWidth(prefix);
	const labelWidth = Math.max(1, options.width - prefixWidth);
	const labelLines = wrapText(row.label, labelWidth);
	const lines = labelLines.map((label, index) => {
		const linePrefix = index === 0 ? prefix : " ".repeat(prefixWidth);
		const labelText = options.current
			? theme.fg("accent", label)
			: styledLabel(theme, row, label);
		return truncateToWidth(`${linePrefix}${labelText}`, options.width, "");
	});
	if (row.description) {
		const descriptionPrefix = "    ";
		const descriptionWidth = Math.max(
			1,
			options.width - descriptionPrefix.length,
		);
		for (const description of wrapText(row.description, descriptionWidth)) {
			lines.push(
				truncateToWidth(
					theme.fg("muted", `${descriptionPrefix}${description}`),
					options.width,
					"",
				),
			);
		}
	}
	return lines;
}

async function showQuestion(
	ctx: ExtensionContext,
	params: AskUserQuestionInput,
	text: QuestionLabels,
	options: {
		readonly multiple: boolean;
		readonly selected: ReadonlySet<string>;
		readonly otherText: string | undefined;
		readonly otherSelected?: boolean;
		readonly initialIndex?: number;
	},
): Promise<QuestionResult> {
	const rows = makeRows(
		params,
		text,
		options.multiple,
		options.selected,
		options.otherText,
		options.otherSelected ?? Boolean(options.otherText),
	);
	const action = await ctx.ui.custom<QuestionResult>(
		(tui, theme, keybindings, done) => {
			const border = new DynamicBorder((value) => theme.fg("accent", value));
			let current = Math.min(options.initialIndex ?? 0, rows.length - 1);
			const move = (delta: -1 | 1): void => {
				current = (current + delta + rows.length) % rows.length;
			};
			const finish = (nextAction: QuestionAction): void =>
				done({ action: nextAction, index: current });
			const select = (): void => finish(rows[current].action);
			return {
				render(width: number) {
					const help = options.multiple ? text.helpMultiple : text.helpSingle;
					const lines = [
						...border.render(width),
						...params.question
							.split("\n")
							.flatMap((line) => renderQuestionLines(theme, line, width)),
						...wrapText(help, width).map((line) =>
							truncateToWidth(theme.fg("dim", line), width, ""),
						),
						"",
					];
					for (const [index, row] of rows.entries()) {
						if (
							index > 0 &&
							row.section === "action" &&
							rows[index - 1]?.section === "choice"
						) {
							lines.push(
								truncateToWidth(theme.fg("dim", "─".repeat(width)), width, ""),
							);
						}
						lines.push(
							...renderRow(theme, row, {
								width,
								current: index === current,
								multiple: options.multiple,
							}),
						);
					}
					lines.push(...border.render(width));
					return lines;
				},
				invalidate: () => border.invalidate(),
				handleInput(data: string) {
					const printable = decodePrintableInput(data)?.toLowerCase();
					if (keybindings.matches(data, "tui.select.up") || printable === "k") {
						move(-1);
						tui.requestRender();
						return;
					}
					if (
						keybindings.matches(data, "tui.select.down") ||
						printable === "j"
					) {
						move(1);
						tui.requestRender();
						return;
					}
					if (keybindings.matches(data, "tui.select.confirm")) {
						finish(options.multiple ? { type: "done" } : rows[current].action);
						return;
					}
					if (keybindings.matches(data, "tui.select.cancel")) {
						finish({ type: "cancel" });
						return;
					}
					if (matchesKey(data, "tab")) {
						finish({ type: "other-input" });
						return;
					}
					if (printable === " ") select();
				},
			};
		},
	);
	return (
		action ?? { action: { type: "cancel" }, index: options.initialIndex ?? 0 }
	);
}

async function showOtherInput(
	ctx: ExtensionContext,
	text: QuestionLabels,
	initialValue: string | undefined,
): Promise<string | undefined> {
	return ctx.ui.editor(text.other, initialValue ?? "");
}

async function askSingle(
	params: AskUserQuestionInput,
	ctx: ExtensionContext,
): Promise<AgentToolResult<AskUserQuestionDetails>> {
	const text = labels();
	let currentIndex = 0;

	while (true) {
		// oxlint-disable-next-line no-await-in-loop -- Other input may return to the same question.
		const result = await showQuestion(ctx, params, text, {
			multiple: false,
			selected: new Set(),
			otherText: undefined,
			initialIndex: currentIndex,
		});
		const { action } = result;
		currentIndex = result.index;
		if (action.type === "cancel") {
			return answeredResult({
				status: "cancelled",
				multiple: false,
				selected: [],
			});
		}
		if (action.type === "chat") {
			return answeredResult({
				status: "chat_requested",
				multiple: false,
				selected: [],
			});
		}
		if (action.type === "other" || action.type === "other-input") {
			// oxlint-disable-next-line no-await-in-loop -- Other input is part of the current question flow.
			const otherText = await showOtherInput(ctx, text, undefined);
			if (otherText === undefined || !otherText.trim()) continue;
			return answeredResult({
				status: "answered",
				multiple: false,
				selected: [OTHER_LABEL],
				otherText: otherText.trim(),
			});
		}
		if (action.type !== "choice") continue;
		return answeredResult({
			status: "answered",
			multiple: false,
			selected: [action.label],
		});
	}
}

async function askMultiple(
	params: AskUserQuestionInput,
	ctx: ExtensionContext,
): Promise<AgentToolResult<AskUserQuestionDetails>> {
	const text = labels();
	const selected = new Set<string>();
	let otherText: string | undefined;
	let otherSelected = false;
	let currentIndex = 0;

	while (true) {
		// oxlint-disable-next-line no-await-in-loop -- each iteration depends on the user's previous selection.
		const result = await showQuestion(ctx, params, text, {
			multiple: true,
			selected,
			otherText,
			otherSelected,
			initialIndex: currentIndex,
		});
		const { action } = result;
		currentIndex = result.index;
		if (action.type === "cancel") {
			return answeredResult({
				status: "cancelled",
				multiple: true,
				selected: appendOther(
					selectedChoices(params.choices, selected),
					otherSelected,
				),
				otherText: otherSelected ? otherText : undefined,
			});
		}
		if (action.type === "chat") {
			return answeredResult({
				status: "chat_requested",
				multiple: true,
				selected: appendOther(
					selectedChoices(params.choices, selected),
					otherSelected,
				),
				otherText: otherSelected ? otherText : undefined,
			});
		}
		if (action.type === "done") {
			const chosen = appendOther(
				selectedChoices(params.choices, selected),
				otherSelected,
			);
			if (chosen.length === 0) {
				return answeredResult({
					status: "cancelled",
					multiple: true,
					selected: [],
				});
			}
			return answeredResult({
				status: "answered",
				multiple: true,
				selected: chosen,
				otherText: otherSelected ? otherText : undefined,
			});
		}
		if (action.type === "other") {
			otherSelected = otherSelected ? false : Boolean(otherText);
			continue;
		}
		if (action.type === "other-input") {
			// oxlint-disable-next-line no-await-in-loop -- Other input is part of the current selection loop state.
			const input = await showOtherInput(ctx, text, otherText);
			if (input !== undefined) {
				otherText = input.trim() || undefined;
				otherSelected = Boolean(otherText);
			}
			continue;
		}
		if (action.type !== "choice") continue;
		if (selected.has(action.label)) selected.delete(action.label);
		else selected.add(action.label);
	}
}

export function registerInterviewTools(): void {
	const policy: ToolPolicy<AskUserQuestionInput> = {
		name: ASK_USER_QUESTION_TOOL,
	};

	toolRegistry.register({
		policy,
		isErrorResult: isErrorInterviewResult,
		definition: {
			name: ASK_USER_QUESTION_TOOL,
			label: ASK_USER_QUESTION_TOOL,
			description:
				"Ask the user a structured interview question with described choices, automatic Other, recommendation markers, and an option to discuss the question in chat.",
			promptSnippet:
				"Ask a structured user interview question with choices, Other, and chat fallback",
			promptGuidelines: [
				"Use ask-user-question to ask one necessary structured interview question at a time.",
				"For ask-user-question choices, include descriptions when they help the user compare options.",
				"For single-choice ask-user-question calls, mark exactly one choice as recommended; the tool displays (recommend) automatically.",
			],
			parameters: askUserQuestionSchema,
			executionMode: "sequential",
			renderResult: renderInterviewResult,
			execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
				if (!ctx.hasUI) return invalidResult("UI is unavailable.");
				const error = validateInput(params);
				if (error) return invalidResult(error);
				return params.multiple === true
					? askMultiple(params, ctx)
					: askSingle(params, ctx);
			},
		},
	});
}
