import { defineConfig } from "@playwright/test";
import { storageStatePath } from "./tests/support";

const port = Number(process.env.E2E_PORT ?? 5473);
const signedIn = { storageState: storageStatePath };
const baseURL = `http://localhost:${port}`;

export default defineConfig({
	testDir: "./tests",
	workers: 1,
	fullyParallel: false,
	retries: 0,
	timeout: 30_000,
	reporter: [["list"]],
	use: { baseURL },
	projects: [
		{ name: "setup", testMatch: /auth\.setup\.ts/ },
		{ name: "dashboard", testMatch: /dashboard\.spec\.ts/, dependencies: ["setup"], use: signedIn },
		{ name: "auth", testMatch: /auth\.spec\.ts/, dependencies: ["setup"], use: signedIn },
		{ name: "api", testMatch: /api\.spec\.ts/, dependencies: ["setup"], use: signedIn },
		{ name: "csrf", testMatch: /csrf\.spec\.ts/, dependencies: ["setup"], use: signedIn },
	],
	webServer: {
		command: `npm run build && npx tsx tests/global-setup.ts && npx wrangler dev --port ${port} --persist-to .wrangler/e2e --var BETTER_AUTH_SECRET:e2e-only-0123456789abcdef0123456789`,
		url: baseURL,
		stdout: "ignore",
		reuseExistingServer: false,
		timeout: 180_000,
	},
});
