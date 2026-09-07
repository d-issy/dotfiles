import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastController } from "#pi-user/features/fast";
import {
	type ModelSet,
	modelSetLabel,
	readModelSets,
	registerModelSetsFeature,
	sameModelSet,
	writeModelSets,
} from "#pi-user/features/model-sets";

const location = vi.hoisted(() => ({ directory: "" }));
vi.mock("@earendil-works/pi-coding-agent", async (original) => ({
	...(await original<object>()),
	getAgentDir: () => location.directory,
}));
const directories: string[] = [];
function directory(): string {
	const dir = mkdtempSync(join(tmpdir(), "pi-model-sets-"));
	directories.push(dir);
	location.directory = dir;
	return dir;
}
afterEach(() => {
	for (const dir of directories.splice(0))
		rmSync(dir, { recursive: true, force: true });
});
const astra: ModelSet = {
	provider: "openai-codex",
	model: "gpt-6-astra",
	thinking: "low",
	fast: false,
};
const luna: ModelSet = {
	provider: "openai-codex",
	model: "gpt-5.6-luna",
	thinking: "xhigh",
	fast: true,
};

type Factory = Parameters<ExtensionContext["ui"]["custom"]>[0];

async function picker(
	keys: string[],
	initial: ModelSet[] = [],
	authenticated = true,
): Promise<{
	sets: ModelSet[];
	pi: ExtensionAPI;
	fast: FastController;
	notify: ReturnType<typeof vi.fn>;
	shortcuts: string[];
}> {
	const path = join(directory(), "model-sets.json");
	writeModelSets(path, initial);
	const shortcuts: string[] = [];
	let handler: ((ctx: ExtensionContext) => Promise<void> | void) | undefined;
	const forwarded = vi.fn();
	const editor = { handleInput: forwarded };
	const pi = {
		registerShortcut: vi.fn((key: string) => {
			shortcuts.push(key);
		}),
		on: vi.fn(
			(
				_event: string,
				callback: (event: unknown, ctx: ExtensionContext) => void,
			) => {
				handler = (ctx) => callback({}, ctx);
			},
		),
		getThinkingLevel: vi.fn(() => "low"),
		setThinkingLevel: vi.fn(),
		setModel: vi.fn(async () => authenticated),
	} as unknown as ExtensionAPI;
	const fast = { isEnabled: vi.fn(() => false), setEnabled: vi.fn() };
	const notify = vi.fn();
	const ctx = {
		hasUI: true,
		mode: "tui",
		model: { provider: astra.provider, id: astra.model },
		modelRegistry: {
			find: (provider: string, id: string) => ({
				provider,
				id,
				reasoning: true,
				thinkingLevelMap: { xhigh: "xhigh" },
			}),
		},
		ui: {
			getEditorComponent: () => () => editor,
			setEditorComponent: (
				factory: NonNullable<
					ReturnType<ExtensionContext["ui"]["getEditorComponent"]>
				>,
			) => {
				factory(
					{} as Parameters<typeof factory>[0],
					{} as Parameters<typeof factory>[1],
					{} as Parameters<typeof factory>[2],
				);
			},
			notify,
			custom: async (factory: Factory) => {
				let result: unknown;
				const component = await factory(
					{ requestRender() {} } as unknown as Parameters<Factory>[0],
					{
						fg: (_color: string, text: string) => text,
					} as unknown as Parameters<Factory>[1],
					{} as Parameters<Factory>[2],
					(value) => {
						result = value;
					},
				);
				component.render(100);
				for (const key of keys) {
					component.handleInput?.(key);
					component.render(100);
				}
				return result;
			},
		},
	} as unknown as ExtensionContext;
	registerModelSetsFeature(pi, fast);
	await handler!(ctx);
	editor.handleInput("\x13");
	editor.handleInput("\x04");
	expect(forwarded.mock.calls).toEqual([["\x13"], ["\x04"]]);
	editor.handleInput("\x10");
	await new Promise((resolve) => setImmediate(resolve));
	return { sets: readModelSets(path), pi, fast, notify, shortcuts };
}

describe("model sets", () => {
	it("places the provider last and distinguishes fast settings", () => {
		expect(modelSetLabel(astra)).toBe("gpt-6-astra low (openai-codex)");
		expect(modelSetLabel(luna)).toBe("gpt-5.6-luna xhigh fast (openai-codex)");
		expect(sameModelSet(astra, { ...astra, fast: true })).toBe(false);
	});
	it("persists settings and refuses malformed files", () => {
		const path = join(directory(), "model-sets.json");
		expect(readModelSets(path)).toEqual([]);
		writeModelSets(path, [astra, luna]);
		expect(readModelSets(path)).toEqual([astra, luna]);
		writeFileSync(path, '[{"provider":3}]');
		expect(() => readModelSets(path)).toThrow("Invalid model sets");
	});
	it("saves without duplicates and preserves editor shortcuts without global registrations", async () => {
		const result = await picker(["\x13", "\x13", "\x1b"]);
		expect(result.sets).toEqual([astra]);
		expect(result.shortcuts).toEqual([]);
		expect(result.pi.setModel).not.toHaveBeenCalled();
	});
	it("fuzzy matches all fields and applies model, thinking and fast", async () => {
		const result = await picker(["cod lun xh fast", "\r"], [astra, luna]);
		expect(result.pi.setModel).toHaveBeenCalledWith(
			expect.objectContaining({ id: luna.model }),
		);
		expect(result.pi.setThinkingLevel).toHaveBeenCalledWith("xhigh");
		expect(result.fast.setEnabled).toHaveBeenCalledWith(
			true,
			expect.objectContaining({ id: luna.model }),
		);
	});
	it("disables fast when applying a non-fast preset", async () => {
		const result = await picker(["nofast", "\r"], [luna, astra]);
		expect(result.fast.setEnabled).toHaveBeenCalledWith(
			false,
			expect.objectContaining({ id: astra.model }),
		);
	});
	it("confirms deletion and allows cancelling it", async () => {
		const cancelled = await picker(["\x04", "\x1b", "\x1b"], [astra, luna]);
		expect(cancelled.sets).toEqual([astra, luna]);
		const deleted = await picker(["lun", "\x04", "\r", "\x1b"], [astra, luna]);
		expect(deleted.sets).toEqual([astra]);
	});
	it("leaves thinking and fast unchanged if model selection fails", async () => {
		const result = await picker(["\r"], [luna], false);
		expect(result.notify).toHaveBeenCalled();
		expect(result.pi.setThinkingLevel).not.toHaveBeenCalled();
		expect(result.fast.setEnabled).not.toHaveBeenCalled();
	});
	it("validates thinking levels through pi before changing models", async () => {
		const result = await picker(["\r"], [{ ...astra, thinking: "invalid" }]);
		expect(result.notify).toHaveBeenCalled();
		expect(result.pi.setModel).not.toHaveBeenCalled();
	});
});
