# Stage 9 security audit

Audited `cf0f1b3` on 2026-11-15. Scope: routes, remote functions, server helpers, authentication configuration and migrations. This review combines source inspection, local probes and read-only production header requests. No production writes or deployment were made. P1 denotes exploitable compromise or data exposure; P2 should be fixed; P3 is hardening or a lower-impact limitation. Unobserved Cloudflare account rules may add controls.

## Findings

### P1 — A public submission can disable the dashboard and export

`src/lib/server/submissions.ts:75` accepts JSON `null` and stores it at line 78. `src/lib/components/SubmissionsTable.svelte:35` and `src/lib/server/dashboard.ts:82` call `Object.keys` on the stored value. Anyone who knows a form ID can submit `null`; the owner's submissions page and CSV export then return 500, preventing deletion through the dashboard. Locally, POSTing `null` returned 201, followed by 500 from both authenticated routes. Reject anything other than a plain JSON object before insertion and handle previously stored invalid rows safely.

### P1 — Remote login bypasses Better Auth's request limiter

`src/lib/auth.remote.ts:13` calls `getAuth().api.signInEmail` directly. The installed Better Auth limiter runs in its HTTP router's `onRequest`, not these direct API calls (`node_modules/better-auth/dist/api/index.mjs:154` and `:175`). A remote-form caller can repeatedly guess the owner's password without that limiter. The same applies to signup at `auth.remote.ts:23`. The direct `/api/auth` router's default in-memory limiter is per Worker instance, not global. Apply a durable per-IP and per-account limit before both remote and direct authentication entry points; use generic responses and monitor distributed attempts.

### P1 — First-account check is not atomic

`src/lib/server/auth.ts:23` checks `COUNT(*)` before Better Auth inserts a user. Two concurrent first registrations with different emails can both observe zero and create separate owners; the unique email constraint in `migrations/0002_create_better_auth_tables.sql:1` does not enforce a single user. Every authenticated user can access all forms and settings. The race requires a fresh or emptied database and is inferred, not reproduced. Enforce the single-owner invariant atomically in the database, for example with a singleton constraint or trigger, and test concurrent registration. A fresh public deployment is also claimable by the first visitor; complete setup before exposing it.

### P2 — Unlimited public submissions can exhaust resources and trigger email floods

`src/lib/server/submissions.ts:58` reads the entire JSON or multipart body at line 75 and inserts it without an application byte limit, field count, key length, nesting limit, per-form quota, spam check or rate limit. Each accepted request also schedules an email at line 82. An attacker can fill D1, consume Worker resources, or flood the recipient and SMTP account. Platform limits do not replace per-form controls. Bound bytes while reading, cap fields, names and value sizes, reject files or handle them explicitly, and apply durable rate limits and abuse controls before storage and notification.

### P2 — Unbounded dashboard and CSV reads amplify public spam

`src/lib/server/dashboard.ts:22` selects and parses every submission; `src/routes/forms/[formId]/submissions/+page.server.ts:8` serializes all of them and calculates statistics by repeated scans. CSV does the same at `src/routes/forms/[formId]/submissions.csv/+server.ts:10`. A large public submission history can exceed D1, Worker or browser memory/time limits and make the form unmanageable. Paginate the table, aggregate statistics in SQL and stream or bound exports. This remains necessary alongside intake limits.

### P2 — SMTP may authenticate without transport encryption

`src/lib/server/email.ts:12` and `:120` configure neither `secure` nor `requireTLS`; the `smtp_secure` value written at `src/lib/server/settings.ts:38` is not read. Nodemailer uses opportunistic STARTTLS on non-465 ports, so a server or network attacker that suppresses STARTTLS can receive SMTP credentials over plaintext. Require TLS for both transports, use implicit TLS where appropriate, and fail closed when STARTTLS is unavailable. Verify provider compatibility.

### P2 — Owner-controlled SMTP destination permits network probing

