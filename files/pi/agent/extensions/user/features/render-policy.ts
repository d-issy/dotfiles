import type {
	AgentToolResult,
	ExtensionAPI,
	Theme,
	ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import {
	createFindToolDefinition,
	createGrepToolDefinition,
	createLsToolDefinition,
	createReadToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";
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

function isErrorResult(
	result: AgentToolResult<unknown>,
	context: unknown,
): boolean {
	if ((context as { isError?: boolean }).isError === true) return true;
	return (
		(result as AgentToolResult<unknown> & { isError?: boolean }).isError ===
		true
	);
}

type OriginalResultRenderer = {
	renderResult?: (
		result: AgentToolResult<unknown>,
		options: ToolRenderResultOptions,
		theme: Theme,
		context: never,
	) => Component;
};

class TrimLeadingBlankLines implements Component {
	constructor(private readonly component: Component) {}

	render(width: number): string[] {
		const lines = [...this.component.render(width)];
		while (lines[0]?.trim() === "") lines.shift();
		return lines;
	}

	invalidate(): void {
		this.component.invalidate();
	}
}

function renderOriginalErrorResult(
	originalTool: unknown,
	result: AgentToolResult<unknown>,
	options: ToolRenderResultOptions,
	theme: Theme,
	context: unknown,
): Component {
	const renderer = (originalTool as OriginalResultRenderer).renderResult;
	const component =
		renderer?.(result, options, theme, context as never) ??
		new Text(extractContentText(result), 0, 0);
	return new TrimLeadingBlankLines(component);
}

/**
 * Override renderResult of built-in read-only tools.
 *
 * - error results are always shown
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
			const originalRead = createReadToolDefinition(cwd);
			const originalGrep = createGrepToolDefinition(cwd);
			const originalFind = createFindToolDefinition(cwd);
			const originalLs = createLsToolDefinition(cwd);

			// ---------------------------------------------------------------
			// read: shows nothing regardless of collapsed/expanded state
			// ---------------------------------------------------------------
			pi.registerTool({
				name: "read",
				label: "read",
				description: originalRead.description,
				parameters: originalRead.parameters,

				execute(id, params, signal, onUpdate, ctx) {
					return originalRead.execute(id, params, signal, onUpdate, ctx);
				},

				renderResult(result, options, theme, context) {
					if (options.isPartial)
						return new Text(theme.fg("warning", "Reading..."), 0, 0);
					if (isErrorResult(result, context))
						return renderOriginalErrorResult(
							originalRead,
							result,
							options,
							theme,
							context,
						);
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

				execute(id, params, signal, onUpdate, ctx) {
					return originalGrep.execute(id, params, signal, onUpdate, ctx);
				},

				renderResult(result, options, theme, context) {
					if (options.isPartial)
						return new Text(theme.fg("warning", "Searching..."), 0, 0);
					if (isErrorResult(result, context))
						return renderOriginalErrorResult(
							originalGrep,
							result,
							options,
							theme,
							context,
						);
					if (!options.expanded) {
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

				execute(id, params, signal, onUpdate, ctx) {
					return originalFind.execute(id, params, signal, onUpdate, ctx);
				},

				renderResult(result, options, theme, context) {
					if (options.isPartial)
						return new Text(theme.fg("warning", "Searching..."), 0, 0);
					if (isErrorResult(result, context))
						return renderOriginalErrorResult(
							originalFind,
							result,
							options,
							theme,
							context,
						);
					if (!options.expanded) {
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

				execute(id, params, signal, onUpdate, ctx) {
					return originalLs.execute(id, params, signal, onUpdate, ctx);
				},

				renderResult(result, options, theme, context) {
					if (options.isPartial)
						return new Text(theme.fg("warning", "Listing..."), 0, 0);
					if (isErrorResult(result, context))
						return renderOriginalErrorResult(
							originalLs,
							result,
							options,
							theme,
							context,
						);
					if (!options.expanded) {
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
