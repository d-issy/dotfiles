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
		// Project names match the path filters in .github/workflows/test.yml.
		projects: [
			{
				extends: true,
				test: {
					name: "pi",
					include: ["tests/pi/agent/extensions/**/*.test.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "agent-sessions",
					include: ["tests/agent-sessions/**/*.test.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "command-library",
					include: ["tests/command-library/**/*.test.ts"],
				},
			},
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