`src/lib/smtp.ts:67` accepts any nonempty host and ports 1–65535; `src/lib/settings.remote.ts:40` connects during a test. An authenticated owner can probe reachable hosts and ports using the classified error and timing; DNS rebinding and network restrictions determine the reachable set on Cloudflare. External hosts were not tested. Restrict destinations to approved SMTP providers or validate resolved public addresses and port policy at connection time, including DNS rebinding; apply timeouts and rate limits. Password reuse is restricted to the exact saved email, host and port (`src/lib/smtp.ts:45`), but a changed DNS answer for that host remains a trust boundary.

### P2 — HTML in an owner-supplied form name reaches notification mail

`src/lib/server/email.ts:183` and `:194` interpolate the form name directly into HTML. A name containing markup changes the email body when a public submission arrives. Creating or renaming the form requires authentication, so this is not an unauthenticated submission-field injection. Escape the form name in both HTML locations and constrain control characters in names. Submitted field names and values are escaped at `email.ts:273` and `:314`; URLs are limited to HTTP(S) or mailto. Nodemailer constructs the subject; no submission field is used as a header or recipient.

### P2 — Redirect target is attacker-controlled

`src/lib/server/submissions.ts:22` chooses the `redirect` parameter or Referer without validation, then returns it as `Location` at line 87. An attacker can build a form submission link on the trusted application domain that sends a visitor to a phishing site. Cross-site customer redirects are intentional in the existing integration contract. Store an owner-configured allowlist of HTTPS return origins and validate both sources against it, falling back to `/success`.

### P2 — Missing browser security headers

`src/hooks.server.ts:15`, `vite.config.ts:8` and `wrangler.jsonc:9` do not configure Content Security Policy (CSP), `frame-ancestors` or `X-Frame-Options`, `Referrer-Policy`, or `X-Content-Type-Options`. Read-only HEAD requests to production `/login` and `/favicon.svg` confirmed all were absent on those responses. A hostile page can frame authenticated UI, and missing CSP removes a layer of protection against injection. Set an appropriate CSP including `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Content-Type-Options: nosniff` on dynamic responses and static assets; verify integration compatibility.

### P2 — Malformed JSON and invalid stored shapes become server errors

`src/lib/server/submissions.ts:75` lets parse failures fall into the generic 500 at line 88. JSON arrays and scalars are accepted despite consumers expecting a record; multipart files become empty objects when serialized. Invalid input can produce misleading 500s or broken processing. Parse media types exactly, reject malformed JSON with 400 and unsupported shapes/files with 400 or 415, and enforce explicit input schemas. Unknown form IDs are checked before body parsing and produce 404 for JSON; authenticated form layout and CSV also check for missing forms.

### P3 — Form creation has no name bound

`src/lib/schemas.ts:27` has no maximum length; rename adds 100 characters at `src/lib/form-settings.remote.ts:9`. A signed-in user can create an exceptionally long name and slug, increasing storage, URL and notification work. Apply the same 100-character bound at creation and bound the slug. Duplicate simultaneous creations can race between `formExists` and insert (`src/lib/forms.remote.ts:11`); map the unique-constraint error to a validation response.

### P3 — Notification settings require JavaScript

`src/lib/components/NotificationSettingsDialog.svelte:21` only creates the settings query when a client-controlled dialog opens. With JavaScript disabled the owner cannot configure or disable notifications. Provide a server-rendered settings route and progressive forms; this is an accessibility and recovery limitation, not an unauthenticated exposure.

### P3 — Authentication and SMTP error logging may expose operational details

`src/lib/auth.remote.ts:9` and `src/lib/server/email.ts:82` and `:241` log complete exception objects. SMTP errors may contain server responses and connection details, potentially including attacker-supplied text. No concrete password disclosure in observed errors was established. Log bounded, classified error codes and redact secrets and user-controlled content. The test form returns classified messages rather than raw errors.

### P3 — Dependency advisories require targeted upgrade

