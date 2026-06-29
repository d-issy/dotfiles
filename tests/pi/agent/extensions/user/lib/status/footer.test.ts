import assert from "node:assert/strict";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { describe, it } from "vitest";
import { createStatusBarFooter } from "#pi-user/lib/status/footer";

function assistant(input: number, cacheRead: number): unknown {
	return {
		type: "message",
		message: {
			role: "assistant",
			usage: {
				input,
				output: 1,
				cacheRead,
				cacheWrite: 0,
				cost: { total: 0.123 },
			},
		},
	};
}

describe("createStatusBarFooter", () => {
	it("scopes cache hit rate to the active branch like cost", () => {
		const pi = {
			getThinkingLevel: () => "",
		} as unknown as ExtensionAPI;
		const ctx = {
			cwd: "/repo",
			model: { id: "model" },
			getContextUsage: () => undefined,
			sessionManager: {
				getEntries: () => [assistant(0, 100)],
				getBranch: () => [assistant(10, 0)],
			},
		} as unknown as ExtensionContext;
		const footerData = {
			onBranchChange: () => () => undefined,
			getGitBranch: () => "main",
			getExtensionStatuses: () => new Map(),
		};
		const footer = createStatusBarFooter(pi, ctx, () => undefined)(
			{ requestRender: () => undefined } as never,
			{} as never,
			footerData as never,
		);

		const output = footer.render(200).join("\n");

		assert.match(output, /\$0\.123/u);
		assert.doesNotMatch(output, /CH/u);
	});
});
