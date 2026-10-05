import { bashOperationDetails } from "./bash-summary";
import {
	AssistantMessageComponent,
	type Theme,
	ToolExecutionComponent,
} from "@earendil-works/pi-coding-agent";
import {
	type Component,
	Container,
	truncateToWidth,
} from "@earendil-works/pi-tui";

type ToolOperation = { name: string; command?: string };
type CompletedTool = ToolOperation & {
	isError: boolean;
	calls?: ToolOperation[];
};

// Use executed calls, not script text: loops, variables and parallel calls
// must reflect what actually ran. Truncated bash arguments use a generic run label.
function codemodeCalls(details: unknown): ToolOperation[] | undefined {
	if (!details || typeof details !== "object" || !("calls" in details)) return;
	if (!Array.isArray(details.calls) || details.calls.length === 0) return;
	const calls: ToolOperation[] = [];
	for (const call of details.calls) {
		if (!call || typeof call.name !== "string" || call.status !== "ok") return;
		let command: string | undefined;
		if (call.name === "bash") {
			try {
				const args: unknown = JSON.parse(call.args);
				if (
					!args ||
					typeof args !== "object" ||
					!("command" in args) ||
					typeof args.command !== "string"
				)
					return;
				command = args.command;
			} catch {
				command = "bash";
			}
		}
		calls.push({ name: call.name, command });
	}
	return calls;
}
type SummaryTheme = Pick<Theme, "fg">;

function completedTool(component: Component): CompletedTool | undefined {
	if (!(component instanceof ToolExecutionComponent)) return;

	// Pi internals: read only. If these fields change, leave the row visible.
	const row = component as unknown as {
		toolName?: unknown;
		args?: { command?: unknown };
		expanded?: unknown;
		isPartial?: unknown;
		result?: { isError?: unknown; details?: unknown };
	};
	if (
		typeof row.toolName !== "string" ||
		row.expanded !== false ||
		row.isPartial !== false ||
		typeof row.result?.isError !== "boolean"
	)
		return;

	const calls =
		row.toolName === "codemode" ? codemodeCalls(row.result.details) : undefined;
	if (row.toolName === "codemode" && !calls && !row.result.isError) return;

	return {
		calls,
		name: row.toolName,
		isError: row.result.isError,
		command:
			typeof row.args?.command === "string" ? row.args.command : undefined,
	};
}

