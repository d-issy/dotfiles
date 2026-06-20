import type {
	ExtensionContext,
	KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import {
	ExtensionEditorComponent,
	rawKeyHint,
} from "@earendil-works/pi-coding-agent";
import {
	type EditorOptions,
	type TUI,
	Text,
	matchesKey,
} from "@earendil-works/pi-tui";
import { generateRefinedPrompt } from "../prompt-refine";

export const EDITOR_PADDING_X = 1;

export const DEFAULT_EDITOR_OPTIONS = {
	paddingX: EDITOR_PADDING_X,
} as const satisfies EditorOptions;

export function defaultEditorOptions(
	overrides: EditorOptions = {},
): EditorOptions {
	return { ...DEFAULT_EDITOR_OPTIONS, ...overrides };
}
type TextEditorLike = {
	getText(): string;
	setText(text: string): void;
};

type EditorHintOptions = {
	readonly refine?: boolean;
};

function getTextEditor(component: ExtensionEditorComponent): TextEditorLike {
	return (component as unknown as { readonly editor: TextEditorLike }).editor;
}

function keyHintFromKeys(
	keybindings: KeybindingsManager,
	keybinding: Parameters<KeybindingsManager["getKeys"]>[0],
	description: string,
	fallback: string,
): string {
	const keys = keybindings.getKeys(keybinding);
	return rawKeyHint(keys.length > 0 ? keys.join("/") : fallback, description);
}

function findExtensionEditorHintIndex(
	component: ExtensionEditorComponent,
): number | undefined {
	for (let index = component.children.length - 1; index >= 0; index -= 1) {
		if (component.children[index] instanceof Text) return index;
	}
	return undefined;
}

function setExtensionEditorHint(
	component: ExtensionEditorComponent,
	keybindings: KeybindingsManager,
	options: EditorHintOptions = {},
): void {
	const hints = [
		keyHintFromKeys(keybindings, "tui.select.confirm", "submit", "enter"),
		keyHintFromKeys(keybindings, "tui.input.newLine", "newline", "shift+enter"),
		keyHintFromKeys(
			keybindings,
			"tui.select.cancel",
			"cancel",
			"escape/ctrl+c",
		),
		...(options.refine ? [rawKeyHint("ctrl+r", "refine prompt")] : []),
		keyHintFromKeys(
			keybindings,
			"app.editor.external",
			"external editor",
			"ctrl+g",
		),
	];
	const hint = new Text(hints.join("  "), 1, 0);
	const hintIndex = findExtensionEditorHintIndex(component);
	if (hintIndex === undefined) {
		component.addChild(hint);
		return;
	}
	component.children[hintIndex] = hint;
}

async function refineExtensionEditorPrompt(
	ctx: ExtensionContext,
	tui: TUI,
	component: ExtensionEditorComponent,
	notifyLabel: string,
): Promise<void> {
	const editor = getTextEditor(component);
	const original = editor.getText().trim();
	if (!original) {
		ctx.ui.notify(`Write ${notifyLabel} before refining it`, "warning");
		return;
	}

	const refined = await generateRefinedPrompt(ctx, original, { overlay: true });
	if (refined === null) {
		ctx.ui.notify("Prompt refinement cancelled", "info");
		return;
	}

	editor.setText(refined);
	tui.requestRender();
	ctx.ui.notify("Prompt refined", "info");
}

export function createExtensionEditorComponent(
	tui: TUI,
	keybindings: KeybindingsManager,
	title: string,
	prefill: string | undefined,
	onSubmit: (value: string) => void,
	onCancel: () => void,
	options: EditorOptions = {},
): ExtensionEditorComponent {
	const component = new ExtensionEditorComponent(
		tui,
		keybindings,
		title,
		prefill,
		onSubmit,
		onCancel,
		defaultEditorOptions(options),
	);
	setExtensionEditorHint(component, keybindings);
	return component;
}

export function createRefinableExtensionEditorComponent(
	ctx: ExtensionContext,
	tui: TUI,
	keybindings: KeybindingsManager,
	title: string,
	prefill: string | undefined,
	onSubmit: (value: string) => void,
	onCancel: () => void,
	options: EditorOptions = {},
	refineOptions: { readonly notifyLabel?: string } = {},
): ExtensionEditorComponent {
	const component = createExtensionEditorComponent(
		tui,
		keybindings,
		title,
		prefill,
		onSubmit,
		onCancel,
		options,
	);
	setExtensionEditorHint(component, keybindings, { refine: true });
	const handleInput = component.handleInput.bind(component);
	let refining = false;
	component.handleInput = (data: string): void => {
		if (matchesKey(data, "ctrl+r")) {
			if (refining) return;
			refining = true;
			void refineExtensionEditorPrompt(
				ctx,
				tui,
				component,
				refineOptions.notifyLabel ?? "a prompt",
			).finally(() => {
				refining = false;
			});
			return;
		}
		handleInput(data);
	};
	return component;
}
