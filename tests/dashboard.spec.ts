import { createServer } from "node:net";
import { type Page, expect, request as playwrightRequest, test } from "@playwright/test";
import { authedRequest, createForm, credentials, d1, emptyStorageState, firstForm, origin, originHeaders, postSubmission, storageStatePath } from "./support";

test.describe.configure({ mode: "serial" });

const secondForm = { name: "Second Form", id: "second-form" };

const submissions = [
	{ email: "charlie@example.com", name: "Charlie", message: "first in" },
	{ email: "alpha@example.com", name: "Alpha", message: "second in" },
	{ email: "bravo@example.com", name: "Bravo", message: "third in" },
];

const timeNewestFirst = ["bravo@example.com", "alpha@example.com", "charlie@example.com"];

async function expectRowOrder(page: Page, emails: string[]) {
	const dataRows = page.getByRole("row").filter({ hasText: "@example.com" });
	await expect(dataRows).toHaveCount(emails.length);
	await expect(dataRows).toContainText(emails);
}

test("create a second form from the switcher", async ({ page }) => {
	await page.goto(`/forms/${firstForm.id}/submissions`);
	await page.getByRole("button", { name: new RegExp(firstForm.name) }).click();
	await page.getByRole("menuitem", { name: "Add form" }).click();

	const dialog = page.getByRole("dialog", { name: "Create New Form" });
	await dialog.getByLabel("Form Name").fill(secondForm.name);
	await dialog.getByRole("button", { name: "Create Form" }).click();

	await expect(page).toHaveURL(`/forms/${secondForm.id}/submissions`);
	await expect(page.getByRole("dialog")).toHaveCount(0);

	await page.getByRole("button", { name: new RegExp(secondForm.name) }).click();
	await expect(page.getByRole("menuitem", { name: firstForm.name })).toBeVisible();
	await expect(page.getByRole("menuitem", { name: secondForm.name })).toBeVisible();
});

test("submissions appear in the table", async ({ page }) => {
	const owner = await authedRequest();
	for (const submission of submissions) {
		await postSubmission(owner, firstForm.id, submission);
	}
	await owner.dispose();

	await page.goto(`/forms/${firstForm.id}/submissions`);
	await expect(page.getByText("3 total submission(s)")).toBeVisible();
	for (const submission of submissions) {
		await expect(page.getByRole("cell", { name: submission.email })).toBeVisible();
		await expect(page.getByRole("cell", { name: submission.message })).toBeVisible();
	}
});

test("search narrows the table", async ({ page }) => {
	await page.goto(`/forms/${firstForm.id}/submissions`);
	await page.getByRole("searchbox", { name: "Search submissions" }).fill("alpha");

	await expect(page.getByText("1 of 3 submission(s)")).toBeVisible();
	await expect(page.getByRole("cell", { name: "alpha@example.com" })).toBeVisible();
	await expect(page.getByRole("cell", { name: "bravo@example.com" })).toHaveCount(0);

	await page.getByRole("searchbox", { name: "Search submissions" }).fill("");
	await expect(page.getByText("3 total submission(s)")).toBeVisible();
});

test("sort by time and by email", async ({ page }) => {
	await page.goto(`/forms/${firstForm.id}/submissions`);
	await expectRowOrder(page, timeNewestFirst);

	await page.getByRole("link", { name: "Time" }).click();
	await expectRowOrder(page, [...timeNewestFirst].reverse());

	await page.getByRole("link", { name: "Email" }).click();
	await expectRowOrder(page, ["alpha@example.com", "bravo@example.com", "charlie@example.com"]);

	await page.getByRole("link", { name: "Email" }).click();
	await expectRowOrder(page, ["charlie@example.com", "bravo@example.com", "alpha@example.com"]);
});

test("CSV export downloads a file with the header row", async ({ page }) => {
	await page.goto(`/forms/${firstForm.id}/submissions`);

	const downloadPromise = page.waitForEvent("download");
	await page.getByRole("link", { name: "Export CSV" }).click();
	const download = await downloadPromise;

	expect(download.suggestedFilename()).toMatch(/^submissions-\d{4}-\d{2}-\d{2}\.csv$/);
	const stream = await download.createReadStream();
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk));
	const lines = Buffer.concat(chunks).toString("utf8").split("\n");

	expect(lines[0]).toBe("ID,Created At,email,message,name");
	expect(lines[1]).toMatch(/^[^,]+,\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z,/);
	expect(lines).toHaveLength(submissions.length + 1);
	for (const submission of submissions) {
		expect(lines.some((line) => line.includes(submission.email))).toBe(true);
	}
});

