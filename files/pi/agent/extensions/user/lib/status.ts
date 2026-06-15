export { createStatusBarFooter } from "./status/footer";
export {
	FOOTER_NOTICE_DEFAULT_MS,
	FOOTER_NOTICE_EVENT,
	createFooterNoticeState,
	handleFooterNotice,
	type FooterNoticeEvent,
	type FooterNoticeState,
} from "./status/notice";
export {
	createRenderTrigger,
	type RenderTrigger,
	type RequestRender,
} from "./status/render-trigger";
export { formatCount } from "./status/format";
export { getAssistantTotals, type Totals } from "./status/usage";
