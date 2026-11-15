import { expect, test as setup } from "@playwright/test";
import { credentials, firstForm, storageStatePath } from "./support";

setup("without JavaScript, a password mismatch is described on the confirmation field", async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();

	await page.goto("/signup");
	await page.getByLabel("Name", { exact: true }).fill(credentials.name);
	await page.getByLabel("Email").fill(credentials.email);
	await page.getByLabel("Password", { exact: true }).fill(credentials.password);
	await page.getByLabel("Confirm Password").fill(`${credentials.password}-typo`);
	await page.getByRole("button", { name: "Create Account" }).click();

	const confirmPassword = page.getByLabel("Confirm Password");
	await expect(confirmPassword).toHaveAccessibleDescription("Passwords do not match");
	await expect(confirmPassword).toHaveAttribute("aria-invalid", "true");
	await expect(confirmPassword).toHaveValue("");

	await context.close();
});

setup("first signup creates the account and signs in", async ({ page }) => {
	await page.goto("/login");
	await expect(page).toHaveURL(/\/signup$/);

	await page.getByLabel("Name", { exact: true }).fill(credentials.name);
	await page.getByLabel("Email").fill(credentials.email);
	await page.getByLabel("Password", { exact: true }).fill(credentials.password);
	const confirmPassword = page.getByLabel("Confirm Password");
	await confirmPassword.fill(`${credentials.password}-typo`);
	await page.getByRole("button", { name: "Create Account" }).click();
	await expect(confirmPassword).toHaveAccessibleDescription("Passwords do not match");
	await expect(confirmPassword).toHaveAttribute("aria-invalid", "true");
	await expect(page).toHaveURL(/\/signup$/);

	await confirmPassword.fill(credentials.password);
	await page.getByRole("button", { name: "Create Account" }).click();

	await expect(page).toHaveURL(/\/setup$/);
	await expect(page.getByRole("heading", { name: "Create Your First Form" })).toBeVisible();

	await page.context().storageState({ path: storageStatePath });
});

setup("signed in with no forms, / and /forms lead to /setup", async ({ browser }) => {
	const context = await browser.newContext({ storageState: storageStatePath });
	const page = await context.newPage();

	await page.goto("/");
	await expect(page).toHaveURL(/\/setup$/);

	await page.goto("/forms");
	await expect(page).toHaveURL(/\/setup$/);

	await context.close();
});

setup("create the first form from /setup", async ({ browser }) => {
	const context = await browser.newContext({ storageState: storageStatePath });
	const page = await context.newPage();

	await page.goto("/setup");
	await page.getByLabel("Form Name").fill(firstForm.name);
	await page.getByRole("button", { name: "Create Form" }).click();

	await expect(page).toHaveURL(`/forms/${firstForm.id}/submissions`);
	await expect(page.getByText("No submissions yet")).toBeVisible();

	await context.close();
});