test("delete a submission", async ({ page }) => {
	await page.goto(`/forms/${firstForm.id}/submissions`);
	const row = page.getByRole("row").filter({ hasText: "alpha@example.com" });
	await row.getByRole("button", { name: "Delete submission" }).click();

	const dialog = page.getByRole("dialog", { name: "Delete submission?" });
	await dialog.getByRole("button", { name: "Delete", exact: true }).click();

	await expect(page.getByText("2 total submission(s)")).toBeVisible();
	await expect(page.getByRole("cell", { name: "alpha@example.com" })).toHaveCount(0);
	await expect(page.getByRole("cell", { name: "bravo@example.com" })).toBeVisible();
});

test("integration page shows the endpoint", async ({ page }) => {
	await page.goto(`/forms/${firstForm.id}/integration`);
	await expect(
		page.getByText(`${origin}/api/forms/${firstForm.id}/submissions`, { exact: true }).first(),
	).toBeVisible();
	await expect(page.getByRole("tab", { name: "HTML" })).toBeVisible();
	await expect(page.getByLabel("Redirect URL (optional)")).toBeVisible();
});

test("copy endpoint puts the URL on the clipboard", async ({ page, context }) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`/forms/${firstForm.id}/integration`);

	await page.getByRole("button", { name: "Copy Endpoint" }).click();
	await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible();

	const clipboard = await page.evaluate(() => navigator.clipboard.readText());
	expect(clipboard).toBe(`${origin}/api/forms/${firstForm.id}/submissions`);
});

