// Generic terminal-UI primitives shared across features (not tied to any
// single feature's domain). See the individual modules for details.
export { filterCompletionsByPrefix } from "./completions";
export {
	type FilterSelectItem,
	type FilterSelectOptions,
	showFilterSelect,
} from "./filter-select";
export { decodePrintableInput } from "./input";
export { type VisibleRange, getVisibleRange } from "./scroll";
