import { expect, test as setup } from "@playwright/test";
import { credentials, d1, originHeaders } from "./support";

setup("concurrent first signups create only one user", async ({ request }) => {
	const responses = await Promise.all(
		Array.from({ length: 10 }, (_, racer) =>
			request.post("/api/auth/sign-up/email", {
				headers: { ...originHeaders, "CF-Connecting-IP": `198.51.100.${racer + 1}` },
				data: { name: `Racer ${racer}`, email: `racer-${racer}@example.com`, password: credentials.password },
			}),
		),
	);
	expect(responses.filter((response) => response.ok())).toHaveLength(1);
	expect(d1('SELECT COUNT(*) AS count FROM "user"')[0].count).toBe(1);
	d1('DELETE FROM session; DELETE FROM account; DELETE FROM "user"');
});
