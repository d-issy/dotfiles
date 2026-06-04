import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, parse, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import deployedUser from "./main";

const DEBUG_FLAG = "--debug";
const DEBUG_MAIN_RELATIVE_PATH = join(
	"files",
	"pi",
	"agent",
	"extensions",
	"user",
	"main.ts",
);

type UserExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>;
type JitiLoader = {
	import<T>(path: string, options: { default: true }): Promise<T>;
};
type CreateJiti = (
	url: string,
	options: { fsCache: boolean; moduleCache: boolean },
) => JitiLoader;

function hasDebugFlag(
	argv: readonly string[] = process.argv.slice(2),
): boolean {
	for (const arg of argv) {
		if (arg === "--") return false;
		if (arg === DEBUG_FLAG) return true;
	}

	return false;
}

function findDebugPath(cwd: string, relativePath: string): string | undefined {
	let dir = resolve(cwd);
	const root = parse(dir).root;

	while (true) {
		const candidate = join(dir, relativePath);
		if (existsSync(candidate)) return candidate;
		if (dir === root) return undefined;
		dir = dirname(dir);
	}
}

function isUserExtensionFactory(value: unknown): value is UserExtensionFactory {
	return typeof value === "function";
}

async function loadUserExtension(path: string): Promise<UserExtensionFactory> {
	const piModuleUrl = new URL(
		import.meta.resolve("@earendil-works/pi-coding-agent"),
	);
	const piRequire = createRequire(piModuleUrl);
	const { createJiti } = piRequire("jiti") as {
		createJiti: CreateJiti;
	};
	const jiti = createJiti(import.meta.url, {
		fsCache: false,
		moduleCache: false,
	});
	const factory = await jiti.import<unknown>(path, { default: true });

	if (!isUserExtensionFactory(factory)) {
		throw new TypeError(
			`Expected ${path} to export a default extension factory.`,
		);
	}

	return factory;
}

export default async function userBootstrap(pi: ExtensionAPI): Promise<void> {
	pi.registerFlag("debug", {
		description:
			"Load the user extension from the nearest dotfiles working tree instead of the deployed config.",
		type: "boolean",
		default: false,
	});

	// Read argv directly instead of pi.getFlag("debug"): the framework applies
	// CLI flag values only after every extension factory has run, so getFlag
	// would still return the default here. registerFlag above stays for --help
	// and to suppress the "unknown option" error.
	if (!hasDebugFlag()) {
		await deployedUser(pi);
		return;
	}

	const mainPath = findDebugPath(process.cwd(), DEBUG_MAIN_RELATIVE_PATH);
	if (!mainPath) {
		throw new Error(
			`Could not find ${DEBUG_MAIN_RELATIVE_PATH} from ${process.cwd()} for ${DEBUG_FLAG} mode.`,
		);
	}

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setStatus("debug", ctx.ui.theme.fg("dim", "[debug]"));
		ctx.ui.notify(`Loaded user extension from ${mainPath}`, "info");
	});

	const register = await loadUserExtension(mainPath);
	await register(pi);
}