test("integration snippets follow the redirect URL and copy per block", async ({ page, context }) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.goto(`/forms/${firstForm.id}/integration`);
	const action = `${origin}/api/forms/${firstForm.id}/submissions?redirect=${encodeURIComponent("https://example.com/thanks?a=<b>")}`;
	await expect(async () => {
		await page.getByLabel("Redirect URL (optional)").fill("https://example.com/thanks?a=<b>");
		await expect(page.getByRole("tabpanel").getByText(`"${action}"`)).toBeVisible({ timeout: 1_000 });
	}).toPass();

	await page.getByRole("button", { name: "Copy HTML form" }).click();
	await expect(page.getByRole("button", { name: "Copied!" })).toHaveCount(1);
	const clipboard = await page.evaluate(() => navigator.clipboard.readText());
	expect(clipboard).toContain(`<form action="${action}" method="POST">`);

	await page.getByRole("tab", { name: "SvelteKit" }).click();
	await expect(page.getByRole("button", { name: "Copy remote function" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Copy component" })).toBeVisible();
});

test("sidebar links cross between the react and svelte pages", async ({ page }) => {
	await page.goto(`/forms/${firstForm.id}/submissions`);
	await page.getByRole("link", { name: "Integration" }).click();
	await expect(page).toHaveURL(`/forms/${firstForm.id}/integration`);
	await expect(page.getByText("Integration Examples")).toBeVisible();

	await page.getByRole("link", { name: "Submissions" }).click();
	await expect(page).toHaveURL(`/forms/${firstForm.id}/submissions`);
	await expect(page.getByText("2 total submission(s)")).toBeVisible();
});

test("collapsing the sidebar is remembered across reloads", async ({ page }) => {
	await page.goto(`/forms/${firstForm.id}/integration`);
	const nav = page.getByRole("link", { name: "Settings" });
	await expect(nav).toBeVisible();

	const toggle = page.getByRole("main").getByRole("button", { name: "Toggle Sidebar" });
	await expect(async () => {
		await toggle.click();
		await expect(nav).not.toBeInViewport({ timeout: 1_000 });
	}).toPass();
	await page.reload();
	await expect(nav).not.toBeInViewport();

	await expect(async () => {
		await toggle.click();
		await expect(nav).toBeInViewport({ timeout: 1_000 });
	}).toPass();
});

test("the switcher on a svelte page creates a form", async ({ page }) => {
	await page.goto(`/forms/${firstForm.id}/integration`);
	await page.getByRole("button", { name: new RegExp(firstForm.name) }).click();
	await page.getByRole("menuitem", { name: "Add form" }).click();

	const dialog = page.getByRole("dialog", { name: "Create New Form" });
	await dialog.getByLabel("Form Name").fill(secondForm.name);
	await dialog.getByRole("button", { name: "Create Form" }).click();
	await expect(dialog.getByText("A form with this name already exists")).toBeVisible();

	await dialog.getByLabel("Form Name").fill("Third Form");
	await dialog.getByRole("button", { name: "Create Form" }).click();
	await expect(page).toHaveURL("/forms/third-form/submissions");
	await expect(page.getByText("No submissions yet")).toBeVisible();
});

test("form names are limited to 100 characters and duplicate creations never 500", async ({ page }) => {
	await page.goto(`/forms/${firstForm.id}/integration`);
	await page.getByRole("button", { name: new RegExp(firstForm.name) }).click();
	await page.getByRole("menuitem", { name: "Add form" }).click();
	const dialog = page.getByRole("dialog", { name: "Create New Form" });
	await dialog.getByLabel("Form Name").fill("x".repeat(101));
	await dialog.getByRole("button", { name: "Create Form" }).click();
	await expect(dialog.getByText("Form name must be 100 characters or fewer")).toBeVisible();

	const action = await dialog.locator("form").getAttribute("action");
	const field = (await dialog.getByLabel("Form Name").getAttribute("name")) ?? "";
	const owner = await authedRequest();
	const longName = await owner.post(`/forms/${firstForm.id}/integration${action}`, {
		form: { [field]: "y".repeat(101) },
		headers: { Accept: "text/html" },
		maxRedirects: 0,
	});
	expect(longName.status()).toBeLessThan(500);
	expect(d1("SELECT id FROM forms WHERE length(name) > 100")).toHaveLength(0);

	const racers = await Promise.all(
		Array.from({ length: 6 }, () =>
			owner.post(`/forms/${firstForm.id}/integration${action}`, {
				form: { [field]: "Race Form" },
				headers: { Accept: "text/html" },
				maxRedirects: 0,
			}),
		),
	);
	await owner.dispose();
	expect(racers.map((response) => response.status()).filter((status) => status >= 500)).toEqual([]);
	expect(d1("SELECT id FROM forms WHERE id = 'race-form'")).toHaveLength(1);
});

test.describe("notification settings", () => {
	const seededPassword = "seeded-secret";
	const connectError = "Could not connect to the SMTP server. Check the host and port.";

	function seedSettings(host: string, port: number) {
		d1(
			`INSERT OR REPLACE INTO settings (id, notification_email, notification_email_password, smtp_host, smtp_port, smtp_secure, updated_at) VALUES ('global', 'seeded@example.org', '${seededPassword}', '${host}', ${port}, 1, 1700000000000)`,
		);
		expect(d1("SELECT id FROM settings")).toHaveLength(1);
	}

	async function openSettings(page: Page) {
		await page.goto(`/forms/${firstForm.id}/integration`);
		await page.getByRole("button", { name: new RegExp(credentials.name) }).click();
		await page.getByRole("menuitem", { name: "Settings" }).click();
		const dialog = page.getByRole("dialog", { name: "Settings" });
		await expect(dialog.getByText("Email Notifications", { exact: true })).toBeVisible();
		return dialog;
	}

	test("save stays disabled until a test passes; an unreachable host shows an error", async ({ page }) => {
		const dialog = await openSettings(page);
		await dialog.getByLabel("Your Email").fill("owner@unreachable.invalid");
		await dialog.getByLabel("SMTP Password").fill("irrelevant");
		await dialog.getByLabel("SMTP Host").fill("127.0.0.1");
		await dialog.getByLabel("SMTP Port").fill("2525");

		const save = dialog.getByRole("button", { name: "Save Settings" });
		await expect(save).toBeDisabled();
		await expect(dialog.getByText("Send a test email first to verify your settings")).toBeVisible();

		await dialog.getByRole("button", { name: "Send test email" }).click();
		await expect(dialog.getByText(connectError)).toBeVisible();
		await expect(dialog.getByText("Test email sent!")).toHaveCount(0);
		await expect(save).toBeDisabled();
	});

	test("a failed test email shows a classified message, never the raw smtp error", async ({ page }) => {
		const typedPassword = "typed-secret-4821";
		const bodies: string[] = [];
		page.on("response", async (response) => {
			if (response.url().includes("/_app/remote/")) bodies.push(await response.text().catch(() => ""));
		});

		const dialog = await openSettings(page);
		await dialog.getByLabel("Your Email").fill("owner@unreachable.invalid");
		await dialog.getByLabel("SMTP Password").fill(typedPassword);
		await dialog.getByLabel("SMTP Host").fill("127.0.0.1");
		await dialog.getByLabel("SMTP Port").fill("2525");
		await dialog.getByRole("button", { name: "Send test email" }).click();

		await expect(dialog.getByText(connectError)).toBeVisible();
		const failed = bodies.find((body) => body.includes(connectError));
		expect(failed).toBeDefined();
		expect(failed).not.toContain(typedPassword);
		expect(failed).not.toContain("ECONNREFUSED");
		expect(failed).not.toContain("127.0.0.1:2525");
	});

	test("the stored password never reaches the browser", async ({ page }) => {
		seedSettings("127.0.0.1", 2525);
		const bodies: string[] = [];
		page.on("response", async (response) => {
			bodies.push(await response.text().catch(() => ""));
		});

		const dialog = await openSettings(page);
		const password = dialog.getByLabel("SMTP Password");
		await expect(dialog.getByLabel("Your Email")).toHaveValue("seeded@example.org");
		await expect(password).toHaveValue("");
		await expect(password).toHaveAttribute("placeholder", "Leave blank to keep the saved password");

		await dialog.getByRole("button", { name: "Send test email" }).click();
		await expect(dialog.getByText(connectError)).toBeVisible();
		expect(bodies.some((body) => body.includes(seededPassword))).toBe(false);
	});

	test("a blank password is refused when the host or port changes", async ({ page }) => {
		seedSettings("127.0.0.1", 2525);
		const dialog = await openSettings(page);
		await dialog.getByLabel("SMTP Port").fill("587");

		const sendTest = dialog.getByRole("button", { name: "Send test email" });
		await expect(sendTest).toBeDisabled();
		await expect(dialog.getByLabel("SMTP Password")).toHaveAttribute("placeholder", "Enter your SMTP password");

		await sendTest.evaluate((button: HTMLButtonElement) => (button.disabled = false));
		await dialog.getByLabel("SMTP Password").evaluate((input: HTMLInputElement) => (input.required = false));
		await sendTest.click();
		await expect(dialog.getByText("SMTP password is required")).toBeVisible();
		await expect(dialog.getByText(connectError)).toHaveCount(0);
	});

	test("settings remote calls are refused cross-origin and when signed out", async ({ page }) => {
		seedSettings("127.0.0.1", 2525);
		const queryUrl = page.waitForRequest((request) => request.url().includes("/_app/remote/"));
		const dialog = await openSettings(page);
		const remoteQuery = (await queryUrl).url();
		const action = await dialog.locator("form").first().getAttribute("action");
		expect(action).toContain("?/remote=");

		const owner = await playwrightRequest.newContext({ baseURL: origin, storageState: storageStatePath });
		const fields = { intent: "save", notification_email: "evil@example.org", _password: "x", smtp_host: "evil.example", "n:smtp_port": "25" };
		const pagePost = await owner.post(`/forms/${firstForm.id}/integration${action}`, {
			form: fields,
			headers: { Origin: "https://attacker.example", Accept: "text/html" },
			maxRedirects: 0,
		});
		expect(pagePost.status()).toBe(403);
		const remotePost = await owner.post(new URL(remoteQuery).pathname, {
			data: {},
			headers: { Origin: "https://attacker.example" },
			maxRedirects: 0,
		});
		expect(remotePost.status()).toBe(403);
		await owner.dispose();

		const stranger = await playwrightRequest.newContext({ baseURL: origin, storageState: emptyStorageState });
		const signedOutQuery = await stranger.get(remoteQuery, { maxRedirects: 0 });
		const signedOutBody = await signedOutQuery.text();
		expect(signedOutBody).not.toContain("seeded@example.org");
		expect(signedOutBody).toContain("/login");
		const signedOutPost = await stranger.post(`/forms/${firstForm.id}/integration${action}`, {
			form: fields,
			headers: { ...originHeaders, Accept: "text/html" },
			maxRedirects: 0,
		});
		expect(signedOutPost.status()).toBe(302);
		expect(signedOutPost.headers()["location"]).toBe("/login");
		await stranger.dispose();

		expect(d1("SELECT notification_email FROM settings")).toEqual([{ notification_email: "seeded@example.org" }]);
	});

	test("ports outside the SMTP allowlist are refused in the browser and on the server", async ({ page }) => {
		const dialog = await openSettings(page);
		await dialog.getByLabel("Your Email").fill("owner@unreachable.invalid");
		await dialog.getByLabel("SMTP Password").fill("irrelevant");
		await dialog.getByLabel("SMTP Host").fill("127.0.0.1");
		await dialog.getByLabel("SMTP Port").fill("22");
		await dialog.getByRole("button", { name: "Send test email" }).click();
		await expect(dialog.getByText("Use SMTP port 465, 587 or 2525")).toBeVisible();
		await expect(dialog.getByText(connectError)).toHaveCount(0);

		d1("DELETE FROM settings");
		const form = dialog.locator("form").first();
		const action = await form.getAttribute("action");
		const values: Record<string, string> = { intent: "save", notification_email: "owner@example.org", _password: "x", smtp_host: "127.0.0.1", "n:smtp_port": "22" };
		const names = await form.locator("[name]").evaluateAll((elements) => elements.map((element) => element.getAttribute("name") ?? ""));
		const fields = Object.fromEntries(
			names.flatMap((name) => {
				const value = values[name.split("/")[0]];
				return value === undefined ? [] : [[name, value]];
			}),
		);
		expect(Object.keys(fields)).toHaveLength(5);
		const owner = await authedRequest();
		const response = await owner.post(`/forms/${firstForm.id}/integration${action}`, {
			form: fields,
			headers: { Accept: "text/html" },
			maxRedirects: 0,
		});
		expect(response.status()).toBeLessThan(500);
		await owner.dispose();
		expect(d1("SELECT id FROM settings")).toHaveLength(0);
	});

	test("the TLS note shows only for saved settings and a server without STARTTLS gets the TLS required message", async ({ page }) => {
		const note = 'Email now requires TLS (STARTTLS, or implicit TLS on port 465). Use "Send test email" to confirm your saved settings still work.';
		d1("DELETE FROM settings");
		let dialog = await openSettings(page);
		await expect(dialog.getByText(note)).toHaveCount(0);

		const server = createServer((socket) => {
			socket.write("220 plaintext.test ESMTP\r\n");
			socket.on("data", (chunk) => {
				for (const line of chunk.toString().split("\r\n").filter(Boolean)) {
					if (/^EHLO/i.test(line)) socket.write("250-plaintext.test\r\n250 AUTH PLAIN\r\n");
					else socket.write("502 not implemented\r\n");
				}
			});
		});
		await new Promise<void>((resolve) => server.listen(2525, "127.0.0.1", resolve));
		try {
			seedSettings("127.0.0.1", 2525);
			dialog = await openSettings(page);
			await expect(dialog.getByText(note)).toBeVisible();
			await dialog.getByRole("button", { name: "Send test email" }).click();
			await expect(dialog.getByText(/^TLS required:/)).toBeVisible();
		} finally {
			server.close();
		}
	});

	test("a saved row with a port outside the allowlist never connects when a submission arrives", async ({ request }) => {
		let connections = 0;
		const server = createServer((socket) => {
			connections++;
			socket.destroy();
		});
		const port = await new Promise<number>((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as { port: number }).port)));
		try {
			seedSettings("127.0.0.1", port);
			await postSubmission(request, firstForm.id, { email: "probe@example.com" });
			await new Promise((resolve) => setTimeout(resolve, 1000));
		} finally {
			server.close();
			d1("DELETE FROM settings");
		}
		expect(connections).toBe(0);
	});

	test("disable notifications clears a seeded row", async ({ page }) => {
		seedSettings("smtp.example.org", 587);

		const dialog = await openSettings(page);
		await expect(dialog.getByLabel("Your Email")).toHaveValue("seeded@example.org");
		await dialog.getByRole("button", { name: "Disable Notifications" }).click();

		await expect.poll(() => d1("SELECT id FROM settings").length).toBe(0);
		await expect(dialog.getByRole("button", { name: "Disable Notifications" })).toHaveCount(0);
		await expect(dialog.getByLabel("Your Email")).toHaveValue("");
	});
});

