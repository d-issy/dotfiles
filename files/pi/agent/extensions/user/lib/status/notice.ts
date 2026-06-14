import {
	FOOTER_NOTICE_DEFAULT_MS,
	FOOTER_NOTICE_EVENT,
	type FooterNoticeEvent,
} from "./types";
import type { RenderTrigger } from "./render-trigger";

export type FooterNoticeState = {
	current(): string | undefined;
	show(message: string, durationMs: number): void;
	clear(): void;
	dispose(): void;
};

export function createFooterNoticeState(
	render: RenderTrigger,
): FooterNoticeState {
	let message: string | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function clearTimer(): void {
		if (!timer) return;
		clearTimeout(timer);
		timer = undefined;
	}

	return {
		current() {
			return message;
		},
		show(nextMessage, durationMs) {
			clearTimer();
			message = nextMessage;
			render.trigger();
			timer = setTimeout(() => {
				message = undefined;
				timer = undefined;
				render.trigger();
			}, durationMs);
		},
		clear() {
			clearTimer();
			if (!message) return;
			message = undefined;
			render.trigger();
		},
		dispose() {
			clearTimer();
			message = undefined;
		},
	};
}

export const handleFooterNotice =
	(notice: FooterNoticeState) =>
	(data: unknown): void => {
		const event = data as FooterNoticeEvent;
		if (!event.message) {
			notice.clear();
			return;
		}

		notice.show(event.message, event.durationMs ?? FOOTER_NOTICE_DEFAULT_MS);
	};

export { FOOTER_NOTICE_DEFAULT_MS, FOOTER_NOTICE_EVENT };
export type { FooterNoticeEvent };