`package-lock.json` and `package.json:20`: `npm audit --omit=dev` reported 6 affected packages: 2 high and 4 low, with no critical or moderate package totals. The high entries are Nodemailer and defu. Nodemailer 7 is used at runtime for SMTP; advisories include address-parser denial of service and SMTP/TLS issues, but this app supplies fixed message structure and owner-controlled addresses, not arbitrary message options, OAuth, DKIM or transport names. No specific advisory exploit was demonstrated. Defu is transitive; reachability with attacker-controlled defaults was not established. The four low entries are the deepmerge build-tool chain and its reported effects on SvelteKit and Better Auth, not four independently demonstrated runtime flaws. Upgrade and test compatible fixed versions, inspect bundled paths, and reassess advisories rather than applying suggested major downgrades blindly. Audit output changes over time.

## Controls and remaining verification

- The hook rejects all methods except GET, HEAD and OPTIONS when Origin differs from the request origin, including absent, empty and literal `null` origins. Its sole explicit exemption is `/api/forms/` (`src/hooks.server.ts:7`). `vite.config.ts:12` trusts all origins in SvelteKit, so the hook is the critical control. Public API fallback routes other methods to the submission handler; restrict it to POST and OPTIONS to keep that exemption narrow. Existing tests cover mismatched, null and missing Origin, same-origin no-JavaScript remote forms, and public cross-origin posts. Empty Origin and every remote endpoint were not individually probed.
- Protected loads, CSV, remote mutations and settings query call `requireUser` before data access; `/forms` awaits its protected parent. The public submission endpoint intentionally writes without authentication and does not return submissions. `/setup` requires authentication. There is no per-user ownership model: every account is an owner, making the first-account race significant.
- Settings queries return `has_password`, not the stored SMTP password (`src/lib/server/settings.ts:25`). The layout serializes only user name and email, not session tokens. The secret is checked for presence server-side (`src/lib/server/auth.ts:15`); entropy and the actual production secret cannot be assessed from source. Better Auth defaults set session cookies HttpOnly and SameSite=Lax, with Secure determined by configured base URL or production mode; local HTTP does not establish production cookie attributes. Verify production Set-Cookie during a real login without sharing the cookie value. Signup requires eight characters in the remote schema; Better Auth also applies its own password rules. Login and signup may expose Better Auth error messages (`src/lib/auth.remote.ts:7`); check enumeration and response timing through both entry points when adding throttling. Signup and login page redirects intentionally disclose whether any account exists.
- Svelte interpolates submission values and SVG chart labels as text; no `{@html}` was found in `src`. CSV quotes commas, quotes and newlines and prefixes leading `=`, `+`, `-`, `@`, tab and carriage return in user cells (`src/lib/server/dashboard.ts:70`); spreadsheet behavior after whitespace or re-saving varies and was not verified. Email field values and keys are escaped, with the form-name exception above. Notification destination is global and authenticated, and test mail goes to the configured email.
- SMTP credentials are stored as plaintext in D1 (`migrations/0004_move_to_global_settings.sql:5`). D1 readers and backups must be treated as secret-bearing. Encryption with a separately managed key can reduce database-only exposure, but does not protect a compromised Worker.
- No proof was obtained for signup concurrency, live cookie flags, distributed throttling, DNS rebinding, browser spreadsheet behavior, or actual mail delivery. Static assets may be served without the Worker hook; header configuration must cover both paths.

## Verification

- `E2E_PORT=5513 npm run test:e2e`: 79 passed on a clean local database. A prior run was contaminated by the concurrent local probe's extra form and had 3 failures and 5 tests not run; the clean rerun did not include that probe.
- A separate local `null` submission returned 201; the authenticated dashboard and CSV returned 500. Only local D1 was modified.
- `npm audit --omit=dev`: 2 high and 4 low affected packages; audit exited 1. Production `/login` and `/favicon.svg` were checked with read-only HEAD requests.
