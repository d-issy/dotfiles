import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../../apps/command-library/src/library";

const mocks = vi.hoisted(() => ({
	config: {} as Config,
	spawnSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({ spawnSync: mocks.spawnSync }));
vi.mock("../../apps/command-library/src/library", async (importOriginal) => ({
	...(await importOriginal<
		typeof import("../../apps/command-library/src/library")
	>()),
	loadConfig: () => mocks.config,
}));

const originalArgv = process.argv;

beforeEach(() => {
	vi.resetModules();
	mocks.config = {
		fzf: { command: "fzf", options: [], variableOptions: [] },
		sections: [
			{
				tags: ["nix apply"],
				variables: {},
				entries: [
					{
						description: "apply configuration",
						alias: "switch",
						command: "nix run .#apply",
					},
				],
			},
		],
	};
	mocks.spawnSync.mockReset();
	mocks.spawnSync.mockImplementation(
		(_command: string, _args: string[], options: { input: string }) => ({
			status: 0,
			stdout: `${options.input.split("\n")[0] ?? ""}\n`,
		}),
	);
	vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(() => {
	process.argv = originalArgv;
	vi.restoreAllMocks();
});

async function complete(query: string): Promise<void> {
	process.argv = [
		"node",
		"dot-command-library",
		"--config",
		"test.json",
		"--query",
		query,
		"--expand",
	];
	await import("../../apps/command-library/src/main");
}

function pickerArgs(): string[] {
	expect(mocks.spawnSync).toHaveBeenCalledOnce();
	return mocks.spawnSync.mock.calls[0]?.[1] as string[];
}

describe("command completion", () => {
	it("auto-selects a command matching a query without a channel", async () => {
		await complete("apply");
		const args = pickerArgs();
		expect(args).toContain("--select-1");
		expect(args.slice(-2)).toEqual(["--query", "apply"]);
		expect(
			args.slice(args.indexOf("--nth"), args.indexOf("--nth") + 2),
		).toEqual(["--nth", "2"]);
		expect(process.stdout.write).toHaveBeenCalledWith("nix run .#apply\n");
	});

	it("searches for a command after removing its channel from the query", async () => {
		await complete("nix apply");
		const args = pickerArgs();
		expect(args).toContain("--select-1");
		expect(args.slice(-2)).toEqual(["--query", "apply"]);
		expect(process.stdout.write).toHaveBeenCalledWith("nix run .#apply\n");
	});

	it("keeps the picker open for a channel containing only one entry", async () => {
		mocks.config.fzf.options = ["--select-1"];
		await complete("nix");
		const args = pickerArgs();
		expect(args).toContain("--no-select-1");
		expect(args.lastIndexOf("--no-select-1")).toBeGreaterThan(
			args.lastIndexOf("--select-1"),
		);
		expect(args.slice(-2)).toEqual(["--query", ""]);
	});

	it("expands exact aliases without opening the picker", async () => {
		await complete("switch");
		expect(mocks.spawnSync).not.toHaveBeenCalled();
		expect(process.stdout.write).toHaveBeenCalledWith("nix run .#apply\n");
	});
});
