import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import {
	type AgentToolResult,
	type AgentToolUpdateCallback,
	type ExtensionAPI,
	type ExtensionContext,
	type ToolDefinition,
	type ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
import type { TSchema } from "typebox";
import { executeProjectTool } from "./execute";
import { isProjectToolDetails } from "./details";
import { normalizeTool } from "./normalize";
import { renderCallTitle, renderResult } from "./render";
import { resolveTool } from "./resolve";
import type {
	ProjectToolDetails,
	ProjectToolInput,
	ProjectToolSettings,
	ProjectToolSummary,
	ResolvedProjectTool,
} from "./types";
import { PROJECT_TOOL_SETTINGS_RELATIVE_PATH } from "./types";
import { isObject, notifyWarning } from "./utils";
import { isProjectUserSettingsTrusted } from "../../project-settings";

const registeredProjectTools = new Map<
	string,
	{ readonly projectRoot: string }
>();
let enabledProjectToolNames = new Set<string>();

function createBlockedProjectToolResult(
	tool: ResolvedProjectTool,
	reason: string,
): AgentToolResult<ProjectToolDetails> {
	return {
		content: [{ type: "text", text: reason }],
		details: {
			kind: "project-tool",
			toolName: tool.name,
			status: "finished",
			commandCount: 0,
			failed: true,
			commands: [],
		},
	};
}

function isSameProjectRoot(
	ctx: ExtensionContext,
	tool: ResolvedProjectTool,
): boolean {
	try {
		return realpathSync(ctx.cwd) === tool.projectRoot;
	} catch {
		return false;
	}
}

function createProjectToolDefinition(
	tool: ResolvedProjectTool,
): ToolDefinition<TSchema, ProjectToolDetails> {
	return {
		name: tool.name,
		label: tool.name,
		description: tool.description,
		promptSnippet: tool.promptSnippet,
		promptGuidelines: tool.promptGuidelines
			? [...tool.promptGuidelines]
			: undefined,
		parameters: tool.parametersSchema,
		executionMode: tool.executionMode ?? "sequential",
		renderCall: (args, theme) =>
			renderCallTitle(tool, args as ProjectToolInput, theme),
		renderResult,
		execute: async (
			_toolCallId: string,
			params,
			signal: AbortSignal | undefined,
			onUpdate: AgentToolUpdateCallback<ProjectToolDetails> | undefined,
			ctx: ExtensionContext,
		) => {
			if (!isProjectUserSettingsTrusted(ctx)) {
				return createBlockedProjectToolResult(
					tool,
					`Project tool '${tool.name}' is disabled because project user settings are not trusted.`,
				);
			}
			if (!enabledProjectToolNames.has(tool.name)) {
				return createBlockedProjectToolResult(
					tool,
					`Project tool '${tool.name}' is not enabled for the current project.`,
				);
			}
			if (!isSameProjectRoot(ctx, tool)) {
				return createBlockedProjectToolResult(
					tool,
					`Project tool '${tool.name}' belongs to a different project and is disabled here.`,
				);
			}
			return executeProjectTool(
				tool,
				params as ProjectToolInput,
				ctx,
				signal,
				onUpdate,
			);
		},
	};
}

function loadProjectToolSettings(cwd: string): ProjectToolSettings {
	const path = join(cwd, PROJECT_TOOL_SETTINGS_RELATIVE_PATH);
	if (!existsSync(path)) return {};

	const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
	if (!isObject(parsed)) {
		throw new Error(
			`${PROJECT_TOOL_SETTINGS_RELATIVE_PATH} must contain a JSON object.`,
		);
	}
	return parsed as ProjectToolSettings;
}

export function registerProjectTools(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	registeredNames: Set<string>,
): readonly ProjectToolSummary[] {
	enabledProjectToolNames = new Set();
	if (!isProjectUserSettingsTrusted(ctx)) return [];

	let projectSettings: ProjectToolSettings;
	try {
		projectSettings = loadProjectToolSettings(ctx.cwd);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		notifyWarning(
			ctx,
			`Failed to read ${PROJECT_TOOL_SETTINGS_RELATIVE_PATH} project tools: ${message}`,
		);
		return [];
	}

	if (projectSettings.tools === undefined) return [];
	if (!isObject(projectSettings.tools)) {
		notifyWarning(ctx, "Project tools ignored: tools must be an object.");
		return [];
	}

	const existingToolNames = new Set(pi.getAllTools().map((tool) => tool.name));
	const summaries: ProjectToolSummary[] = [];
	const currentEnabledProjectToolNames = new Set<string>();
	for (const [name, rawConfig] of Object.entries(projectSettings.tools)) {
		try {
			const isProjectToolUpdate = registeredProjectTools.has(name);
			if (existingToolNames.has(name) && !isProjectToolUpdate) {
				notifyWarning(
					ctx,
					`Project tool '${name}' conflicts with an existing tool and was ignored.`,
				);
				continue;
			}
			const resolved = resolveTool(ctx.cwd, normalizeTool(name, rawConfig));
			pi.registerTool(createProjectToolDefinition(resolved));
			registeredNames.add(name);
			registeredProjectTools.set(name, { projectRoot: resolved.projectRoot });
			currentEnabledProjectToolNames.add(name);
			summaries.push({
				name,
				commandCount: resolved.commands.length,
			});
		} catch (error) {
			notifyWarning(
				ctx,
				`Project tool '${name}' ignored: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	enabledProjectToolNames = currentEnabledProjectToolNames;
	return summaries;
}

export function isProjectToolAvailable(name: string): boolean {
	return !registeredProjectTools.has(name) || enabledProjectToolNames.has(name);
}

export function markFailedProjectToolResult(
	registeredNames: ReadonlySet<string>,
	event: ToolResultEvent,
): { isError: true } | undefined {
	if (!registeredNames.has(event.toolName)) return undefined;
	if (!isProjectToolDetails(event.details)) return undefined;
	return event.details.failed ? { isError: true } : undefined;
}
