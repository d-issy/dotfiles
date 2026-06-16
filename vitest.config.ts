import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["files/pi/agent/extensions/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary", "html"],
			include: ["files/pi/agent/extensions/user/**/*.ts"],
			exclude: [
				"files/pi/agent/extensions/**/*.test.ts",
				"files/pi/agent/extensions/**/index.ts",
				"files/pi/agent/extensions/**/types.ts",
			],
		},
	},
});
