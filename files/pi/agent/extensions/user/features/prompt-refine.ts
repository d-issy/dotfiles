import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Feature } from "../feature";
import { generateRefinedPrompt } from "../lib/prompt-refine";
import { registerQuickActionHandler } from "../lib/quick-actions";

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
