import { type APIRequestContext, expect, test } from "@playwright/test";
import { authedRequest, createForm, emptyStorageState, originHeaders, submissionPath } from "./support";

test.use({ storageState: emptyStorageState });

const corsHeaders = {
	"access-control-allow-origin": "*",
	"access-control-allow-methods": "POST, OPTIONS",
	"access-control-allow-headers": "Content-Type, Accept",
	"access-control-max-age": "86400",
};

let formId: string;

test.beforeAll(async () => {
	const owner = await authedRequest();
	formId = await createForm(owner, "API Contract");
	await owner.dispose();
});

function post(request: APIRequestContext, url: string, options: Parameters<APIRequestContext["post"]>[1]) {
	return request.post(url, {
		maxRedirects: 0,
		...options,
		headers: { ...originHeaders, ...options?.headers },
	});
}

test.describe("JSON submissions", () => {
	test("201 with success and id", async ({ request }) => {
		const response = await post(request, submissionPath(formId), {
			data: { name: "Ada", email: "ada@example.com" },
		});
		expect(response.status()).toBe(201);
		expect(response.headers()["access-control-allow-origin"]).toBe("*");
		const body = await response.json();
		expect(body.success).toBe(true);
		expect(body.id).toEqual(expect.any(String));
	});

	test("Accept: application/json on a form post also answers JSON", async ({ request }) => {
		const response = await post(request, submissionPath(formId), {
			form: { name: "Grace" },
			headers: { Accept: "application/json" },
		});
		expect(response.status()).toBe(201);
		expect((await response.json()).success).toBe(true);
	});

	test("404 for an unknown form", async ({ request }) => {
		const response = await post(request, submissionPath("no-such-form"), { data: { a: 1 } });
		expect(response.status()).toBe(404);
		expect(response.headers()["access-control-allow-origin"]).toBe("*");
		expect(await response.json()).toEqual({ success: false, error: "Form not found" });
	});

	test("415 for an unsupported content type", async ({ request }) => {
		const response = await post(request, submissionPath(formId), {
			data: "plain text",
			headers: { "Content-Type": "text/plain", Accept: "application/json" },
		});
		expect(response.status()).toBe(415);
		expect(response.headers()["access-control-allow-origin"]).toBe("*");
		expect(await response.json()).toEqual({ success: false, error: "Unsupported content type" });
	});
});

test.describe("HTML form submissions", () => {
	const formBodies = {
		urlencoded: { form: { name: "Linus", email: "linus@example.com" } },
		multipart: { multipart: { name: "Linus", email: "linus@example.com" } },
	};

	for (const [kind, body] of Object.entries(formBodies)) {
		test.describe(kind, () => {
			test("303 to ?redirect when present", async ({ request }) => {
				const target = "https://customer.example/thanks";
				const response = await post(request, `${submissionPath(formId)}?redirect=${encodeURIComponent(target)}`, {
					...body,
					headers: { Referer: "https://customer.example/contact" },
				});
				expect(response.status()).toBe(303);
				expect(response.headers()["location"]).toBe(target);
			});

			test("303 to the referer without ?redirect", async ({ request }) => {
				const referer = "https://customer.example/contact";
				const response = await post(request, submissionPath(formId), {
					...body,
					headers: { Referer: referer },
				});
				expect(response.status()).toBe(303);
				expect(response.headers()["location"]).toBe(referer);
			});

			test("303 to /success with neither", async ({ request }) => {
				const response = await post(request, submissionPath(formId), body);
				expect(response.status()).toBe(303);
				expect(response.headers()["location"]).toBe("/success");
			});
		});
	}

	test("a cross-origin Origin header does not block a urlencoded post", async ({ request }) => {
		const response = await post(request, submissionPath(formId), {
			form: { name: "Margaret" },
			headers: { Origin: "https://customer.example" },
		});
		expect(response.status()).toBe(303);
		expect(response.headers()["location"]).toBe("/success");
	});

	test("302 to the error page for an unknown form", async ({ request }) => {
		const response = await post(request, submissionPath("no-such-form"), { form: { name: "x" } });
		expect(response.status()).toBe(302);
		expect(response.headers()["location"]).toBe("/error?error=form_not_found");
	});

	test("302 to the error page for an unsupported content type", async ({ request }) => {
		const response = await post(request, submissionPath(formId), {
			data: "plain text",
			headers: { "Content-Type": "text/plain" },
		});
		expect(response.status()).toBe(302);
		expect(response.headers()["location"]).toBe("/error?error=unsupported_content_type");
	});
});

