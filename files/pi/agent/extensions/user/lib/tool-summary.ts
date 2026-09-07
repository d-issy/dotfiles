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

type CompletedTool = { name: string; isError: boolean };
type SummaryTheme = Pick<Theme, "fg">;

function completedTool(component: Component): CompletedTool | undefined {
	if (!(component instanceof ToolExecutionComponent)) return;

	// Pi internals: read only. If these fields change, leave the row visible.
	const row = component as unknown as {
		toolName?: unknown;
		expanded?: unknown;
		isPartial?: unknown;
		result?: { isError?: unknown };
	};
	if (
		typeof row.toolName !== "string" ||
		row.expanded !== false ||
		row.isPartial !== false ||
		typeof row.result?.isError !== "boolean"
	)
		return;

	return { name: row.toolName, isError: row.result.isError };
}

function renderSummary(
	container: Container,
	width: number,
	theme: SummaryTheme,
): string[] {
	const lines: string[] = [];
	const mouseChildren: Array<{ component: Component; height: number }> = [];
	const counts = new Map<string, number>();
	let failures = 0;
	let summaryIndex: number | undefined;

	function flush(): void {
		if (summaryIndex === undefined) return;
		const tools = [...counts]
			.map(([name, count]) => `${name} ×${count}`)
			.join(" · ");
		const status = failures > 0 ? `✗ ${failures} failed ·` : "✓";
		lines[summaryIndex] = truncateToWidth(
			theme.fg(failures > 0 ? "error" : "success", ` ${status} ${tools}`),
			width,
		);
		counts.clear();
		failures = 0;
		summaryIndex = undefined;
	}

	for (const child of container.children) {
		const tool = completedTool(child);
		if (tool) {
			if (summaryIndex === undefined) {
				const start = lines.length;
				lines.push("", "");
				summaryIndex = lines.length - 1;
				mouseChildren.push({
					component: {
						render: () => lines.slice(start, start + 2),
						invalidate: () => undefined,
					},
					height: 2,
				});
			}
			counts.set(tool.name, (counts.get(tool.name) ?? 0) + 1);
			if (tool.isError) failures++;
			continue;
		}

		const childLines = child.render(width);
		// Tool-only assistant messages render no lines. Visible messages (and
		// other transcript entries) always separate groups. Pending tool rows
		// stay untouched, while completed siblings share one summary.
		const pendingTool =
			child instanceof ToolExecutionComponent &&
			(child as unknown as { isPartial?: unknown }).isPartial === true;
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
		if (!pendingTool && !assistantWithoutVisibleMessage) flush();
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
 * Intercept only containers with completed, collapsed tool rows. Do not replace
 * tools, mutate the component tree, or change individual renderers: expansion,
 * streaming, images and diffs continue to use Pi's original implementation.
 */
export function installToolSummary(getTheme: () => SummaryTheme): () => void {
	const originalRender = Container.prototype.render;
	let active = true;

	function render(this: Container, width: number): string[] {
		if (!active || !this.children.some((child) => completedTool(child))) {
			return originalRender.call(this, width);
		}
		return renderSummary(this, width, getTheme());
	}

	Container.prototype.render = render;
	return () => {
		active = false;
		// Do not remove another extension's wrapper installed after ours.
		if (Container.prototype.render === render) {
			Container.prototype.render = originalRender;
		}
	};
}
