import type { TSchema } from "typebox";
import { PROJECT_USER_SETTINGS_RELATIVE_PATH } from "../../project-settings";

export const PROJECT_TOOL_SETTINGS_RELATIVE_PATH =
	PROJECT_USER_SETTINGS_RELATIVE_PATH;
export const RUNNING_TAIL_LINES = 3;
export const EXPANDED_TAIL_LINES = 200;
export const UPDATE_THROTTLE_MS = 100;

export type ProjectToolSettings = {
	tools?: unknown;
};

export type ProjectScalarParameterType = "string" | "number" | "boolean";
export type ProjectArrayItemType = ProjectScalarParameterType;
export type ProjectToolExecutionMode = "sequential" | "parallel";
export type ProjectArrayArgumentStyle = "repeat" | "spread" | "join";

export type ProjectScalarParameterConfig = {
	readonly type: ProjectScalarParameterType;
	readonly description?: string;
	readonly required: boolean;
};

export type ProjectArrayParameterConfig = {
	readonly type: "array";
	readonly items: { readonly type: ProjectArrayItemType };
	readonly description?: string;
	readonly required: boolean;
};

export type ProjectParameterConfig =
	| ProjectScalarParameterConfig
	| ProjectArrayParameterConfig;

export type ProjectScalarParameterValue = string | number | boolean;
export type ProjectArrayParameterValue = readonly ProjectScalarParameterValue[];
export type ProjectParameterValue =
	| ProjectScalarParameterValue
	| ProjectArrayParameterValue;

export type ProjectToolInput = Record<
	string,
	ProjectParameterValue | undefined
>;

export type ProjectToolCommandArgument =
	| { readonly kind: "literal"; readonly value: string }
	| { readonly kind: "param"; readonly name: string }
	| { readonly kind: "flag"; readonly flag: string; readonly when: string }
	| { readonly kind: "option"; readonly option: string; readonly name: string }
	| {
			readonly kind: "array";
			readonly style: "repeat";
			readonly option: string;
			readonly name: string;
	  }
	| { readonly kind: "array"; readonly style: "spread"; readonly name: string }
	| {
			readonly kind: "array";
			readonly style: "join";
			readonly option?: string;
			readonly name: string;
			readonly separator: string;
	  };

export type ProjectToolCommandConfig = {
	readonly label?: string;
	readonly command: string;
	readonly arguments: readonly ProjectToolCommandArgument[];
	readonly cwd?: string;
	readonly timeoutSeconds?: number;
};

export type ProjectToolConfig = {
	readonly name: string;
	readonly description: string;
	readonly parameters: Readonly<Record<string, ProjectParameterConfig>>;
	readonly executionMode?: ProjectToolExecutionMode;
	readonly cwd?: string;
	readonly timeoutSeconds?: number;
	readonly promptSnippet?: string;
	readonly promptGuidelines?: readonly string[];
	readonly commands: readonly ProjectToolCommandConfig[];
};

export type ResolvedProjectToolCommand = ProjectToolCommandConfig & {
	readonly index: number;
	readonly displayLabel: string;
	readonly displayCommand: string;
	readonly absoluteCwd: string;
	readonly displayCwd: string;
	readonly timeoutSeconds?: number;
};

export type ResolvedProjectTool = Omit<ProjectToolConfig, "commands"> & {
	readonly projectRoot: string;
	readonly parametersSchema: TSchema;
	readonly commands: readonly ResolvedProjectToolCommand[];
};

export type ProjectToolSummary = {
	readonly name: string;
	readonly commandCount: number;
};

export type ProjectCommandStatus =
	| "pending"
	| "running"
	| "succeeded"
	| "failed";

export type ProjectCommandDetails = {
	readonly label: string;
	readonly command: string;
	readonly cwd: string;
	readonly timeoutSeconds?: number;
	readonly status: ProjectCommandStatus;
	readonly exitCode?: number | null;
	readonly error?: string;
	readonly output: string;
	readonly fullOutputPath?: string;
	readonly truncated: boolean;
	readonly durationMs?: number;
};

export type ProjectToolDetails = {
	readonly kind: "project-tool";
	readonly toolName: string;
	readonly status: "running" | "finished";
	readonly commandCount: number;
	readonly failed: boolean;
	readonly commands: readonly ProjectCommandDetails[];
};
