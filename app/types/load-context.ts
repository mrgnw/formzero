declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: Env;
			ctx: ExecutionContext;
		};
	}
}

declare global {
	interface Env {
		BETTER_AUTH_SECRET: string;
	}
}

export {};
