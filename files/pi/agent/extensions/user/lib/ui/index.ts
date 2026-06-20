// Generic terminal-UI primitives shared across features (not tied to any
// single feature's domain). See the individual modules for details.
export { filterCompletionsByPrefix } from "./completions";
export {
	EDITOR_PADDING_X,
	createExtensionEditorComponent,
	createRefinableExtensionEditorComponent,
	defaultEditorOptions,
} from "./editor";
export {
	type FilterSelectItem,
	type FilterSelectOptions,
	showFilterSelect,
} from "./filter-select";
export { decodePrintableInput } from "./input";
export {
	describePrintableInput,
	renderKeyedPanelItem,
	type KeyedPanelItem,
} from "./keyed-panel";
export { type VisibleRange, getVisibleRange } from "./scroll";
