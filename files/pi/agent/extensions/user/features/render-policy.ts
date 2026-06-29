import type {
	AgentToolResult,
	ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import {
	createFindTool,
	createGrepTool,
	createLsTool,
	createReadTool,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { Feature } from "../feature";

type TruncationDetails = {
	truncation?: { truncated?: boolean };
	matchLimitReached?: number;
	resultLimitReached?: number;
	entryLimitReached?: number;
};

/**
 * Extract the full text content from a tool result.
 */
function extractContentText(result: AgentToolResult<unknown>): string {
	return result.content
		.filter((c): c is { type: "text"; text: string } => c.type === "text")
		.map((c) => c.text)
		.join("");
}

/**
 * Count non-empty lines in a tool result.
 */
function countContentLines(result: AgentToolResult<unknown>): number {
	const text = extractContentText(result);
	return text.split("\n").filter((l) => l.trim().length > 0).length;
}

/**
 * Check whether the result was truncated (details-based, not text-based).
 */
function isTruncated(result: AgentToolResult<unknown>): boolean {
	const d = result.details as TruncationDetails | undefined;
	if (!d) return false;
	if (d.truncation?.truncated) return true;
	if ((d.matchLimitReached ?? 0) > 0) return true;
	if ((d.resultLimitReached ?? 0) > 0) return true;
	if ((d.entryLimitReached ?? 0) > 0) return true;
	return false;
}

/**
 * Override renderResult of built-in read-only tools.
 *
 * - read:  shows nothing in both collapsed and expanded states (content is completely hidden)
 * - grep:  collapsed shows dimmed count only, expanded shows full content
 * - find:  collapsed shows dimmed count only, expanded shows full content
 * - ls:    collapsed shows dimmed count only, expanded shows full content
 *
 * renderCall remains as built-in, so parameter display is unaffected.
 * Truncation warnings are included in the content when expanded.
 * When collapsed and also truncated, the count gets a ", truncated" suffix.
 */
export function createRenderPolicyFeature(): Feature {
	return {
		name: "render-policy",
		register(pi: ExtensionAPI) {
			const cwd = process.cwd();
			const originalRead = createReadTool(cwd);
			const originalGrep = createGrepTool(cwd);
			const originalFind = createFindTool(cwd);
			const originalLs = createLsTool(cwd);

			// ---------------------------------------------------------------
			// read: shows nothing regardless of collapsed/expanded state
			// ---------------------------------------------------------------
			pi.registerTool({
				name: "read",
				label: "read",
				description: originalRead.description,
				parameters: originalRead.parameters,

				execute(id, params, signal, onUpdate) {
					return originalRead.execute(id, params, signal, onUpdate);
				},

				renderResult(_result, { isPartial }, theme) {
					if (isPartial)
						return new Text(theme.fg("warning", "Reading..."), 0, 0);
					return new Text("", 0, 0);
				},
			});

			// ---------------------------------------------------------------
			// grep: collapsed → count only, expanded → full content
			// ---------------------------------------------------------------
			pi.registerTool({
				name: "grep",
				label: "grep",
				description: originalGrep.description,
				parameters: originalGrep.parameters,

				execute(id, params, signal, onUpdate) {
					return originalGrep.execute(id, params, signal, onUpdate);
				},

				renderResult(result, { expanded, isPartial }, theme) {
					if (isPartial)
						return new Text(theme.fg("warning", "Searching..."), 0, 0);
					if (!expanded) {
						const count = countContentLines(result);
						const truncated = isTruncated(result);
						const suffix = truncated ? theme.fg("warning", ", truncated") : "";
						return new Text(theme.fg("dim", `${count} matches`) + suffix, 0, 0);
					}
					return new Text(extractContentText(result), 0, 0);
				},
			});

			// ---------------------------------------------------------------
			// find: collapsed → count only, expanded → full content
			// ---------------------------------------------------------------
			pi.registerTool({
				name: "find",
				label: "find",
				description: originalFind.description,
				parameters: originalFind.parameters,

				execute(id, params, signal, onUpdate) {
					return originalFind.execute(id, params, signal, onUpdate);
				},

				renderResult(result, { expanded, isPartial }, theme) {
					if (isPartial)
						return new Text(theme.fg("warning", "Searching..."), 0, 0);
					if (!expanded) {
						const count = countContentLines(result);
						const truncated = isTruncated(result);
						const suffix = truncated ? theme.fg("warning", ", truncated") : "";
						return new Text(theme.fg("dim", `${count} files`) + suffix, 0, 0);
					}
					return new Text(extractContentText(result), 0, 0);
				},
			});

			// ---------------------------------------------------------------
			// ls: collapsed → count only, expanded → full content
			// ---------------------------------------------------------------
			pi.registerTool({
				name: "ls",
				label: "ls",
				description: originalLs.description,
				parameters: originalLs.parameters,

				execute(id, params, signal, onUpdate) {
					return originalLs.execute(id, params, signal, onUpdate);
				},

				renderResult(result, { expanded, isPartial }, theme) {
					if (isPartial)
						return new Text(theme.fg("warning", "Listing..."), 0, 0);
					if (!expanded) {
						const count = countContentLines(result);
						const truncated = isTruncated(result);
						const suffix = truncated ? theme.fg("warning", ", truncated") : "";
						return new Text(theme.fg("dim", `${count} entries`) + suffix, 0, 0);
					}
					return new Text(extractContentText(result), 0, 0);
				},
			});
		},
	};
}

export default createRenderPolicyFeature;
