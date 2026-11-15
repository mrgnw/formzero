import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { type APIRequestContext, expect, test } from "@playwright/test";
import { authedRequest, createForm, d1, emptyStorageState, originHeaders, submissionPath } from "./support";

test.use({ storageState: emptyStorageState });

const corsHeaders = {
	"access-control-allow-origin": "*",
	"access-control-allow-methods": "POST, OPTIONS",
	"access-control-allow-headers": "Content-Type, Accept",
	"access-control-max-age": "86400",
};

let formId: string;

test.beforeAll(() => {
	formId = createForm("API Contract");
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

test("an unknown URL renders the 404 page", async ({ page }) => {
	const response = await page.goto("/no-such-page");
	expect(response?.status()).toBe(404);
	await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
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
	async function exportCsv(formName: string, data: Record<string, string>) {
		const owner = await authedRequest();
		const csvFormId = createForm(formName);
		const created = await owner.post(submissionPath(csvFormId), { data });
		const { id } = await created.json();
		const body = await (await owner.get(`/forms/${csvFormId}/submissions.csv`)).text();
		await owner.dispose();
		return { id, body };
	}

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
		const csvFormId = createForm("CSV Export");
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

	test("header cells are escaped and a lone carriage return is quoted", async () => {
		const { id, body } = await exportCsv("CSV Escaping", { 'a,"b': "x\ry" });
		expect(body.split("\n")[0]).toBe('ID,Created At,"a,""b"');
		expect(body).toMatch(new RegExp(`\\n${id},[^,]+,"x\\ry"$`));
	});

	test("cells that start like a formula are prefixed with a single quote", async () => {
		const { id, body } = await exportCsv("CSV Formulas", {
			"=x": '=HYPERLINK("https://evil.example","click")',
			plain: "@SUM(A1)",
		});
		const [header, row] = body.split("\n");
		expect(header).toBe("ID,Created At,'=x,plain");
		const [rowId, createdAt] = row.split(",");
		expect(rowId).toBe(id);
		expect(row).toBe(`${id},${createdAt},"'=HYPERLINK(""https://evil.example"",""click"")",'@SUM(A1)`);
	});
});

test.describe("rate limits", () => {
	test("the 31st submission from one IP to one form within a minute is 429 with CORS", async ({ request }) => {
		const limitedForm = createForm("Rate Limited");
		const headers = { ...originHeaders, "CF-Connecting-IP": "192.0.2.200" };
		for (let attempt = 1; attempt <= 30; attempt++) {
			const response = await post(request, submissionPath(limitedForm), { headers, data: { attempt: String(attempt) } });
			expect(response.status(), `attempt ${attempt}`).toBe(201);
		}
		const limited = await post(request, submissionPath(limitedForm), { headers, data: { attempt: "31" } });
		expect(limited.status()).toBe(429);
		expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
		expect(limited.headers()).toMatchObject(corsHeaders);
		expect(await limited.json()).toEqual({ success: false, error: "Too many submissions" });
		expect(d1(`SELECT COUNT(*) AS count FROM submissions WHERE form_id = '${limitedForm}'`)[0].count).toBe(30);

		const otherIp = await post(request, submissionPath(limitedForm), {
			headers: { ...originHeaders, "CF-Connecting-IP": "192.0.2.201" },
			data: { attempt: "other" },
		});
		expect(otherIp.status()).toBe(201);
	});

	test("each hit deletes at most 100 expired rate-limit rows", async ({ request }) => {
		const cleanupForm = createForm("Limiter Cleanup");
		const expired = Array.from({ length: 150 }, (_, row) => `('expired:${row}', 1, 1)`).join(", ");
		d1(`INSERT INTO rate_limits (key, count, reset_at) VALUES ${expired}`);
		const response = await post(request, submissionPath(cleanupForm), { data: { name: "Ada" } });
		expect(response.status()).toBe(201);
		expect(d1("SELECT COUNT(*) AS count FROM rate_limits WHERE key LIKE 'expired:%'")[0].count).toBe(50);
		d1("DELETE FROM rate_limits WHERE key LIKE 'expired:%'");
	});

	test("submissions are still stored when the rate limiter table is missing", async ({ request }) => {
		const failOpenForm = createForm("Limiter Down");
		d1("DROP TABLE rate_limits");
		try {
			const response = await post(request, submissionPath(failOpenForm), { data: { name: "Ada" } });
			expect(response.status()).toBe(201);
			expect(d1(`SELECT COUNT(*) AS count FROM submissions WHERE form_id = '${failOpenForm}'`)[0].count).toBe(1);
		} finally {
			d1(readFileSync("migrations/0005_create_rate_limits.sql", "utf8").replace(/^--.*$/gm, ""));
		}
	});

	test("notification sends stop at 20 per form per hour while submissions are still stored", async ({ request }) => {
		const notifiedForm = createForm("Notification Cap");
		let smtpConnections = 0;
		const smtp = createServer((socket) => {
			smtpConnections++;
			socket.destroy();
		});
		const port = 2525;
		await new Promise<void>((resolve, reject) => smtp.once("error", reject).listen(port, "127.0.0.1", resolve));
		const saved = d1("SELECT * FROM settings");
		d1(
			`INSERT OR REPLACE INTO settings (id, notification_email, notification_email_password, smtp_host, smtp_port, smtp_secure, updated_at) VALUES ('global', 'cap@example.org', 'secret', '127.0.0.1', ${port}, 1, 1700000000000)`,
		);
		try {
			for (let attempt = 1; attempt <= 22; attempt++) {
				const response = await post(request, submissionPath(notifiedForm), {
					headers: { "CF-Connecting-IP": `192.0.2.${attempt}` },
					data: { attempt: String(attempt) },
				});
				expect(response.status()).toBe(201);
			}
			await expect
				.poll(() => d1(`SELECT count FROM rate_limits WHERE key = 'notify:${notifiedForm}'`)[0]?.count)
				.toBe(22);
			await expect.poll(() => smtpConnections).toBe(20);
			await new Promise((resolve) => setTimeout(resolve, 1000));
			expect(smtpConnections).toBe(20);
			expect(d1(`SELECT COUNT(*) AS count FROM submissions WHERE form_id = '${notifiedForm}'`)[0].count).toBe(22);
		} finally {
			smtp.close();
			d1("DELETE FROM settings");
			for (const row of saved) {
				const columns = Object.keys(row);
				const values = columns.map((column) => (row[column] === null ? "NULL" : `'${String(row[column]).replaceAll("'", "''")}'`));
				d1(`INSERT INTO settings (${columns.join(", ")}) VALUES (${values.join(", ")})`);
			}
		}
	});
});