test("rename a form", async ({ page }) => {
	await page.goto(`/forms/${firstForm.id}/settings`);
	const save = page.getByRole("button", { name: "Save", exact: true });
	await expect(save).toBeDisabled();

	await page.getByLabel("Name", { exact: true }).fill("Contact Us");
	await expect(save).toBeEnabled();
	await save.click();
	await expect(page.getByText("Saved!")).toBeVisible();

	await page.reload();
	await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Contact Us");
	await expect(page).toHaveURL(`/forms/${firstForm.id}/settings`);
});

test("renaming to a name with no letters or numbers is rejected", async ({ page }) => {
	await page.goto(`/forms/${firstForm.id}/settings`);
	const name = page.getByLabel("Name", { exact: true });
	const before = await name.inputValue();

	await name.fill("!!!");
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(page.getByText("Form name must contain a letter or number")).toBeVisible();

	await page.reload();
	await expect(name).toHaveValue(before);
});

test("delete a form with type-to-confirm", async ({ page }) => {
	await page.goto(`/forms/${secondForm.id}/settings`);
	await page.getByRole("button", { name: "Delete Form" }).click();

	const dialog = page.getByRole("dialog");
	const confirm = dialog.getByRole("button", { name: "Delete Form" });
	await expect(confirm).toBeDisabled();

	await dialog.getByLabel("Form name").fill("Second");
	await expect(confirm).toBeDisabled();

	await dialog.getByLabel("Form name").fill(secondForm.name);
	await expect(confirm).toBeEnabled();
	await confirm.click();

	await expect(page).toHaveURL(/\/forms\/contact-form\/submissions$/);
	await page.getByRole("button", { name: /Contact Us/ }).click();
	await expect(page.getByRole("menuitem", { name: secondForm.name })).toHaveCount(0);
});

