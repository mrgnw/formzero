import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

const persistDir = ".wrangler/e2e";

rmSync(persistDir, { recursive: true, force: true });
execFileSync(
	"npx",
	["wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", persistDir],
	{ stdio: "inherit" },
);
