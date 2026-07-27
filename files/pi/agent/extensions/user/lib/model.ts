import {
	type ExtensionAPI,
	type ExtensionContext,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { showFilterSelect } from "./ui";

export async function showModelSelector(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
): Promise<void> {
	const settingsManager = SettingsManager.create(ctx.cwd);
	const previousModel = ctx.model;

	const models = ctx.modelRegistry.getAll();
	const result = await showFilterSelect(ctx, {
		title: "Select Model",
		items: models.map((model) => ({
			value: `${model.provider}/${model.id}`,
			label: model.id,
			description: model.provider,
		})),
		currentValue: previousModel
			? `${previousModel.provider}/${previousModel.id}`
			: undefined,
	});
	if (!result) return;

	const model = models.find(
		(candidate) => `${candidate.provider}/${candidate.id}` === result,
	);
	if (!model) return;

	const selected = await pi.setModel(model);
	if (!selected) {
		if (previousModel) {
			settingsManager.setDefaultModelAndProvider(
				previousModel.provider,
				previousModel.id,
			);
		}
		ctx.ui.notify(
			`No API key for ${model.provider}/${model.id}`,
			"warning",
		);
		return;
	}

	await settingsManager.flush();
	ctx.ui.notify(`Model: ${model.id}`, "info");
}
