import assert from "node:assert/strict";
import type {
	ExtensionContext,
	SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import { supportsFast } from "#pi-user/features/fast";
import { createStatusBarFooter } from "#pi-user/lib/status/footer";

const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");

function plain(value: string): string {
	return value.replace(ansiPattern, "");
}

function assistant(input: number, cacheRead: number): SessionEntry {
	return {
		type: "message",
		message: {
			role: "assistant",
			content: [],
			usage: {
				input,
				output: 5_000,
				cacheRead,
				cacheWrite: 0,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0.021,
				},
			},
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude-sonnet-4",
			stopReason: "stop",
		},
	} as unknown as SessionEntry;
}

describe("createStatusBarFooter", () => {
	it("shows only the configured identity and usage summary", () => {
		const ctx = {
			model: {
				provider: "anthropic",
				id: "claude-opus-5",
				reasoning: true,
				contextWindow: 1_100_000,
			},
			thinkingLevel: "high",
			getContextUsage: () => ({
				tokens: 46_200,
				percent: 4.2,
				contextWindow: 1_100_000,
			}),
			sessionManager: {
				getEntries: () => [assistant(12_444, 202_000)],
			},
		} as unknown as ExtensionContext;
		const footerData = {
			onBranchChange: () => () => undefined,
			getGitBranch: () => "main",
		};

		const colors: string[] = [];
		const footer = createStatusBarFooter(ctx, () => undefined, supportsFast)(
			{ requestRender: () => undefined } as never,
			{
				fg: (color: string, text: string) => {
					colors.push(color);
					return text;
				},
				bold: (text: string) => text,
			} as never,
			footerData as never,
		);

		const output = plain(footer.render(120).join("\n"));

		assert.match(
			output,
			/^\(anthropic\) claude-opus-5 high fast · main +CH94\.2% · CTX 46k\/1\.1M \(4\.2%\) · \$0\.021$/u,
		);
		assert.deepEqual(colors, ["muted", "muted"]);
		assert.doesNotMatch(output, /↑|↓|R202k|W44k|auto|repo/u);

		(ctx.model as { id: string }).id = "claude-sonnet-4";
		assert.match(
			plain(footer.render(120).join("\n")),
			/^\(anthropic\) claude-sonnet-4 high · main /u,
		);
	});
});
