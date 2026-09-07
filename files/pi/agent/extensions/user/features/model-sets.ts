import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import {
	CustomEditor,
	DynamicBorder,
	type ExtensionAPI,
	type ExtensionContext,
	getAgentDir,
} from "@earendil-works/pi-coding-agent";
import {
	Input,
	fuzzyFilter,
	matchesKey,
	truncateToWidth,
} from "@earendil-works/pi-tui";
import { type FastController, supportsFast } from "./fast";

export interface ModelSet {
	provider: string;
	model: string;
	thinking: string;
	fast: boolean;
}

export function modelSetLabel(preset: ModelSet): string {
	return `${preset.model} ${preset.thinking}${preset.fast ? " fast" : ""} (${preset.provider})`;
}

export function sameModelSet(a: ModelSet, b: ModelSet): boolean {
	return (
		a.provider === b.provider &&
		a.model === b.model &&
		a.thinking === b.thinking &&
		a.fast === b.fast
	);
}

export function readModelSets(path: string): ModelSet[] {
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
	const value: unknown = JSON.parse(text);
	if (
		!Array.isArray(value) ||
		!value.every((item: unknown) => {
			if (!item || typeof item !== "object") return false;
			const p = item as Record<string, unknown>;
			return (
				typeof p.provider === "string" &&
				p.provider.length > 0 &&
				typeof p.model === "string" &&
				p.model.length > 0 &&
				typeof p.thinking === "string" &&
				p.thinking.length > 0 &&
				typeof p.fast === "boolean"
			);
		})
	)
		throw new Error(`Invalid model sets file: ${path}`);
	return value as ModelSet[];
}