test("stored rows that are not JSON objects never break the page or the CSV", async ({ page }) => {
	const formId = createForm("Invalid Rows");
	const rows = ["null", "[1,2]", "5", '"text"', "not json", '{"email":"valid@example.com"}'];
	d1(
		`INSERT INTO submissions (id, form_id, data, created_at) VALUES ${rows
			.map((data, index) => `('bad-${index}', '${formId}', '${data}', ${1700000000000 + index})`)
			.join(", ")}`,
	);

	const response = await page.goto(`/forms/${formId}/submissions`);
	expect(response?.status()).toBe(200);
	await expect(page.getByText(`${rows.length} total submission(s)`)).toBeVisible();
	await expect(page.getByRole("cell", { name: "valid@example.com" })).toBeVisible();

	const owner = await authedRequest();
	const csv = await owner.get(`/forms/${formId}/submissions.csv`);
	expect(csv.status()).toBe(200);
	const lines = (await csv.text()).split("\n");
	expect(lines[0]).toBe("ID,Created At,email");
	expect(lines.slice(1)).toEqual(
		rows.map((_, index) => `bad-${index},${new Date(1700000000000 + index).toISOString()},${index === 5 ? "valid@example.com" : ""}`).reverse(),
	);
	await owner.dispose();
});

function seedSubmissions(formId: string, count: number) {
	const start = Date.now() - count * 60_000;
	const values = Array.from({ length: count }, (_, index) => {
		const n = String(index).padStart(3, "0");
		return `('${formId}-${n}', '${formId}', '{"email":"user${n}@example.com","name":"User ${n}"}', ${start + index * 60_000})`;
	});
	d1(`INSERT INTO submissions (id, form_id, data, created_at) VALUES ${values.join(", ")}`);
}

