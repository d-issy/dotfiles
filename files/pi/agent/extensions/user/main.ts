import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Feature } from "./feature";
import { isUserExtensionEnabled } from "./lib/project-settings";
import { createUserExtensionServices } from "./lib/services";
import { createExitConfirmFeature } from "./features/exit-confirm";
import { createFocusFeature } from "./features/focus";
import { createPromptRefineFeature } from "./features/prompt-refine";
import { createPromptStashFeature } from "./features/prompt-stash";
import { createQuickActionsFeature } from "./features/quick-actions";
import { createRenderPolicyFeature } from "./features/render-policy";
import { createStatusFeature } from "./features/status";
import { createSystemRemindersFeature } from "./features/system-reminders";
import { createThinkingFeature } from "./features/thinking";
import { createTmuxNoticeFeature } from "./features/tmux-notice";
import { createToolFeature } from "./features/tool";
import { createTurnMetricsFeature } from "./features/turn-metrics";
import { installHerdrAgentStateBridge } from "./lib/herdr";

function createFeatures(): readonly Feature[] {
	return [
		createStatusFeature(),
		createTurnMetricsFeature(),
		createExitConfirmFeature(),
		createSystemRemindersFeature(),
		createFocusFeature(),
		createQuickActionsFeature(),
		createPromptRefineFeature(),
		createPromptStashFeature(),
		createThinkingFeature(),
		createTmuxNoticeFeature(),
		createRenderPolicyFeature(),
		createToolFeature(),
	];
}

function assertFeatureDependencies(features: readonly Feature[]): void {
	const seen = new Set<string>();
	for (const feature of features) {
		if (seen.has(feature.name))
			throw new Error(`Duplicate feature: ${feature.name}`);
		for (const dependency of feature.dependsOn ?? []) {
			if (!seen.has(dependency)) {
				throw new Error(
					`Feature '${feature.name}' must be registered after '${dependency}'.`,
				);
			}
		}
		seen.add(feature.name);
	}
}

export default function user(pi: ExtensionAPI): void {
	if (!isUserExtensionEnabled(process.cwd())) return;
	installHerdrAgentStateBridge(pi);

	const services = createUserExtensionServices();
	const features = createFeatures();
	assertFeatureDependencies(features);
	for (const feature of features) feature.register(pi, services);
}
