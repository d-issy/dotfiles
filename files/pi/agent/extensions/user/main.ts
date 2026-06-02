import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Feature } from "./feature";
import exitConfirmFeature from "./features/exit-confirm";
import modeFeature from "./features/mode";
import quickActionsFeature from "./features/quick-actions";
import statusFeature from "./features/status";
import thinkingFeature from "./features/thinking";
import tmuxPaneTitleFeature from "./features/tmux-pane-title";
import fileToolsFeature from "./features/tool";

const features: readonly Feature[] = [
	exitConfirmFeature,
	modeFeature,
	quickActionsFeature,
	statusFeature,
	thinkingFeature,
	tmuxPaneTitleFeature,
	fileToolsFeature,
];

export default function user(pi: ExtensionAPI): void {
	for (const feature of features) feature.register(pi);
}
