import {
	CustomEditor,
	type ExtensionAPI,
	type ExtensionHandler,
	type KeybindingsManager,
	type SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import type { Feature } from "../feature";
import { FOOTER_NOTICE_DEFAULT_MS, FOOTER_NOTICE_EVENT } from "../lib/status";
import { notifyUserInputNeeded } from "../lib/tmux-notice";
import { defaultEditorOptions } from "../lib/ui";

const CONFIRM_WINDOW_MS = FOOTER_NOTICE_DEFAULT_MS;
const EXIT_PROMPTS = {
	"app.exit": "Press Ctrl-D again to exit",
	"app.clear": "Press Ctrl-C again to exit",
} as const;
type ExitConfirmAction = keyof typeof EXIT_PROMPTS;

class ConfirmExitEditor extends CustomEditor {
	private lastExitPress:
		| { action: ExitConfirmAction; time: number }
		| undefined;

	constructor(
		tui: TUI,
		theme: EditorTheme,
		private readonly keybindingsForExit: KeybindingsManager,
		private readonly notice: {
			show(message: string): void;
			clear(): void;
		},
	) {
		super(tui, theme, keybindingsForExit, defaultEditorOptions());
	}

	private confirmOrArm(action: ExitConfirmAction): boolean {
		const now = Date.now();
		const confirmed =
			this.lastExitPress?.action === action &&
			now - this.lastExitPress.time <= CONFIRM_WINDOW_MS;

		if (confirmed) {
			this.resetConfirmation();
			return true;
		}

		this.lastExitPress = { action, time: now };
		this.notice.show(EXIT_PROMPTS[action]);
		return false;
	}

	private resetConfirmation(): void {
		if (!this.lastExitPress) return;
		this.lastExitPress = undefined;
		this.notice.clear();
	}

	private exit(): void {
		(this.onCtrlD ?? this.actionHandlers.get("app.exit"))?.();
	}

	override handleInput(data: string): void {
		if (this.getText().length === 0) {
			for (const action of Object.keys(EXIT_PROMPTS) as ExitConfirmAction[]) {
				if (this.keybindingsForExit.matches(data, action)) {
					if (this.confirmOrArm(action)) {
						this.exit();
					}
					return;
				}
			}
		}

		this.resetConfirmation();
		super.handleInput(data);
	}
}

const installConfirmExitEditor =
	(pi: ExtensionAPI): ExtensionHandler<SessionStartEvent> =>
	(_event, ctx) => {
		if (!ctx.hasUI) return;

		ctx.ui.setEditorComponent(
			(tui, theme, keybindings) =>
				new ConfirmExitEditor(tui, theme, keybindings, {
					show: (message) => {
						void notifyUserInputNeeded();
						pi.events.emit(FOOTER_NOTICE_EVENT, {
							message,
							durationMs: CONFIRM_WINDOW_MS,
						});
					},
					clear: () => pi.events.emit(FOOTER_NOTICE_EVENT, {}),
				}),
		);
	};

function register(pi: ExtensionAPI): void {
	pi.on("session_start", installConfirmExitEditor(pi));
}

export function createExitConfirmFeature(): Feature {
	return { name: "exit-confirm", dependsOn: ["status"], register };
}

export default createExitConfirmFeature();