function renderSummary(
	container: Container,
	width: number,
	theme: SummaryTheme,
	keepBashVisible: (component: Component) => boolean,
): string[] {
	const lines: string[] = [];
	const mouseChildren: Array<{ component: Component; height: number }> = [];
	let hiddenThinkingSeen = false;
	const counts = new Map<string, number>();
	const operations = new Map<string, number>();
	const previews: Array<{ component: Component; lines: string[] }> = [];

	function flushSummary(): void {
		if (counts.size === 0) return;
		const tools = [...counts]
			.map(([name, count]) => {
				if (name !== "bash") return count === 1 ? name : `${name} ×${count}`;
				const recent = [...operations]
					.slice(-3)
					.map(([operation, total]) =>
						total === 1 ? operation : `${operation} ×${total}`,
					)
					.join(", ");
				return `run (${operations.size > 3 ? "… " : ""}${recent})`;
			})
			.join(", ");
		const summary = [
			"",
			truncateToWidth(theme.fg("success", ` ✓ ${tools}`), width),
		];
		lines.push(...summary);
		mouseChildren.push({
			component: { render: () => summary, invalidate: () => undefined },
			height: 2,
		});
		counts.clear();
		operations.clear();
	}

	function flush(): void {
		flushSummary();
		for (const preview of previews) {
			lines.push(...preview.lines);
			mouseChildren.push({
				component: preview.component,
				height: preview.lines.length,
			});
		}
		previews.length = 0;
	}

	for (const child of container.children) {
		const tool = completedTool(child);
		// Keep failures in the transcript, outside successful counts and bash previews.
		if (tool?.isError) {
			hiddenThinkingSeen = false;
			const childLines = child.render(width);
			lines.push(...childLines);
			mouseChildren.push({ component: child, height: childLines.length });
			continue;
		}
		if (tool && !keepBashVisible(child)) {
			for (const operation of tool.calls ?? [tool]) {
				if (operation.name !== "bash") {
					const name = ["grep", "find"].includes(operation.name)
						? "search"
						: operation.name;
					counts.set(name, (counts.get(name) ?? 0) + 1);
				} else {
					let countedRun = false;
					for (const { name, labeled } of bashOperationDetails(
						operation.command ?? "",
					)) {
						if (labeled) {
							counts.set(name, (counts.get(name) ?? 0) + 1);
							continue;
						}
						if (!countedRun) {
							counts.set("bash", (counts.get("bash") ?? 0) + 1);
							countedRun = true;
						}
						const total = (operations.get(name) ?? 0) + 1;
						operations.delete(name);
						operations.set(name, total);
					}
				}
			}
			continue;
		}

		const row = child as unknown as {
			toolName?: unknown;
			expanded?: unknown;
			isPartial?: unknown;
		};
		const pendingTool =
			child instanceof ToolExecutionComponent && row.isPartial === true;
		if (
			pendingTool &&
			row.expanded === false &&
			typeof row.toolName === "string" &&
			row.toolName !== "bash" &&
			row.toolName !== "edit" &&
			row.toolName !== "write" &&
			row.toolName !== "codemode"
		)
			continue;
		// Pi renders a hidden label per assistant message. Fold thinking-only
		// messages across summarized tools, without hiding text or stop errors.
		const assistantRow = child as unknown as {
			hideThinkingBlock?: unknown;
			lastMessage?: {
				stopReason?: string;
				content?: Array<{ type?: string; thinking?: string }>;
			};
		};
		const hiddenThinkingOnly =
			child instanceof AssistantMessageComponent &&
			assistantRow.hideThinkingBlock === true &&
			["stop", "toolUse"].includes(
				assistantRow.lastMessage?.stopReason ?? "",
			) &&
			assistantRow.lastMessage?.content?.every(
				(content) => content.type === "thinking" || content.type === "toolCall",
			) === true &&
			assistantRow.lastMessage.content.some(
				(content) => content.type === "thinking" && content.thinking?.trim(),
			);
		if (hiddenThinkingOnly && hiddenThinkingSeen) continue;
		const childLines = child.render(width);
		if (hiddenThinkingOnly) hiddenThinkingSeen = true;
		// Keep pending edit/write previews and bash previews after the summary.
		if (
			child instanceof ToolExecutionComponent &&
			["bash", "edit", "write", "codemode"].includes(String(row.toolName)) &&
			row.expanded === false &&
			(pendingTool || keepBashVisible(child))
		) {
			previews.push({ component: child, lines: childLines });
			continue;
		}
		// Thinking remains before the summary at the group end.
		const assistantWithoutVisibleMessage =
			child instanceof AssistantMessageComponent &&
			(childLines.length === 0 ||
				(
					child as unknown as {
						lastMessage?: { content?: Array<{ type?: unknown }> };
					}
				).lastMessage?.content?.every(
					(content) =>
						content.type === "thinking" || content.type === "toolCall",
				) === true);
		if (
			!pendingTool &&
			!keepBashVisible(child) &&
			!assistantWithoutVisibleMessage
		) {
			flush();
			hiddenThinkingSeen = false;
		}
		mouseChildren.push({ component: child, height: childLines.length });
		for (const line of childLines) lines.push(line);
	}
	flush();
	// Pi 0.85+ caches mouse hit regions in Container.render. Keep visible rows
	// aligned and give the summary its own inert region, not a hidden tool's.
	if ("mouseLayout" in container) {
		Object.assign(container, {
			mouseLayout: { width, children: mouseChildren },
		});
	}
	return lines;
}

/**
 * Pi's transcript is a Container of message/tool components in both TUI modes.
 * Intercept transcript containers. Do not replace
 * tools, mutate the component tree, or change individual renderers: expansion,
 * streaming, images and diffs continue to use Pi's original implementation.
 */
export function installToolSummary(getTheme: () => SummaryTheme): () => void {
	const originalRender = Container.prototype.render;
	let active = true;
	const deadlines = new WeakMap<Component, number>();
	const timers = new Set<ReturnType<typeof setTimeout>>();
	const originalUpdateResult = ToolExecutionComponent.prototype.updateResult;
	function updateResult(
		this: ToolExecutionComponent,
		...args: Parameters<typeof originalUpdateResult>
	): void {
		originalUpdateResult.apply(this, args);
		const row = this as unknown as {
			toolName?: unknown;
			ui?: { requestRender(): void };
		};
		if (
			!active ||
			!["bash", "codemode"].includes(String(row.toolName)) ||
			args[1] === true ||
			deadlines.has(this)
		)
			return;
		deadlines.set(this, Date.now() + 3000);
		const timer = setTimeout(() => {
			timers.delete(timer);
			row.ui?.requestRender();
		}, 3000);
		timers.add(timer);
	}
	function keepBashVisible(component: Component): boolean {
		return (deadlines.get(component) ?? 0) > Date.now();
	}
	ToolExecutionComponent.prototype.updateResult = updateResult;

	function render(this: Container, width: number): string[] {
		if (
			!active ||
			!this.children.some((child) => child instanceof ToolExecutionComponent)
		) {
			return originalRender.call(this, width);
		}
		return renderSummary(this, width, getTheme(), keepBashVisible);
	}

	Container.prototype.render = render;
	return () => {
		active = false;
		for (const timer of timers) clearTimeout(timer);
		timers.clear();
		if (ToolExecutionComponent.prototype.updateResult === updateResult)
			ToolExecutionComponent.prototype.updateResult = originalUpdateResult;
		// Do not remove another extension's wrapper installed after ours.
		if (Container.prototype.render === render) {
			Container.prototype.render = originalRender;
		}
	};
}