const dataRows = (page: Page) => page.getByRole("row").filter({ hasText: "@example.com" });

test("the table pages 50 rows at a time with search and sort in the URL", async ({ page }) => {
	const formId = createForm("Paged Form");
	seedSubmissions(formId, 120);

	await page.goto(`/forms/${formId}/submissions`);
	await expect(page.getByText("120 total submission(s)")).toBeVisible();
	await expect(page.getByText("Page 1 of 3")).toBeVisible();
	await expect(dataRows(page)).toHaveCount(50);
	await expect(dataRows(page).first()).toContainText("user119@example.com");
	await expect(page.getByRole("columnheader", { name: "Time" })).toHaveAttribute("aria-sort", "descending");
	await expect(page.getByRole("columnheader", { name: "Email" })).not.toHaveAttribute("aria-sort");

	await page.getByRole("link", { name: "Next" }).click();
	await expect(page).toHaveURL(`/forms/${formId}/submissions?page=2`);
	await expect(dataRows(page).first()).toContainText("user069@example.com");
	await page.getByRole("link", { name: "Next" }).click();
	await expect(page.getByText("Page 3 of 3")).toBeVisible();
	await expect(dataRows(page)).toHaveCount(20);
	await expect(page.getByRole("link", { name: "Next" })).not.toHaveAttribute("href");

	await page.getByRole("link", { name: "Email" }).click();
	await expect(page).toHaveURL(`/forms/${formId}/submissions?sort=email`);
	await expect(page.getByRole("columnheader", { name: "Email" })).toHaveAttribute("aria-sort", "ascending");
	await expect(page.getByRole("columnheader", { name: "Time" })).not.toHaveAttribute("aria-sort");
	await expect(dataRows(page).first()).toContainText("user000@example.com");

	await page.getByRole("searchbox", { name: "Search submissions" }).fill("user11");
	await expect(page.getByText("10 of 120 submission(s)")).toBeVisible();
	await expect(page).toHaveURL(`/forms/${formId}/submissions?q=user11&sort=email`);
	await expect(page.getByRole("searchbox", { name: "Search submissions" })).toBeFocused();
	await expect(dataRows(page).first()).toContainText("user110@example.com");
	await expect(page.getByText("Page 1 of")).toHaveCount(0);

	await page.goto(`/forms/${formId}/submissions?page=99`);
	await expect(page).toHaveURL(`/forms/${formId}/submissions?page=3`);
});

