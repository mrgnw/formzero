import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [tailwindcss(), reactRouter(), tsconfigPaths({ projects: ["./tsconfig.react.json"] })],
	ssr: {
		target: "webworker",
		noExternal: true,
		resolve: { conditions: ["workerd", "worker", "browser"], externalConditions: ["workerd", "worker"] },
	},
});
