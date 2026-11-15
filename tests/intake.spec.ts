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

test.describe("limits", () => {
	const tooLarge = { success: false, error: "Submission is larger than 262144 bytes" };

	test("a body over 256 KiB is a 413", async ({ request }) => {
		const response = await postJson(request, JSON.stringify({ message: "x".repeat(270_000) }));
		await expectRejected(response, 413, tooLarge.error);
	});

	test("a chunked body over 256 KiB without Content-Length is a 413", async ({ baseURL }) => {
		const chunk = new TextEncoder().encode(`"${"x".repeat(16_000)}",`);
		let sent = 0;
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				if (sent === 0) controller.enqueue(new TextEncoder().encode('{"a":['));
				if (sent++ < 20) controller.enqueue(chunk);
				else controller.close();
			},
		});
		const response = await fetch(`${baseURL}${submissionPath(formId)}`, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...originHeaders },
			body,
			duplex: "half",
		} as RequestInit);
		expect(response.status).toBe(413);
		expect(await response.json()).toEqual(tooLarge);
	});

	test("an oversized form post sends a browser to the error page", async ({ request }) => {
		const response = await post(request, { form: { message: "x".repeat(270_000) } });
		expect(response.status()).toBe(302);
		expect(response.headers()["location"]).toBe("/error?error=invalid_submission");
	});

	test("more than 100 fields is a 400", async ({ request }) => {
		const fields = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`f${i}`, "v"]));
		await expectRejected(await postJson(request, JSON.stringify(fields)), 400, "Submission has more than 100 fields");
	});

	test("101 form parts with the same name are a 400", async ({ request }) => {
		const response = await post(request, {
			data: Array.from({ length: 101 }, (_, i) => `x=${i}`).join("&"),
			headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
		});
		await expectRejected(response, 400, "Submission has more than 100 fields");
	});

	test("100 form parts with the same name are stored, last value wins", async ({ request }) => {
		const response = await post(request, {
			data: Array.from({ length: 100 }, (_, i) => `x=${i}`).join("&"),
			headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
		});
		expect(response.status()).toBe(201);
		const { id } = await response.json();
		expect(d1(`SELECT data FROM submissions WHERE id = '${id}'`)[0].data).toBe('{"x":"99"}');
	});

	test("a field name over 100 characters is a 400", async ({ request }) => {
		const response = await postJson(request, JSON.stringify({ ["n".repeat(101)]: "v" }));
		await expectRejected(response, 400, "Field names must be at most 100 characters");
	});

	test("a value over 32,000 characters is a 400", async ({ request }) => {
		const response = await post(request, {
			form: { message: "x".repeat(32_001) },
			headers: { Accept: "application/json" },
		});
		await expectRejected(response, 400, "Field values must be at most 32000 characters");
	});

	for (const value of [{ nested: true }, [["deep"]], [{ a: 1 }]]) {
		test(`nested value ${JSON.stringify(value)} is a 400`, async ({ request }) => {
			const response = await postJson(request, JSON.stringify({ field: value }));
			await expectRejected(response, 400, "Field values must be strings, numbers, booleans, null or arrays of those");
		});
	}

	test("100 fields with primitives and arrays of primitives at the limits are accepted", async ({ request }) => {
		const fields: Record<string, unknown> = Object.fromEntries(
			Array.from({ length: 97 }, (_, i) => [`f${i}`, i]),
		);
		fields["n".repeat(100)] = "x".repeat(32_000);
		fields.tags = ["a", 1, true, null];
		fields.empty = null;
		const response = await postJson(request, JSON.stringify(fields));
		expect(response.status()).toBe(201);
	});
});

