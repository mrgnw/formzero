import { expect, test } from "@playwright/test";
import { authedRequest, createForm, credentials, emptyStorageState, originHeaders } from "./support";

let formId: string;

test.beforeAll(async () => {
	const owner = await authedRequest();
	formId = await createForm(owner, "Auth Redirects");
	await owner.dispose();
});

test.describe("signed out", () => {
	test.use({ storageState: emptyStorageState });

	const guardedPaths = ["/", "/setup", "/forms", "/forms/anything", "/forms/anything/submissions", "/forms/anything/settings"];

	for (const path of guardedPaths) {
		test(`${path} redirects to /login`, async ({ request }) => {
			const response = await request.get(path, { maxRedirects: 0 });
			expect(response.status()).toBe(302);
			expect(response.headers()["location"]).toBe("/login");
		});
	}

	test("/signup redirects to /login once an account exists", async ({ request }) => {
		const response = await request.get("/signup", { maxRedirects: 0 });
		expect(response.status()).toBe(302);
		expect(response.headers()["location"]).toBe("/login");
	});

	test("/login renders the sign-in form", async ({ page }) => {
		const response = await page.goto("/login");
		expect(response?.status()).toBe(200);
		await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
	});

	test("/settings/notifications is not served to a signed-out visitor", async ({ request }) => {
		test.fixme(true, "needs stage 0: loader requires auth");
		const response = await request.get("/settings/notifications", { maxRedirects: 0 });
		expect(response.status()).not.toBe(200);
	});

	test("a second signup is refused with 403", async ({ request }) => {
		const response = await request.post("/api/auth/sign-up/email", {
			headers: originHeaders,
			data: { name: "Intruder", email: "intruder@example.com", password: "correct-horse-battery" },
		});
		expect(response.status()).toBe(403);
		const body = await response.json();
		expect(body.code).toBe("SIGNUP_DISABLED");
		expect(body.message).toBe("An account already exists. Please login instead.");
	});

	test("wrong password shows an error and stays on /login", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Email").fill(credentials.email);
		await page.getByLabel("Password").fill("not-the-password");
		await page.getByRole("button", { name: "Sign In" }).click();

		await expect(page.getByText("Invalid email or password")).toBeVisible();
		await expect(page).toHaveURL(/\/login$/);
	});

	test("sign-out sets every clearing cookie through the catch-all", async ({ request }) => {
		const signIn = await request.post("/api/auth/sign-in/email", {
			data: { email: credentials.email, password: credentials.password },
			headers: originHeaders,
		});
		expect(signIn.status()).toBe(200);

		const signOut = await request.post("/api/auth/sign-out", { data: {}, headers: originHeaders });
		expect(signOut.status()).toBe(200);
		const cookieNames = signOut
			.headersArray()
			.filter(({ name }) => name.toLowerCase() === "set-cookie")
			.map(({ value }) => value.split("=")[0]);
		expect(cookieNames.sort()).toEqual([
			"better-auth.dont_remember",
			"better-auth.session_data",
			"better-auth.session_token",
		]);
	});

	test("login, then logout from the user menu", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Email").fill(credentials.email);
		await page.getByLabel("Password").fill(credentials.password);
		await page.getByRole("button", { name: "Sign In" }).click();
		await expect(page).toHaveURL(/\/forms\/[^/]+\/submissions$/);

		const userMenu = page.getByRole("button", { name: new RegExp(credentials.name) });
		const logOut = page.getByRole("menuitem", { name: "Log out" });
		await expect(async () => {
			if (!(await logOut.isVisible())) await userMenu.click();
			await expect(logOut).toBeVisible({ timeout: 1_000 });
		}).toPass();
		await logOut.click();
		await expect(page).toHaveURL(/\/login$/);

		await page.goto("/forms");
		await expect(page).toHaveURL(/\/login$/);
	});
});

test.describe("signed in", () => {
	test("/, /login and /signup lead into the app", async ({ request }) => {
		for (const path of ["/", "/login", "/signup"]) {
			const response = await request.get(path, { maxRedirects: 0 });
			expect(response.status(), path).toBe(302);
			expect(response.headers()["location"], path).toBe("/forms");
		}
	});

	test("/setup leads to /forms once a form exists", async ({ request }) => {
		const response = await request.get("/setup", { maxRedirects: 0 });
		expect(response.status()).toBe(302);
		expect(response.headers()["location"]).toBe("/forms");
	});

	test("/forms leads to a form's submissions", async ({ page }) => {
		await page.goto("/forms");
		await expect(page).toHaveURL(/\/forms\/[^/]+\/submissions$/);
	});

	test("/forms/<id> leads to its submissions", async ({ request }) => {
		const response = await request.get(`/forms/${formId}`, { maxRedirects: 0 });
		expect(response.status()).toBe(302);
		expect(response.headers()["location"]).toBe(`/forms/${formId}/submissions`);
	});

	test("an unknown form is a 404", async ({ request }) => {
		test.fixme(true, "needs stage 0: unknown form id 404");
		const response = await request.get("/forms/no-such-form/submissions", { maxRedirects: 0 });
		expect(response.status()).toBe(404);
	});
});
