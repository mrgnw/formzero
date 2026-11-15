import { type APIRequestContext, expect, test } from "@playwright/test";
import { d1, emptyStorageState, originHeaders, submissionPath } from "./support";

test.use({ storageState: emptyStorageState });

const formId = "intake-limits";

test.beforeAll(() => {
	d1(`INSERT OR IGNORE INTO forms (id, name, created_at, updated_at) VALUES ('${formId}', 'Intake Limits', 0, 0)`);
});

function post(request: APIRequestContext, options: Parameters<APIRequestContext["post"]>[1], path = submissionPath(formId)) {
	return request.post(path, {
		maxRedirects: 0,
		...options,
		headers: { ...originHeaders, ...options?.headers },
	});
}

function postJson(request: APIRequestContext, body: string) {
	return post(request, { data: Buffer.from(body), headers: { "Content-Type": "application/json" } });
}

function storedCount() {
	return Number(d1(`SELECT count(*) AS n FROM submissions WHERE form_id = '${formId}'`)[0].n);
}

async function expectRejected(response: Awaited<ReturnType<typeof post>>, status: number, error: string) {
	expect(response.status()).toBe(status);
	expect(response.headers()["access-control-allow-origin"]).toBe("*");
	expect(await response.json()).toEqual({ success: false, error });
}

test.describe("JSON shape", () => {
	for (const body of ["null", "[]", '[{"a":1}]', "42", '"text"', "true"]) {
		test(`${body} is rejected with 400 and not stored`, async ({ request }) => {
			const before = storedCount();
			await expectRejected(await postJson(request, body), 400, "Submission must be a JSON object");
			expect(storedCount()).toBe(before);
		});
	}

	for (const body of ["{", "", "{'a':1}"]) {
		test(`malformed JSON ${JSON.stringify(body)} is a 400`, async ({ request }) => {
			await expectRejected(await postJson(request, body), 400, "Malformed JSON");
		});
	}

	test("a charset parameter on application/json is accepted", async ({ request }) => {
		const response = await post(request, {
			data: '{"name":"Ada"}',
			headers: { "Content-Type": "application/json; charset=utf-8" },
		});
		expect(response.status()).toBe(201);
	});

	test("a media type that merely contains application/json is a 415", async ({ request }) => {
		const response = await post(request, {
			data: '{"name":"Ada"}',
			headers: { "Content-Type": "text/plain; x=application/json", Accept: "application/json" },
		});
		await expectRejected(response, 415, "Unsupported content type");
	});
});

test.describe("multipart files", () => {
	const file = { name: "cv.txt", mimeType: "text/plain", buffer: Buffer.from("hello") };

	test("a file part is a 400 for JSON clients", async ({ request }) => {
		const response = await post(request, {
			multipart: { name: "Ada", cv: file },
			headers: { Accept: "application/json" },
		});
		await expectRejected(response, 400, "File uploads are not supported");
	});

	test("a file part sends a browser to the error page", async ({ request }) => {
		const response = await post(request, { multipart: { name: "Ada", cv: file } });
		expect(response.status()).toBe(302);
		expect(response.headers()["location"]).toBe("/error?error=invalid_submission");
	});

	test("the error page explains the rejection", async ({ page }) => {
		await page.goto("/error?error=invalid_submission");
		await expect(page.getByRole("heading", { name: "Submission Rejected" })).toBeVisible();
	});
});
