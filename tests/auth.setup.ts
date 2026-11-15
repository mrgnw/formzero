import { expect, test as setup } from "@playwright/test";
import { credentials, storageStatePath } from "./support";

setup("first signup creates the account and signs in", async ({ page }) => {
	await page.goto("/login");
	await expect(page).toHaveURL(/\/signup$/);

	await page.getByLabel("Name", { exact: true }).fill(credentials.name);
	await page.getByLabel("Email").fill(credentials.email);
	await page.getByLabel("Password", { exact: true }).fill(credentials.password);
	await page.getByLabel("Confirm Password").fill(credentials.password);
	await page.getByRole("button", { name: "Create Account" }).click();

	await expect(page).toHaveURL(/\/setup$/);
	await expect(page.getByRole("heading", { name: "Create Your First Form" })).toBeVisible();

	await page.context().storageState({ path: storageStatePath });
});
