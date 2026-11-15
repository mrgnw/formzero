import { type APIRequestContext, expect, request as playwrightRequest, test } from "@playwright/test";
import { createForm, d1, firstForm, origin, storageStatePath, submissionPath } from "./support";

let owner: APIRequestContext;

test.beforeAll(async () => {
	owner = await playwrightRequest.newContext({ baseURL: origin, storageState: storageStatePath });
});

test.afterAll(async () => {
	await owner.dispose();
});

function postForm(headers: Record<string, string>) {
	return owner.post("/forms", { form: { name: "CSRF Probe" }, headers, maxRedirects: 0 });
}

for (const [label, value] of [
	["a mismatched", "https://attacker.example"],
	["a null", "null"],
]) {
	test(`POST /forms with ${label} Origin is rejected`, async () => {
		const response = await postForm({ Origin: value });
		expect(response.status()).toBe(403);
	});
}

test("POST /forms without an Origin header is rejected", async () => {
	const response = await postForm({});
	expect(response.status()).toBe(403);
});

test("a no-JS remote form post with a matching Origin is allowed", async () => {
	const formId = createForm("CSRF Probe");
	const settingsPath = `/forms/${formId}/settings`;
	const html = await (await owner.get(settingsPath)).text();
	const action = html.match(/action="(\?\/remote=[^"]*\/renameForm\/[^"]*)"/)?.[1];
	expect(action).toBeDefined();
	const fields = Object.fromEntries(
		[...html.matchAll(/name="((?:id|name)\/[^"]*\/renameForm)"/g)].map(([, field]) => [field, field.startsWith("id/") ? formId : "CSRF Probe Renamed"]),
	);
	const response = await owner.post(`${settingsPath}${action}`, {
		form: fields,
		headers: { Origin: origin, Accept: "text/html" },
		maxRedirects: 0,
	});
	expect(response.status()).toBe(200);
	expect(d1(`SELECT name FROM forms WHERE id = '${formId}'`)).toEqual([{ name: "CSRF Probe Renamed" }]);
});

test("a no-JS remote form post without an Origin header is rejected", async () => {
	const response = await owner.post("/setup?/remote=anything", { form: { name: "CSRF Probe" }, maxRedirects: 0 });
	expect(response.status()).toBe(403);
});

test("a POST to the public API without an Origin header is accepted", async () => {
	const response = await owner.post(submissionPath(firstForm.id), { form: { name: "Grace" }, maxRedirects: 0 });
	expect(response.status()).toBe(303);
});

test("a cross-origin POST to the public API is accepted", async () => {
	const response = await owner.post(submissionPath(firstForm.id), {
		form: { name: "Grace" },
		headers: { Origin: "https://customer.example" },
		maxRedirects: 0,
	});
	expect(response.status()).toBe(303);
});
