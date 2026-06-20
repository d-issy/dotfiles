import { type Message, complete } from "@earendil-works/pi-ai";
import {
	BorderedLoader,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import { registerQuickActionHandler } from "../lib/quick-actions";

const SYSTEM_PROMPT = `You refine prompts for a coding agent.

Rewrite the user's draft prompt so it is clearer, more actionable, and easier for the agent to execute.

Rules:
- Preserve the user's intent and language.
- Correct obvious typos, dictation mistakes, speech-recognition errors, and wrong homophones from voice input when the intended wording is clear.
- Do not over-correct domain terms, code identifiers, file paths, commands, URLs, or proper nouns unless they are clearly mistaken.
- Do not add requirements that are not implied by the draft.
- Make ambiguity explicit only when helpful.
- Prefer concise structure with bullets when it improves readability.
- Output only the refined prompt text. Do not include explanations, prefaces, or markdown fences.`;

function extractText(response: Awaited<ReturnType<typeof complete>>): string {
	return response.content
		.filter(
			(part): part is { type: "text"; text: string } => part.type === "text",
		)
		.map((part) => part.text)
		.join("\n")
		.trim();
}

async function generateRefinedPrompt(
	ctx: ExtensionContext,
	prompt: string,
): Promise<string | null> {
	if (!ctx.model) {
		ctx.ui.notify("Select a model before refining prompts", "warning");
		return null;
	}

	return ctx.ui.custom<string | null>((tui, theme, _keybindings, done) => {
		const loader = new BorderedLoader(tui, theme, "Refining prompt...");
		loader.onAbort = () => done(null);

		const run = async (): Promise<string | null> => {
			const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model!);
			if (!auth.ok || !auth.apiKey) {
				throw new Error(
					auth.ok ? `No API key for ${ctx.model!.provider}` : auth.error,
				);
			}

			const userMessage: Message = {
				role: "user",
				content: [{ type: "text", text: prompt }],
				timestamp: Date.now(),
			};
			const response = await complete(
				ctx.model!,
				{ systemPrompt: SYSTEM_PROMPT, messages: [userMessage] },
				{
					apiKey: auth.apiKey,
					headers: auth.headers,
					reasoning: "low",
					signal: loader.signal,
				},
			);

			if (response.stopReason === "aborted") return null;
			const refined = extractText(response);
			if (!refined) throw new Error("Refined prompt was empty");
			return refined;
		};

		void (async () => {
			try {
				done(await run());
			} catch (error) {
				console.error("Prompt refinement failed:", error);
				done(null);
			}
		})();

		return loader;
	});
}

async function refineEditorPrompt(ctx: ExtensionContext): Promise<void> {
	const original = ctx.ui.getEditorText().trim();
	if (!original) {
		ctx.ui.notify("Write a prompt before refining it", "warning");
		return;
	}

	const refined = await generateRefinedPrompt(ctx, original);
	if (refined === null) {
		ctx.ui.notify("Prompt refinement cancelled", "info");
		return;
	}

	ctx.ui.setEditorText(refined);
	ctx.ui.notify("Prompt refined", "info");
}

function register(): void {
	registerQuickActionHandler("refinePrompt", refineEditorPrompt);
}

export function createPromptRefineFeature(): Feature {
	return { name: "prompt-refine", dependsOn: ["quick-actions"], register };
}

export default createPromptRefineFeature();
