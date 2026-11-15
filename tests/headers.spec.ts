import { type APIResponse, type Page, expect, test } from "@playwright/test";
import { credentials, firstForm, submissionPath } from "./support";

function expectSecurityHeaders(response: APIResponse) {
	const headers = response.headers();
	expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
	expect(headers["x-frame-options"]).toBe("DENY");
	expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
	expect(headers["x-content-type-options"]).toBe("nosniff");
}

test("pages carry security headers and a nonce-based script policy", async ({ request }) => {
	const response = await request.get("/login");
	expectSecurityHeaders(response);
	const scriptSrc = response.headers()["content-security-policy"].match(/script-src ([^;]*)/)?.[1] ?? "";
	expect(scriptSrc).toContain("'nonce-");
	expect(scriptSrc).not.toContain("unsafe-inline");
});

test("static assets carry security headers", async ({ request }) => {
	expectSecurityHeaders(await request.get("/favicon.svg"));
});

test("the public API and result pages stay frameable for customer sites", async ({ request }) => {
	const response = await request.post(submissionPath(firstForm.id), {
		form: { name: "Framed" },
		headers: { Origin: "https://customer.example", Referer: "https://customer.example/contact" },
		maxRedirects: 0,
	});
	expect(response.status()).toBe(303);
	expect(response.headers().location).toBe("https://customer.example/contact");
	for (const target of [response, await request.get("/success"), await request.get("/error")]) {
		expect(target.headers()["x-frame-options"]).toBeUndefined();
		expect(target.headers()["content-security-policy"] ?? "").not.toContain("frame-ancestors");
	}
});

function watchCspViolations(page: Page) {
	const violations: string[] = [];
	page.on("console", (message) => {
		if (/content security policy/i.test(message.text())) violations.push(message.text());
	});
	return violations;
}

test("dashboard pages load without CSP violations", async ({ page, context }) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	const violations = watchCspViolations(page);

	await page.goto(`/forms/${firstForm.id}/submissions`);
	await expect(page.locator("svg").first()).toBeVisible();

	await page.goto(`/forms/${firstForm.id}/integration`);
	await expect(page.locator(".token").first()).toBeVisible();
	await page.getByRole("button", { name: "Copy Endpoint" }).click();
	await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible();

	await page.getByRole("button", { name: new RegExp(credentials.name) }).click();
	await page.getByRole("menuitem", { name: "Settings" }).click();
	await expect(page.getByRole("dialog", { name: "Settings" }).getByText("Email Notifications", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");

	await page.goto(`/forms/${firstForm.id}/settings`);
	await expect(page.getByRole("button", { name: /rename|save/i }).first()).toBeVisible();

	await page.context().clearCookies();
	await page.goto("/login");
	await expect(page.getByRole("button", { name: /sign in|log in|login/i })).toBeVisible();
	await page.goto("/success");
	await page.goto("/error");

	expect(violations).toEqual([]);
});
