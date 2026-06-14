export const FOOTER_NOTICE_EVENT = "user:footer-notice";
export const FOOTER_NOTICE_DEFAULT_MS = 1000;

export type FooterNoticeEvent = {
	message?: string;
	durationMs?: number;
};