export function writeModelSets(path: string, sets: ModelSet[]): void {
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.${process.pid}.tmp`;
	writeFileSync(temporary, `${JSON.stringify(sets, null, 2)}\n`, {
		mode: 0o600,
	});
	renameSync(temporary, path);
}

export function registerModelSetsFeature(
	pi: ExtensionAPI,
	fast: FastController,
): void {
	let open = false;
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI || ctx.mode !== "tui") return;
		const previous = ctx.ui.getEditorComponent();
		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			const editor =
				previous?.(tui, theme, keybindings) ??
				new CustomEditor(tui, theme, keybindings);
			const handleInput = editor.handleInput.bind(editor);
			// Intercept only main-editor input, not keys in built-in pickers.
			editor.handleInput = (data: string): void => {
				if (!matchesKey(data, "ctrl+p")) {
					handleInput(data);
					return;
				}
				if (open) return;
				open = true;
				void showPicker(pi, ctx, fast)
					.catch((error: unknown) =>
						ctx.ui.notify(`Model sets: ${String(error)}`, "error"),
					)
					.finally(() => {
						open = false;
					});
			};
			return editor;
		});
	});
}

async function showPicker(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	fast: FastController,
): Promise<void> {
	const path = join(getAgentDir(), "model-sets.json");
	let sets = readModelSets(path);
	const current: ModelSet | undefined = ctx.model
		? {
				provider: ctx.model.provider,
				model: ctx.model.id,
				thinking: pi.getThinkingLevel(),
				fast: fast.isEnabled(ctx.model),
			}
		: undefined;
	const selected = await ctx.ui.custom<ModelSet | undefined>(
		(tui, theme, _kb, done) => {
			const input = new Input();
			let focused = false;
			const border = new DynamicBorder((text) => theme.fg("accent", text));
			let index = Math.max(
				0,
				sets.findIndex((p) => current && sameModelSet(p, current)),
			);
			let message = "";
			let deleting: ModelSet | undefined;
			const filtered = (): ModelSet[] => {
				const tokens = input.getValue().toLowerCase().split(/\s+/u);
				const candidates = sets.filter(
					(p) =>
						(!tokens.includes("fast") || p.fast) &&
						(!tokens.includes("nofast") || !p.fast),
				);
				const query = tokens
					.filter((token) => token !== "fast" && token !== "nofast")
					.join(" ");
				return fuzzyFilter(candidates, query, modelSetLabel);
			};
			const update = (next: ModelSet[]): void => {
				writeModelSets(path, next);
				sets = next;
			};
			return {
				get focused(): boolean {
					return focused;
				},
				set focused(value: boolean) {
					focused = value;
					input.focused = value;
				},
				invalidate(): void {
					input.invalidate();
				},
				render(width: number): string[] {
					const items = filtered();
					index = Math.max(0, Math.min(index, items.length - 1));
					const start = Math.max(0, Math.min(index - 5, items.length - 10));
					return [
						...border.render(width),
						"",
						theme.fg("accent", "  Model sets"),
						truncateToWidth(
							theme.fg(
								"muted",
								`  Current: ${current ? modelSetLabel(current) : "no model"}`,
							),
							width,
						),
						"",
						...input.render(width),
						"",
						...(items.length
							? items.slice(start, start + 10).map((p, i) => {
									const check =
										current && sameModelSet(p, current)
											? theme.fg("success", " ✓")
											: "";
									const isSelected = start + i === index;
									const label = `${isSelected ? "→ " : "  "}${p.model} ${p.thinking}${p.fast ? " fast" : ""}`;
									const provider = theme.fg("muted", `(${p.provider})`);
									return truncateToWidth(
										`${isSelected ? theme.fg("accent", label) : label} ${provider}${check}`,
										width,
									);
								})
							: [
									theme.fg(
										"muted",
										sets.length
											? "No matches"
											: "No saved settings. Ctrl+S saves the current settings.",
									),
								]),
						...(items.length > 10
							? [theme.fg("muted", `  (${index + 1}/${items.length})`)]
							: []),
						"",
						...(message
							? [truncateToWidth(theme.fg("warning", message), width)]
							: []),
						truncateToWidth(
							theme.fg(
								"dim",
								deleting
									? "Enter delete · Esc cancel"
									: "  ↑↓ navigate · Enter apply · Esc cancel",
							),
							width,
						),
						...(!deleting
							? [
									truncateToWidth(
										theme.fg(
											"dim",
											"  Ctrl+S save current · Ctrl+D delete selected",
										),
										width,
									),
								]
							: []),
						"",
						...border.render(width),
					];
				},
				handleInput(data: string): void {
					try {
						if (deleting) {
							if (matchesKey(data, "enter")) {
								update(
									readModelSets(path).filter(
										(p) => !sameModelSet(p, deleting!),
									),
								);
								deleting = undefined;
								message = "Deleted";
							} else if (matchesKey(data, "escape")) {
								deleting = undefined;
								message = "";
							}
						} else if (matchesKey(data, "ctrl+s")) {
							if (!current) {
								message = "No model selected";
							} else {
								const latest = readModelSets(path);
								if (latest.some((p) => sameModelSet(p, current))) {
									sets = latest;
									message = "Already saved";
								} else {
									update([...latest, current]);
									message = "Saved current settings";
								}
								input.setValue("");
								index = sets.findIndex((p) => sameModelSet(p, current));
							}
						} else if (matchesKey(data, "ctrl+d")) {
							deleting = filtered()[index];
							if (deleting) message = `Delete ${modelSetLabel(deleting)}?`;
						} else if (matchesKey(data, "escape")) {
							done(undefined);
						} else if (matchesKey(data, "enter")) {
							const item = filtered()[index];
							if (item) done(item);
						} else if (matchesKey(data, "up")) {
							index = Math.max(0, index - 1);
						} else if (matchesKey(data, "down")) {
							index = Math.min(filtered().length - 1, index + 1);
						} else {
							const previous = input.getValue();
							input.handleInput(data);
							if (previous !== input.getValue()) {
								index = 0;
								message = "";
							}
						}
					} catch (error) {
						message = String(error);
					}
					tui.requestRender();
				},
			};
		},
	);
	if (!selected) return;
	const model = ctx.modelRegistry.find(selected.provider, selected.model);
	if (!model) throw new Error(`Model unavailable: ${modelSetLabel(selected)}`);
	if (selected.fast && !supportsFast(model))
		throw new Error("Fast mode is not available for this model");
	const thinking = getSupportedThinkingLevels(model).find(
		(level) => level === selected.thinking,
	);
	if (!thinking)
		throw new Error(`Thinking level unavailable: ${selected.thinking}`);
	if (!(await pi.setModel(model)))
		throw new Error("Could not select model (check authentication)");
	pi.setThinkingLevel(thinking);
	fast.setEnabled(selected.fast, model);
}
