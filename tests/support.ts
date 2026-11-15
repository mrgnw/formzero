import { execFileSync } from "node:child_process";
import { type APIRequestContext, expect, request as playwrightRequest } from "@playwright/test";

const persistDir = ".wrangler/e2e";

export const origin = "http://localhost:5473";

export const storageStatePath = ".wrangler/e2e-auth.json";

export const credentials = {
	name: "E2E Owner",
	email: "owner@example.com",
	password: "correct-horse-battery",
};

export const originHeaders = { Origin: origin };

export const emptyStorageState = { cookies: [], origins: [] };

export function submissionPath(formId: string) {
	return `/api/forms/${formId}/submissions`;
}

export function authedRequest() {
	return playwrightRequest.newContext({
		baseURL: origin,
		storageState: storageStatePath,
		extraHTTPHeaders: originHeaders,
	});
}

export async function createForm(request: APIRequestContext, name: string) {
	const response = await request.post("/forms", { form: { name }, maxRedirects: 0 });
	expect(response.status()).toBe(302);
	return response.headers()["location"].split("/")[2];
}

export async function postSubmission(request: APIRequestContext, formId: string, data: Record<string, string>) {
	const response = await request.post(submissionPath(formId), { data });
	expect(response.status()).toBe(201);
	await new Promise((resolve) => setTimeout(resolve, 5));
}

export function d1(sql: string): Record<string, unknown>[] {
	const output = execFileSync(
		"npx",
		["wrangler", "d1", "execute", "DB", "--local", "--persist-to", persistDir, "--json", "--command", sql],
		{ encoding: "utf8" },
	);
	return JSON.parse(output)[0].results;
}
