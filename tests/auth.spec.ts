import { expect, test } from "@playwright/test";
import { createForm, credentials, d1, emptyStorageState, originHeaders } from "./support";

let formId: string;

test.beforeAll(() => {
	formId = createForm("Auth Redirects");
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

	test("direct sign-in is limited per account email with a generic 429", async ({ request }) => {
		const email = `limited-${Date.now()}@example.com`;
		for (let attempt = 1; attempt <= 10; attempt++) {
			const response = await request.post("/api/auth/sign-in/email", {
				headers: { ...originHeaders, "CF-Connecting-IP": `192.0.2.${attempt}` },
				data: { email, password: "not-the-password" },
			});
			expect(response.status(), `attempt ${attempt}`).toBe(401);
		}
		const limited = await request.post("/api/auth/sign-in/email", {
			headers: { ...originHeaders, "CF-Connecting-IP": "192.0.2.11" },
			data: { email, password: "not-the-password" },
		});
		expect(limited.status()).toBe(429);
		expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
		expect(await limited.json()).toEqual({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Please try again later." });
	});

	test("direct sign-in is limited per client IP", async ({ request }) => {
		const headers = { ...originHeaders, "CF-Connecting-IP": "198.51.100.77" };
		for (let attempt = 1; attempt <= 20; attempt++) {
			const response = await request.post("/api/auth/sign-in/email", {
				headers,
				data: { email: `ip-${attempt}-${Date.now()}@example.com`, password: "not-the-password" },
			});
			expect(response.status(), `attempt ${attempt}`).toBe(401);
		}
		const limited = await request.post("/api/auth/sign-in/email", {
			headers,
			data: { email: credentials.email, password: credentials.password },
		});
		expect(limited.status()).toBe(429);
	});

	test("remote login past the limit shows a generic error", async ({ browser }) => {
		const ip = "203.0.113.9";
		const email = `remote-limited-${Date.now()}@example.com`;
		const context = await browser.newContext({ javaScriptEnabled: false, extraHTTPHeaders: { "CF-Connecting-IP": ip } });
		const page = await context.newPage();
		for (let attempt = 1; attempt <= 11; attempt++) {
			await page.goto("/login");
			await page.getByLabel("Email").fill(email);
			await page.getByLabel("Password").fill("not-the-password");
			await page.getByRole("button", { name: "Sign In" }).click();
			const expected = attempt <= 10 ? "Invalid email or password" : "Too many attempts. Please try again later.";
			await expect(page.getByText(expected), `attempt ${attempt}`).toBeVisible();
		}
		await context.close();
	});

	test("the database refuses a second user", () => {
		const now = Date.now();
		expect(() =>
			d1(`INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES ('second', 'Second', 'second@example.com', 0, ${now}, ${now})`),
		).toThrow();
		expect(d1('SELECT COUNT(*) AS count FROM "user"')[0].count).toBe(1);
	});

	test("wrong password shows an error and stays on /login", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Email").fill(credentials.email);
		await page.getByLabel("Password").fill("not-the-password");
		await page.getByRole("button", { name: "Sign In" }).click();

		await expect(page.getByText("Invalid email or password")).toBeVisible();
		await expect(page).toHaveURL(/\/login$/);
	});

	test.describe("without JavaScript", () => {
		test.use({ javaScriptEnabled: false });

		test("login signs in through a plain form post", async ({ page }) => {
			await page.goto("/login");
			await page.getByLabel("Email").fill(credentials.email);
			await page.getByLabel("Password").fill(credentials.password);
			await page.getByRole("button", { name: "Sign In" }).click();
			await expect(page).toHaveURL(/\/forms\/[^/]+\/submissions$/);
		});
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

	test("logout from the user menu on a svelte page", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Email").fill(credentials.email);
		await page.getByLabel("Password").fill(credentials.password);
		await page.getByRole("button", { name: "Sign In" }).click();
		await expect(page).toHaveURL(/\/forms\/[^/]+\/submissions$/);

		await page.goto(page.url().replace(/submissions$/, "integration"));
		await page.getByRole("button", { name: new RegExp(credentials.name) }).click();
		await page.getByRole("menuitem", { name: "Log out" }).click();
		await expect(page).toHaveURL(/\/login$/);

		await page.goto("/forms/anything/integration");
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
		const response = await request.get("/forms/no-such-form/submissions", { maxRedirects: 0 });
		expect(response.status()).toBe(404);
	});
});