test.describe("limit boundaries", () => {
	const maxBytes = 256 * 1024;
	const tooLargeError = "Submission is larger than 262144 bytes";
	const valueTooLongError = "Field values must be at most 32000 characters";
	const values = {
		CJK: (length: number) => "文".repeat(length),
		emoji: (length: number) => "😀".repeat(Math.floor(length / 2)) + "a".repeat(length % 2),
		"newline-heavy": (length: number) => "a\n".repeat(Math.floor(length / 2)) + "a".repeat(length % 2),
	};
	const encodings = {
		json: (message: string) => ({ data: { message } }),
		urlencoded: (message: string) => ({ form: { message }, headers: { Accept: "application/json" } }),
		multipart: (message: string) => ({ multipart: { message }, headers: { Accept: "application/json" } }),
	};

	for (const [kind, value] of Object.entries(values)) {
		for (const [encoding, body] of Object.entries(encodings)) {
			if (kind === "CJK" && encoding === "urlencoded") continue;
			test(`${kind} ${encoding}: 32,000 code units are stored, 32,001 are a 400`, async ({ request }) => {
				expect(value(32_000).length).toBe(32_000);
				expect((await post(request, body(value(32_000)))).status()).toBe(201);
				await expectRejected(await post(request, body(value(32_001))), 400, valueTooLongError);
			});
		}
	}

	test("urlencoded CJK fits until the encoded body passes 256 KiB", async ({ request }) => {
		const fits = Math.floor((maxBytes - "message=".length) / encodeURIComponent("文").length);
		const send = (length: number) => post(request, encodings.urlencoded("文".repeat(length)));
		expect((await send(fits)).status()).toBe(201);
		await expectRejected(await send(fits + 1), 413, tooLargeError);
	});

	test("a JSON body of exactly 256 KiB is stored, one byte more is a 413", async ({ request }) => {
		const bodyOfSize = (size: number) => {
			const fields: Record<string, string> = { p: "" };
			for (let i = 0; i < 9; i++) fields[`f${i}`] = "x".repeat(29_000);
			fields.p = "x".repeat(size - JSON.stringify(fields).length);
			return JSON.stringify(fields);
		};
		expect(bodyOfSize(maxBytes).length).toBe(maxBytes);
		expect((await postJson(request, bodyOfSize(maxBytes))).status()).toBe(201);
		await expectRejected(await postJson(request, bodyOfSize(maxBytes + 1)), 413, tooLargeError);
	});
});

test.describe("redirect targets", () => {
	const allowed = ["https://customer.example/thanks?x=1", "http://customer.example", "/thanks", "/success?from=form"];
	const rejected = [
		"javascript:alert(1)",
		"JavaScript:alert(1)",
		"data:text/html,<script>alert(1)</script>",
		"//evil.example/phish",
		"/\\evil.example",
		"ftp://customer.example/file",
		"thanks.html",
		" https://customer.example",
	];

	for (const target of allowed) {
		test(`?redirect=${target} is followed`, async ({ request }) => {
			const response = await post(request, { form: { name: "Ada" } }, `${submissionPath(formId)}?redirect=${encodeURIComponent(target)}`);
			expect(response.status()).toBe(303);
			expect(response.headers()["location"]).toBe(target);
		});
	}

	for (const target of rejected) {
		test(`?redirect=${target} falls back to /success`, async ({ request }) => {
			const response = await post(request, { form: { name: "Ada" } }, `${submissionPath(formId)}?redirect=${encodeURIComponent(target)}`);
			expect(response.status()).toBe(303);
			expect(response.headers()["location"]).toBe("/success");
		});
	}

	test("a javascript: Referer falls back to /success", async ({ request }) => {
		const response = await post(request, { form: { name: "Ada" }, headers: { Referer: "javascript:alert(1)" } });
		expect(response.status()).toBe(303);
		expect(response.headers()["location"]).toBe("/success");
	});
});

test.describe("methods", () => {
	for (const method of ["PUT", "PATCH", "DELETE"]) {
		test(`${method} is a 405 with CORS headers and stores nothing`, async ({ request }) => {
			const before = storedCount();
			const response = await request.fetch(submissionPath(formId), {
				method,
				data: { name: "Ada" },
				headers: originHeaders,
				maxRedirects: 0,
			});
			expect(response.status()).toBe(405);
			expect(response.headers()["access-control-allow-origin"]).toBe("*");
			expect(response.headers()["access-control-allow-methods"]).toBe("POST, OPTIONS");
			expect(await response.json()).toEqual({ error: "Method not allowed" });
			expect(storedCount()).toBe(before);
		});
	}
});
