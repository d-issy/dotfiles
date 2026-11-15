import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"#pi-user": fileURLToPath(
				new URL("./files/pi/agent/extensions/user", import.meta.url),
			),
		},
	},
	test: {
		include: [
			"tests/pi/agent/extensions/**/*.test.ts",
			"tests/agent-sessions/**/*.test.ts",
			"tests/command-library/**/*.test.ts",
		],
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary", "html"],
			include: ["files/pi/agent/extensions/user/**/*.ts"],
			exclude: [
				"tests/pi/agent/extensions/**/*.test.ts",
				"files/pi/agent/extensions/**/index.ts",
			],
		},
	},
});