test.describe("without JavaScript", () => {
	test.use({ javaScriptEnabled: false });

	test("paging, sorting and searching work as plain links and a GET form", async ({ page }) => {
		const formId = "paged-form";
		await page.goto(`/forms/${formId}/submissions`);
		await page.getByRole("link", { name: "Next" }).click();
		await expect(page).toHaveURL(`/forms/${formId}/submissions?page=2`);
		await expect(page.getByText("Page 2 of 3")).toBeVisible();

		await page.getByRole("link", { name: "Time" }).click();
		await expect(page).toHaveURL(`/forms/${formId}/submissions?sort=time`);
		await expect(dataRows(page).first()).toContainText("user000@example.com");

		await page.getByRole("searchbox", { name: "Search submissions" }).fill("user042");
		await page.getByRole("searchbox", { name: "Search submissions" }).press("Enter");
		await expect(page).toHaveURL(`/forms/${formId}/submissions?q=user042&sort=time`);
		await expect(page.getByText("1 of 120 submission(s)")).toBeVisible();
	});
});

test("deleting the only row on the last page lands on the new last page", async ({ page }) => {
	const formId = createForm("Delete Paged");
	seedSubmissions(formId, 101);

	await page.goto(`/forms/${formId}/submissions?page=3`);
	await expect(dataRows(page)).toHaveCount(1);
	await dataRows(page).getByRole("button", { name: "Delete submission" }).click();
	await page.getByRole("dialog", { name: "Delete submission?" }).getByRole("button", { name: "Delete", exact: true }).click();

	await expect(page).toHaveURL(`/forms/${formId}/submissions?page=2`);
	await expect(page.getByText("100 total submission(s)")).toBeVisible();
	await expect(page.getByText("Page 2 of 2")).toBeVisible();
	await expect(dataRows(page)).toHaveCount(50);
});

test("invalid stored rows can be searched and sorted by email", async ({ page }) => {
	const response = await page.goto("/forms/invalid-rows/submissions?sort=-email&q=valid");
	expect(response?.status()).toBe(200);
	await expect(page.getByRole("cell", { name: "valid@example.com" })).toBeVisible();
	expect((await page.goto("/forms/invalid-rows/submissions?sort=email"))?.status()).toBe(200);
	await expect(page.getByText("6 total submission(s)")).toBeVisible();
});

