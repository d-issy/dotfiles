import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Feature } from "./feature";
import turnMetricsFeature from "./features/turn-metrics";
import exitConfirmFeature from "./features/exit-confirm";
import focusFeature from "./features/focus";
import quickActionsFeature from "./features/quick-actions";
import statusFeature from "./features/status";
import thinkingFeature from "./features/thinking";
import tmuxNoticeFeature from "./features/tmux-notice";
import fileToolsFeature from "./features/tool";

const features: readonly Feature[] = [
	turnMetricsFeature,
	exitConfirmFeature,
	focusFeature,
	quickActionsFeature,
	statusFeature,
	thinkingFeature,
	tmuxNoticeFeature,
	fileToolsFeature,
];

export default function user(pi: ExtensionAPI): void {
	for (const feature of features) feature.register(pi);
}
