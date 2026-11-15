import { type APIRequestContext, expect, request as playwrightRequest } from "@playwright/test";

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