test("CSV export streams in batches and stops at 100,000 rows", async ({ browser }) => {
	const formId = createForm("CSV Cap");
	d1(
		`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 100001)
		INSERT INTO submissions (id, form_id, data, created_at) SELECT printf('cap-%06d', i), '${formId}', '{"n":' || i || '}', i FROM n`,
	);
	const owner = await authedRequest();
	const response = await owner.get(`/forms/${formId}/submissions.csv`, { timeout: 120_000 });
	expect(response.status()).toBe(200);
	expect(response.headers()["x-export-truncated"]).toBe("true");
	const lines = (await response.text()).split("\n");
	await owner.dispose();

	expect(lines).toHaveLength(100_001);
	expect(lines[0]).toBe("ID,Created At,n");
	expect(lines[1]).toBe(`cap-100001,${new Date(100001).toISOString()},100001`);
	expect(lines[1000]).toBe(`cap-099002,${new Date(99002).toISOString()},99002`);
	expect(lines[1001]).toBe(`cap-099001,${new Date(99001).toISOString()},99001`);
	expect(lines.at(-1)).toBe(`cap-000002,${new Date(2).toISOString()},2`);

	const page = await browser.newPage({ storageState: storageStatePath });
	await page.goto(`/forms/${formId}/submissions`);
	await expect(page.getByText("Showing the newest 100,000 of 100,001")).toBeVisible();
	await page.close();

	const small = await authedRequest();
	const normal = await small.get(`/forms/${firstForm.id}/submissions.csv`);
	expect(normal.headers()["x-export-truncated"]).toBeUndefined();
	await small.dispose();
});

test("stored values that cannot be turned into text with String() still render and export", async ({ page }) => {
	const formId = createForm("Hostile Values");
	const deep = `${"[".repeat(20_000)}${"]".repeat(20_000)}`;
	const rows = [
		'{"email":"a@example.com","field":{"toString":null}}',
		'{"email":"b@example.com","field":{"valueOf":1}}',
		'{"toString":null,"valueOf":1}',
		`{"email":"c@example.com","field":${deep}}`,
		'{"email":"d@example.com","field":1e400,"other":123456789012345678901234567890}',
		'{"email":"e@example.com","field":[1,{"x":null}],"other":true}',
	];
	d1(
		`INSERT INTO submissions (id, form_id, data, created_at) VALUES ${rows
			.map((data, index) => `('hostile-${index}', '${formId}', '${data}', ${1700000000000 + index})`)
			.join(", ")}`,
	);

	const response = await page.goto(`/forms/${formId}/submissions`);
	expect(response?.status()).toBe(200);
	await expect(page.getByText(`${rows.length} total submission(s)`)).toBeVisible();
	await expect(page.getByRole("cell", { name: '{"toString":null}' })).toBeVisible();
	await expect(page.getByRole("cell", { name: '{"valueOf":1}' })).toBeVisible();
	await expect(page.getByRole("cell", { name: "Infinity" })).toBeVisible();
	await expect(page.getByRole("cell", { name: '[1,{"x":null}]' })).toBeVisible();
	expect((await page.goto(`/forms/${formId}/submissions?sort=email`))?.status()).toBe(200);

	const owner = await authedRequest();
	const csv = await owner.get(`/forms/${formId}/submissions.csv`);
	expect(csv.status()).toBe(200);
	const body = await csv.text();
	await owner.dispose();
	expect(body.split("\n")).toHaveLength(rows.length + 1);
	expect(body).toContain('hostile-0,2023-11-14T22:13:20.000Z,a@example.com,"{""toString"":null}"');
	expect(body).toContain('hostile-4,2023-11-14T22:13:20.004Z,d@example.com,Infinity,1.2345678901234568e+29');
});

test("unknown sort names, huge pages and long searches are bounded", async ({ page }) => {
	const base = "/forms/paged-form/submissions";
	for (const sort of ["toString", "__proto__", "constructor", "hasOwnProperty"]) {
		const response = await page.goto(`${base}?sort=${sort}`);
		expect(response?.status()).toBe(200);
		await expect(page.getByRole("columnheader", { name: "Time" })).toHaveAttribute("aria-sort", "descending");
	}

	await page.goto(`${base}?page=999999999&sort=email`);
	await expect(page).toHaveURL(`${base}?page=3&sort=email`);
	await expect(page.getByText("Page 3 of 3")).toBeVisible();

	const long = `user1${"x".repeat(5_000)}`;
	const response = await page.goto(`${base}?q=${long}`);
	expect(response?.status()).toBe(200);
	await expect(page.getByText("0 of 120 submission(s)")).toBeVisible();
	await expect(page.getByRole("searchbox", { name: "Search submissions" })).toHaveValue(long.slice(0, 200));

	await page.goto(`${base}?q=${encodeURIComponent("%_ USER042@EXAMPLE.COM")}`);
	await expect(page.getByText("0 of 120 submission(s)")).toBeVisible();
	await page.goto(`${base}?q=${encodeURIComponent("USER042@EXAMPLE.COM")}`);
	await expect(page.getByText("1 of 120 submission(s)")).toBeVisible();
});
