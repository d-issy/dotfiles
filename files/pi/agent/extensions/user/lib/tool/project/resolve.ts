import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { buildParameterSchema } from "./schema";
import type {
	ProjectToolCommandArgument,
	ProjectToolCommandConfig,
	ProjectToolConfig,
	ResolvedProjectTool,
} from "./types";

function resolveProjectCwd(
	root: string,
	cwd: string | undefined,
	path: string,
): { absolute: string; display: string } {
	if (cwd === undefined || cwd === "") return { absolute: root, display: "." };
	if (isAbsolute(cwd))
		throw new Error(`${path} must be relative to the project root.`);

	const absolute = resolve(root, cwd);
	const rel = relative(root, absolute);
	if (rel === "" || rel === ".") return { absolute: root, display: "." };
	if (rel.startsWith("..") || isAbsolute(rel)) {
		throw new Error(`${path} must stay inside the project root.`);
	}

	const realRoot = realpathSync(root);
	const realAbsolute = realpathSync(absolute);
	const realRel = relative(realRoot, realAbsolute);
	if (realRel.startsWith("..") || isAbsolute(realRel)) {
		throw new Error(`${path} must stay inside the project root.`);
	}
	return { absolute, display: rel };
}

function formatArgumentForDisplay(
	argument: ProjectToolCommandArgument,
): string {
	if (argument.kind === "literal") return argument.value;
	if (argument.kind === "param") return `{{${argument.name}}}`;
	if (argument.kind === "flag") return `${argument.flag} when ${argument.when}`;
	if (argument.kind === "option")
		return `${argument.option} {{${argument.name}}}`;
	if (argument.style === "repeat")
		return `${argument.option} {{${argument.name}}}...`;
	if (argument.style === "spread") return `{{${argument.name}}}...`;
	const joined = `join({{${argument.name}}}, ${JSON.stringify(argument.separator)})`;
	return argument.option ? `${argument.option} ${joined}` : joined;
}

function formatConfiguredCommand(command: ProjectToolCommandConfig): string {
	return [
		command.command,
		...command.arguments.map(formatArgumentForDisplay),
	].join(" ");
}

export function resolveTool(
	root: string,
	config: ProjectToolConfig,
): ResolvedProjectTool {
	const toolCwd = resolveProjectCwd(root, config.cwd, `${config.name}.cwd`);
	return {
		...config,
		projectRoot: realpathSync(root),
		parametersSchema: buildParameterSchema(config.parameters),
		commands: config.commands.map((command, index) => {
			const cwd = resolveProjectCwd(
				root,
				command.cwd ?? config.cwd,
				`${config.name}.commands[${index}].cwd`,
			);
			return {
				...command,
				index,
				displayLabel: command.label ?? String(index + 1),
				displayCommand: formatConfiguredCommand(command),
				absoluteCwd: cwd.absolute,
				displayCwd: cwd.display,
				timeoutSeconds: command.timeoutSeconds ?? config.timeoutSeconds,
			};
		}),
		cwd: toolCwd.display === "." ? undefined : toolCwd.display,
	};
}