test.describe("CORS", () => {
	test("OPTIONS answers 204 with the four CORS headers", async ({ request }) => {
		const response = await request.fetch(submissionPath(formId), {
			method: "OPTIONS",
			headers: originHeaders,
		});
		expect(response.status()).toBe(204);
		for (const [name, value] of Object.entries(corsHeaders)) {
			expect(response.headers()[name]).toBe(value);
		}
	});

	test("GET answers 405 with CORS headers", async ({ request }) => {
		const response = await request.get(submissionPath(formId));
		expect(response.status()).toBe(405);
		for (const [name, value] of Object.entries(corsHeaders)) {
			expect(response.headers()[name]).toBe(value);
		}
		expect(await response.json()).toEqual({ error: "Method not allowed" });
	});
});

test("the success and error pages render", async ({ page }) => {
	await page.goto("/success");
	await expect(page.getByRole("heading", { name: "Submission Successful!" })).toBeVisible();

	await page.goto("/error?error=form_not_found");
	await expect(page.getByRole("heading", { name: "Form Not Found" })).toBeVisible();
});

test.describe("result pages", () => {
	test("/success confirms the submission", async ({ page }) => {
		await page.goto("/success");
		await expect(page).toHaveTitle("Submission Successful");
		await expect(page.getByRole("heading", { name: "Submission Successful!" })).toBeVisible();
	});

	const errors = {
		form_not_found: "Form Not Found",
		unsupported_content_type: "Unsupported Format",
		internal_error: "Something Went Wrong",
		toString: "Something Went Wrong",
	};

	for (const [error, heading] of Object.entries(errors)) {
		test(`/error?error=${error} shows "${heading}"`, async ({ page }) => {
			await page.goto(`/error?error=${error}`);
			await expect(page.getByRole("heading", { name: heading })).toBeVisible();
		});
	}
});

test.describe("CSV export", () => {
	test("a signed-out visitor is sent to /login", async ({ request }) => {
		const response = await request.get(`/forms/${formId}/submissions.csv`, { maxRedirects: 0 });
		expect(response.status()).toBe(302);
		expect(response.headers()["location"]).toBe("/login");
	});

	test("an unknown form is a 404", async () => {
		const owner = await authedRequest();
		const response = await owner.get("/forms/no-such-form/submissions.csv", { maxRedirects: 0 });
		expect(response.status()).toBe(404);
		await owner.dispose();
	});

	test("columns are ID, ISO time, then sorted keys, with values escaped", async () => {
		const owner = await authedRequest();
		const csvFormId = await createForm(owner, "CSV Export");
		const created = await owner.post(submissionPath(csvFormId), {
			data: { zeta: "plain", alpha: 'a, "quoted"\nline' },
		});
		const { id } = await created.json();

		const response = await owner.get(`/forms/${csvFormId}/submissions.csv`);
		expect(response.status()).toBe(200);
		expect(response.headers()["content-type"]).toBe("text/csv; charset=utf-8");
		expect(response.headers()["content-disposition"]).toMatch(
			/^attachment; filename="submissions-\d{4}-\d{2}-\d{2}\.csv"$/,
		);
		const body = await response.text();
		expect(body).toMatch(
			new RegExp(`^ID,Created At,alpha,zeta\\n${id},\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z,"a, ""quoted""\\nline",plain$`),
		);
		await owner.dispose();
	});
});
