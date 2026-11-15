import { type Page, expect, test } from "@playwright/test";
import { authedRequest, credentials, d1, origin, postSubmission } from "./support";

test.describe.configure({ mode: "serial" });

const firstForm = { name: "Contact Form", id: "contact-form" };
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

test("create the first form from /setup", async ({ page }) => {
	await page.goto("/setup");
	await page.getByLabel("Form Name").fill(firstForm.name);
	await page.getByRole("button", { name: "Create Form" }).click();

	await expect(page).toHaveURL(`/forms/${firstForm.id}/submissions`);
	await expect(page.getByText("No submissions yet")).toBeVisible();
});

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
	await page.getByRole("textbox", { name: "Search submissions..." }).fill("alpha");

	await expect(page.getByText("1 of 3 submission(s)")).toBeVisible();
	await expect(page.getByRole("cell", { name: "alpha@example.com" })).toBeVisible();
	await expect(page.getByRole("cell", { name: "bravo@example.com" })).toHaveCount(0);

	await page.getByRole("textbox", { name: "Search submissions..." }).fill("");
	await expect(page.getByText("3 total submission(s)")).toBeVisible();
});

test("sort by time and by email", async ({ page }) => {
	await page.goto(`/forms/${firstForm.id}/submissions`);
	await expectRowOrder(page, timeNewestFirst);

	await page.getByRole("button", { name: "Time" }).click();
	await expectRowOrder(page, [...timeNewestFirst].reverse());

	await page.getByRole("button", { name: "Email" }).click();
	await expectRowOrder(page, ["alpha@example.com", "bravo@example.com", "charlie@example.com"]);

	await page.getByRole("button", { name: "Email" }).click();
	await expectRowOrder(page, ["charlie@example.com", "bravo@example.com", "alpha@example.com"]);
});

test("CSV export downloads a file with the header row", async ({ page }) => {
	await page.goto(`/forms/${firstForm.id}/submissions`);

	const downloadPromise = page.waitForEvent("download");
	await page.getByRole("button", { name: "Export CSV" }).click();
	const download = await downloadPromise;

	expect(download.suggestedFilename()).toMatch(/^submissions-\d{4}-\d{2}-\d{2}\.csv$/);
	const stream = await download.createReadStream();
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk));
	const lines = Buffer.concat(chunks).toString("utf8").split("\n");

	expect(lines[0]).toBe("ID,Created At,email,message,name");
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

test.describe("notification settings", () => {
	async function openSettings(page: Page) {
		await page.goto(`/forms/${firstForm.id}/submissions`);
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
		await dialog.getByLabel("SMTP Port").fill("1");

		const save = dialog.getByRole("button", { name: "Save Settings" });
		await expect(save).toBeDisabled();

		await dialog.getByRole("button", { name: "Send test email" }).click();
		await expect(dialog.getByText(/cannot connect/i)).toBeVisible();
		await expect(dialog.getByText("Test email sent!")).toHaveCount(0);
		await expect(save).toBeDisabled();
	});

	test("disable notifications clears a seeded row", async ({ page }) => {
		d1(
			"INSERT OR REPLACE INTO settings (id, notification_email, notification_email_password, smtp_host, smtp_port, smtp_secure, updated_at) VALUES ('global', 'seeded@example.org', 'seeded-secret', 'smtp.example.org', 587, 1, 1700000000000)",
		);
		expect(d1("SELECT id FROM settings")).toHaveLength(1);

		const dialog = await openSettings(page);
		await expect(dialog.getByLabel("Your Email")).toHaveValue("seeded@example.org");
		await dialog.getByRole("button", { name: "Disable Notifications" }).click();

		await expect.poll(() => d1("SELECT id FROM settings").length).toBe(0);
		await expect(dialog.getByRole("button", { name: "Disable Notifications" })).toHaveCount(0);
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
