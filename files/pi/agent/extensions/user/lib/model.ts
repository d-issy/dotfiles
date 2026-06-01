import {
	type ExtensionAPI,
	type ExtensionContext,
	ModelSelectorComponent,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";

export async function showModelSelector(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
): Promise<void> {
	const settingsManager = SettingsManager.create(ctx.cwd);
	const previousModel = ctx.model;

	await ctx.ui.custom<void>(
		(tui, _theme, _keybindings, done) =>
			new ModelSelectorComponent(
				tui,
				ctx.model,
				settingsManager,
				ctx.modelRegistry,
				[],
				async (model) => {
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
						done(undefined);
						return;
					}

					await settingsManager.flush();
					ctx.ui.notify(`Model: ${model.id}`, "info");
					done(undefined);
				},
				() => done(undefined),
			),
	);
}
