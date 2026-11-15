import { type APIRequestContext, expect, request as playwrightRequest, test } from "@playwright/test";
import { firstForm, origin, storageStatePath, submissionPath } from "./support";

let owner: APIRequestContext;

test.beforeAll(async () => {
	owner = await playwrightRequest.newContext({ baseURL: origin, storageState: storageStatePath });
});

test.afterAll(async () => {
	await owner.dispose();
});

test("a cross-origin urlencoded POST /forms is rejected", async () => {
	const response = await owner.post("/forms", {
		form: { name: "Forged" },
		headers: { Origin: "https://attacker.example" },
		maxRedirects: 0,
	});
	expect(response.status()).toBe(403);
});

test("a POST /forms without an Origin header is rejected", async () => {
	const response = await owner.post("/forms", { form: { name: "Forged" }, maxRedirects: 0 });
	expect(response.status()).toBe(403);
});

test("a cross-origin POST to the public API is accepted", async () => {
	const response = await owner.post(submissionPath(firstForm.id), {
		form: { name: "Grace" },
		headers: { Origin: "https://customer.example" },
		maxRedirects: 0,
	});
	expect(response.status()).toBe(303);
});
