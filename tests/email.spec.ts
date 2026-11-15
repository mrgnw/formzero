import { createServer, type Server } from "node:net";
import { expect, test } from "@playwright/test";
import { sendTestEmail, smtpTransportOptions, submissionNotification } from "../src/lib/server/email";

const account = { notification_email: "owner@example.com", notification_email_password: "smtp-secret", smtp_host: "127.0.0.1" };

function plaintextSmtpServer(commands: string[]) {
	return createServer((socket) => {
		socket.write("220 plaintext.test ESMTP\r\n");
		socket.on("data", (chunk) => {
			for (const line of chunk.toString().split("\r\n").filter(Boolean)) {
				commands.push(line);
				if (/^EHLO/i.test(line)) socket.write("250-plaintext.test\r\n250 AUTH PLAIN LOGIN\r\n");
				else if (/^QUIT/i.test(line)) socket.end("221 bye\r\n");
				else if (/^AUTH/i.test(line)) socket.write("235 accepted\r\n");
				else socket.write("502 not implemented\r\n");
			}
		});
	});
}

function listen(server: Server) {
	return new Promise<number>((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as { port: number }).port)));
}

test("port 465 uses implicit TLS and other ports require STARTTLS", () => {
	expect(smtpTransportOptions({ ...account, smtp_port: 465 })).toMatchObject({ secure: true, requireTLS: false });
	for (const port of [25, 587, 2525]) {
		expect(smtpTransportOptions({ ...account, smtp_port: port })).toMatchObject({ secure: false, requireTLS: true });
	}
});

test("a server without STARTTLS never receives the credentials", async () => {
	const commands: string[] = [];
	const server = plaintextSmtpServer(commands);
	try {
		const result = await sendTestEmail({ ...account, smtp_port: await listen(server) });
		expect(result.success).toBe(false);
		expect(result.failure).toMatchObject({ code: "ETLS", command: "STARTTLS" });
		expect(commands.some((command) => /^AUTH/i.test(command))).toBe(false);
	} finally {
		server.close();
	}
});

test("markup and control characters in a form name are neutralised in notification mail", () => {
	const formName = '<img src=x onerror="alert(1)"><b>Evil</b>\r\nBcc: victim@example.com\u0007';
	const message = submissionNotification({ id: "sub-1", formId: "evil", formName, data: { name: "Ada" }, createdAt: 0 });
	expect(message.html).not.toContain("<img");
	expect(message.html).not.toContain("<b>Evil");
	expect(message.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&lt;b&gt;Evil&lt;/b&gt;");
	expect(message.subject).toBe('New Submission for "<img src=x onerror="alert(1)"><b>Evil</b>  Bcc: victim@example.com "');
	expect(message.text).not.toMatch(/[\r\u0007]/);
	expect(message.text).toContain("Form: <img src=x onerror=\"alert(1)\"><b>Evil</b>  Bcc: victim@example.com \n");
});
