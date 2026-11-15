import type { User } from 'better-auth';

declare global {
	namespace App {
		interface Locals {
			user: User | null;
		}
	}
	namespace Cloudflare {
		interface Env {
			BETTER_AUTH_SECRET: string;
		}
	}
}

export {};
