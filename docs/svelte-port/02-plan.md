# FormZero: SvelteKit port, implementation plan

Status: plan only, nothing ported or built. Written 2026-11-15 against `origin/port-plan` (`1f227d1`), which is `origin/main` (`c26c843`) plus `01-analysis.md`.
Versions checked with `npm view` on 2026-11-15: `@sveltejs/kit` 3.2.0, `svelte` 5.57.3, `@sveltejs/adapter-cloudflare` 8.0.2, `@sveltejs/vite-plugin-svelte` 7.3.1, `better-auth` 1.7.25, `@react-router/dev` 7.18.5 (8.5.1 latest), `vite` 8.3.8, `wrangler` 4.162.0, `@playwright/test` 1.65.1, `valibot` 1.5.0, `@tanstack/svelte-table` 9.3.2.
Kit, adapter, better-auth and `@tanstack/svelte-table` claims were checked in the published package source (`npm pack`), not docs alone.

## 1. Summary

- Recommended approach: **staged coexistence in one Worker.** SvelteKit becomes the Worker host. A catch-all route `src/routes/[...legacy]/+server.ts` passes every unported URL to the existing React Router server build. Each stage ports some routes, deletes their React files, merges to `main` and can ship. React disappears in the last stage.
- This overturns the analysis's rejection of coexistence. The glue is one catch-all file (about 15 lines), a second Vite config, and one `cp` in the build script. It is deleted in the last stage. It needs no dispatcher Worker, no service binding and no second Worker, so the Deploy to Cloudflare button keeps working at every stage.
- Gate: stage 2 starts with a 3-hour spike that proves the catch-all builds, runs and fits the Worker size limit. If it fails, the same stage list runs on a `svelte-port` integration branch instead (section 3.5).
- UI (decision D3): shadcn-svelte components, CLI-copied into `src/lib/components/ui/` (bits-ui underneath), replace the React shadcn/Radix components one to one: button, card, dialog, dropdown-menu, input, label, separator, sidebar, sheet, skeleton, tooltip, tabs, table, breadcrumb, empty. Native HTML stays only where shadcn-svelte has no component or the platform is clearly simpler: `<time title>` on table rows, constraint validation attributes, the inline SVG chart (D4), and system dark mode without mode-watcher. TanStack Table, recharts, next-themes and date-fns are dropped. Stage 3 installs the component set once; every later stage reuses it.
- Seven stages: 0 security fixes, 1 parity tests, 2 SvelteKit host, 3 server core, 4 auth pages, 5 app shell, then 6, 7a and 7b in parallel, then 8 removes React.

## 2. Corrections to 01-analysis

|Analysis claim|Verdict|Evidence and consequence|
|-|-|-|
|`svelte.config.js` holds adapter, csrf and the remote functions flag|Wrong for Kit 3|Kit 3 no longer reads `svelte.config.js` ("Prior to SvelteKit 3, config lived in a `svelte.config.js` file, which is no longer supported", `src/exports/vite/index.js`). All options go in `sveltekit({...})` in `vite.config.ts`.|
|Bindings come from `event.platform.env` and `event.platform.ctx`|Wrong for Kit 3 + adapter 8|`adapter-cloudflare` 8 `files/worker.js` calls `server.respond(req, { getClientAddress })` with no `platform`. Use `import { env, waitUntil } from 'cloudflare:workers'` (Cloudflare's SvelteKit migration guide says the same for Kit 3). The adapter stubs that module in `vite dev` through `getPlatformProxy`.|
|`csrf.trustedOrigins: ['*']` compiles the origin check out|Correct|`__SVELTEKIT_CSRF_CHECK_ORIGIN__ = !kit.csrf.trustedOrigins.includes('*')`. `csrf.checkOrigin` is removed in 3.0.|
|"Remote functions keep their own same-origin check, which ignores trustedOrigins", so `['*']` is safe|Only half true; unsafe as written|`is_remote_forbidden` covers only `/_app/remote/*` fetches made by JavaScript. A remote `form()` submitted **without** JavaScript posts to the page URL with `?/remote=<id>` (`get_remote_action`), and that path is guarded only by the CSRF check that `['*']` removes. Fix: a 10-line origin guard in `hooks.server.ts` for every non-`GET`/`HEAD`/`OPTIONS` request outside `/api/forms/` (section 4.3). better-auth's `SameSite=Lax` cookie already blocks most of it, but `*.workers.dev` hosts and sibling subdomains are same-site, so the guard is needed.|
|Remote functions are opt-in experimental in Kit 3.2|Correct|`experimental.remoteFunctions: boolean(false)` in `options.js`. Svelte's `compilerOptions.experimental.async` is a separate flag. This plan does not need it (section 5.1).|
|Kit 3.2 requires Vite 8 and TS 6, so React Router must move to Vite 8 first|Correct, and cheap|Kit peers: `vite ^8.0.12`, `typescript ^6.0.0`. `@react-router/dev` 7.18.x peers allow `vite ^8` and `typescript ^6`, `@cloudflare/vite-plugin` 1.69 allows `vite ^8`, `@tailwindcss/vite` 4.3 allows `^8`. A 7.13 to 7.18 minor bump, no React Router 8 migration. Kit 3 also needs Node `>=22.17`.|
|better-auth ships `better-auth/svelte-kit` with `svelteKitHandler` and `sveltekitCookies`|Correct|Read in 1.7.25 `dist/integrations/svelte-kit.mjs`. `sveltekitCookies(getRequestEvent)` copies `Set-Cookie` from server-side `auth.api.*` calls onto `event.cookies`. better-auth has no native D1 dialect, so `kysely-d1` stays.|
|Move the signup guard into better-auth `hooks.before`|Better target exists|`databaseHooks.user.create.before` runs for every user-creation path (HTTP handler and server-side `auth.api.signUpEmail`). The 403 body becomes better-auth's `{ code, message }` instead of `{ success, message, error }`. Only FormZero's own UI reads it.|
|nodemailer on Workers is a port risk|Not a port risk|It runs on the same runtime and flags before and after the port. `node:net` and `node:tls` (`connect`, `TLSSocket`) exist under `nodejs_compat`. STARTTLS on port 587 through nodemailer is untested on either UI. Smoke-test it once in stage 3 on a preview, and record the result. Not a blocker.|
|Coexistence costs about 3 to 4 routes of glue and breaks the Deploy button|Wrong for the catch-all design|See section 3. The rejected designs (B1 dispatcher Worker, B2 service binding) are not the only options.|
|Stage 2: extract a framework-free server core on React first|Dropped|With coexistence, Svelte server modules are written once in the stage that needs them. Refactoring React route modules that are deleted a few stages later is wasted work.|
|All shadcn components exist in the shadcn-svelte registry|Correct|Checked `https://shadcn-svelte.com/registry/<name>.json` on 2026-11-15 for all 15 components. `sidebar` pulls `sheet`, `tooltip`, `skeleton`, `input`, `separator`, `button` and an `IsMobile` hook built on `MediaQuery` from `svelte/reactivity`. `utils` now uses the `cn` package (replaces `clsx` + `tailwind-merge`). Component deps: `bits-ui` 2.x (+ peer `@internationalized/date`), `tailwind-variants`, `@lucide/svelte`, `tw-animate-css`.|
|shadcn-svelte `Sidebar` keeps the React cookie|Needs one edit|shadcn-svelte's `SIDEBAR_COOKIE_NAME` is `sidebar:state`; React's is `sidebar_state`. Set the constant to `sidebar_state` so the collapse preference carries across both UIs during coexistence.|
|Keep `layerchart` for the chart|Dropped (D4)|30 points of one series; inline SVG inside a shadcn `Card`.|
|`/integration` endpoint from `page.url.origin`|Correct|Also fixes today's SSR/CSR mismatch from the `typeof window` branch.|
|Two dev ports, 5473 and 5474|One is enough|Coexistence serves both UIs from one Worker. Port 5473 only (free on 2026-11-15).|

Additional pre-existing defects found in the read, beyond the analysis's four:

- The integration page shares one `copiedCode` flag across all code blocks, so every block shows the check mark. Fixed by a per-block component in stage 5.
- The submissions table shows "No submissions yet." when a search has no matches. Stage 6 shows "No matching submissions."
- Multipart file fields are stored as `{}` (`Object.fromEntries` on a `File`, then `JSON.stringify`). Keep the behaviour and document it. Changing it is a public contract change.
- The 30-day chart buckets and the timestamp tooltips are computed on the server in UTC. Kept for parity, listed in section 10.

## 3. Coexistence: one Worker, SvelteKit in front

### 3.1 Mechanism

```
request
	-> Workers static assets (React /assets/*, Kit /_app/*, favicons)   served without running the Worker
	-> SvelteKit worker (adapter-cloudflare)
		hooks.server.ts: cross-site guard, session, /api/auth/* -> better-auth
		ported route?        -> Svelte page, +server.ts or remote function
		anything else        -> src/routes/[...legacy]/+server.ts -> React Router request handler
```

SvelteKit sorts rest parameters last, so a ported route always wins over `[...legacy]`. A `+layout` alone creates no route, so `/forms/[formId]/+layout.svelte` can exist while `/forms/x/settings` still falls through to React.

```ts
// src/routes/[...legacy]/+server.ts (deleted in stage 8)
import { createRequestHandler } from 'react-router';
import { env, waitUntil } from 'cloudflare:workers';
import * as build from '../../../build/react/server/index.js';
import type { RequestHandler } from './$types';

const handle = createRequestHandler(build, 'production');
const ctx = { waitUntil, passThroughOnException() {}, props: {} } as unknown as ExecutionContext;

export const fallback: RequestHandler = ({ request }) => handle(request, { cloudflare: { env, ctx } });
```

React is built first as a plain SSR bundle with `vite.react.config.ts` (the current Vite config minus `@cloudflare/vite-plugin`, with `ssr.target: 'webworker'`, `ssr.noExternal: true`, `buildDirectory: 'build/react'`). `workers/app.ts` and `@cloudflare/vite-plugin` are deleted. React route modules keep reading `context.cloudflare.env`, so no React file changes.

```json
"build": "react-router build --config vite.react.config.ts && vite build && cp -R build/react/client/. .svelte-kit/cloudflare/"
```

The copy runs after `vite build` because the adapter empties its output directory. Workers static assets answer a matching file before the Worker runs, so React's `/assets/*` chunks and `public/` favicons need no routing.

### 3.2 What is shared, with evidence

|Concern|How it works across both UIs|
|-|-|
|Session|Same D1 tables, same `BETTER_AUTH_SECRET`, same default cookie `better-auth.session_token`, same origin. A user signed in on a Svelte page is signed in on a React page.|
|`/api/auth/*`|Served by `svelteKitHandler` in `hooks.server.ts` from stage 3. React's `authClient` (login, signup, logout `clientAction`s) calls the same URLs, so React auth keeps working until its pages are deleted.|
|Public API|Moves to Svelte in stage 3. Until then it is React behind the catch-all. Either way the Playwright contract suite runs against the same URL.|
|CSRF|`csrf.trustedOrigins: ['*']` from stage 2, because Kit's check runs before routing and would otherwise reject cross-origin form posts to the React API route. The hook guard in section 4.3 covers React and Svelte routes alike.|
|Styles|Two CSS bundles with the same OKLCH token names (shadcn and shadcn-svelte share them). React keeps `app/app.css`. Svelte gets `src/app.css` from `shadcn-svelte init` (stage 3). The root `components.json` switches from the React shadcn config to the shadcn-svelte one in stage 3; React no longer needs its CLI.|
|Sidebar collapse|Both sidebars read and write the `sidebar_state` cookie (section 2).|
|Navigation|Crossing between the UIs is a full page load. Links from Svelte to unported pages carry `data-sveltekit-reload`. Links from React to ported pages get `reloadDocument`. Each stage edits only the links it crosses.|

### 3.3 Cost versus the rewrite-on-branch

|Item|Coexistence|Rewrite on branch|
|-|-|-|
|Glue|Catch-all (15 lines), `vite.react.config.ts`, build `cp`, `reloadDocument` on crossing links. Deleted in stage 8.|None|
|Toolchain|React Router 7.13 to 7.18, Vite 7 to 8, TS 5.9 to 6. One commit, gated by the suite.|Same jump, but React never runs on it|
|Duplicated UI|The forms sidebar exists in both UIs during stages 5 to 7 (React pages keep their own).|None|
|Checkpoints|Every stage merges to `main` and can deploy. Real traffic exercises ported routes early. Rollback is `wrangler rollback` per stage.|Previews only. One large merge and one cut-over deploy.|
|Parallel agents|Branch from `origin/main` each time. No long-lived branch.|All rebase on `svelte-port`, which drifts from `main`.|

Estimated extra cost of coexistence: about half a day (spike plus link edits). That buys a working, deployable `main` after every stage, which is the user's stated requirement.

### 3.4 Risks of coexistence

|Risk|Check|
|-|-|
|The React SSR bundle does not run inside the Kit Worker bundle (module format, `react-dom/server` export conditions)|Spike step 1: `wrangler dev`, load `/login` and `/forms/<id>/submissions`|
|Worker over the size limit (3 MB compressed on the free plan, 10 MB paid; self-hosters are often on free)|Spike step 2: `npx wrangler deploy --dry-run --outdir .wrangler/dry`; record the gzip size|
|React Router client navigation to a URL it does not know (lazy route discovery)|Spike step 3: click a React link to a Svelte route; if it 404s client-side, `reloadDocument` on that link fixes it|
|`postinstall` (`wrangler types`) fails when `main` points at a build output that does not exist yet|Spike step 4: fresh clone, `npm ci`|

### 3.5 Fallback if the spike fails

Keep the same stages and commit lists, with three changes:

1. Stage 2 becomes "replace the React toolchain with SvelteKit" on a long-lived `svelte-port` branch cut from `origin/main` after stage 1.
2. Stage PRs target `svelte-port`, not `main`. Previews (`npx wrangler versions upload`) are the checkpoints, and each preview only serves the routes ported so far.
3. Stage 8 is the `svelte-port` to `main` PR, gated by the full suite against a copy of production D1.

## 4. Target architecture

### 4.1 Final file layout

```
vite.config.ts                 sveltekit({ adapter, csrf, experimental }) + tailwindcss()
wrangler.jsonc                 main .svelte-kit/cloudflare/_worker.js, assets binding ASSETS, D1 DB unchanged
src/app.html, src/app.css, src/app.d.ts
src/hooks.server.ts            cross-site guard, session -> locals.user, svelteKitHandler
src/lib/server/auth.ts         betterAuth instance (module scope), requireUser()
src/lib/server/email.ts        moved from app/lib/email.server.ts unchanged
src/lib/server/submissions.ts  public API handler + email notification
src/lib/server/forms.ts        form queries
src/lib/server/dashboard.ts    submissions list, stats, chart buckets, CSV
src/lib/server/settings.ts     notification settings queries
src/lib/*.remote.ts            auth, forms, form-settings, submissions, settings
src/lib/schemas.ts             valibot schemas shared by remote functions and preflight
src/lib/smtp.ts, src/lib/time.ts, src/lib/highlight.ts
components.json                shadcn-svelte config (replaces the React shadcn one)
src/lib/utils.ts               shadcn-svelte cn + helper types (CLI-generated)
src/lib/hooks/is-mobile.svelte.ts   CLI-generated, used by the sidebar
src/lib/components/ui/**       shadcn-svelte CLI copies; edited only for the sidebar cookie name
src/lib/components/*.svelte    app components built from ui/*
src/routes/...                 section 4.4
tests/*.spec.ts, playwright.config.ts
migrations/, seed.sql, better-auth/config.ts  unchanged
static/                        favicons and manifest (moved from public/ in stage 8)
```

### 4.2 Config

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter(),
			csrf: { trustedOrigins: ['*'] },
			experimental: { remoteFunctions: true }
		})
	],
	server: { port: 5473, strictPort: true }
});
```

```jsonc
// wrangler.jsonc: only main and assets change
"main": ".svelte-kit/cloudflare/_worker.js",
"assets": { "binding": "ASSETS", "directory": ".svelte-kit/cloudflare" },
```

`compatibility_date` stays `2025-04-04`, `nodejs_compat` stays, and the D1 block is byte-identical. Script names `build`, `deploy`, `migrate`, `seed` and the `cloudflare.bindings` block stay, because the upstream README's Deploy to Cloudflare button depends on them. This repo uses npm, so `deploy` is not shadowed by a pnpm builtin. Add `"prepare": "svelte-kit sync || echo ''"` and a `.node-version` containing `22` (Kit 3 needs Node 22.17 or newer in Workers Builds).

### 4.3 Hooks and auth

```ts
// src/hooks.server.ts
import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isCrossSiteWrite({ request, url }: Parameters<Handle>[0]['event']) {
	if (SAFE_METHODS.has(request.method)) return false;
	if (url.pathname.startsWith('/api/forms/')) return false;
	return request.headers.get('origin') !== url.origin;
}

export const handle: Handle = async ({ event, resolve }) => {
	if (isCrossSiteWrite(event)) return new Response('Cross-site request forbidden', { status: 403 });
	if (!event.url.pathname.startsWith('/api/forms/')) {
		const session = await auth.api.getSession({ headers: event.request.headers });
		event.locals.user = session?.user ?? null;
	}
	return svelteKitHandler({ auth, event, resolve, building });
};
```

```ts
// src/lib/server/auth.ts
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { D1Dialect } from 'kysely-d1';

async function userCount() {
	const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM user').first<{ count: number }>();
	return row?.count ?? 0;
}

export const auth = betterAuth({
	database: { type: 'sqlite', dialect: new D1Dialect({ database: env.DB }) },
	secret: env.BETTER_AUTH_SECRET,
	emailAndPassword: { enabled: true },
	databaseHooks: {
		user: {
			create: {
				before: async () => {
					if ((await userCount()) > 0) {
						throw new APIError('FORBIDDEN', { code: 'SIGNUP_DISABLED', message: 'An account already exists. Please login instead.' });
					}
				}
			}
		}
	},
	plugins: [sveltekitCookies(getRequestEvent)]
});

export function requireUser() {
	const { locals } = getRequestEvent();
	if (!locals.user) redirect(303, '/login');
	return locals.user;
}
```

Rule: every remote function and every load under `/forms`, `/setup` calls `requireUser()` first. Remote functions are public HTTP endpoints; a layout's auth check does not protect them.

Rule: no `+page.server.ts` form actions and no app `+server.ts` mutations. Mutations are remote `form()`s. The only `+server.ts` files are the public API, the CSV export (`GET`) and the stage 2 to 7 catch-all.

### 4.4 Route map

|URL|Svelte files|Data and mutations|
|-|-|-|
|`/`|`src/routes/+page.server.ts`|load: `redirect(303, locals.user ? '/forms' : '/login')`|
|`/login`, `/signup`|`login/+page.server.ts`, `+page.svelte`; same for `signup`|load: redirects by session and user count. `signIn`, `signUp` remote `form()`s in `auth.remote.ts` call `auth.api.signInEmail` / `signUpEmail` with `headers: getRequestEvent().request.headers`, then `redirect(303, '/forms')`. Password field named `_password` so it is never echoed back.|
|sign out|`UserMenu.svelte`|`signOut` remote `form()`; a `<form>` with one button, works without JS|
|`/setup`|`setup/+page.server.ts`, `+page.svelte`|load: `requireUser()`, redirect to `/forms` if any form exists. `createForm` remote `form()` in `forms.remote.ts`, shared with the switcher dialog, ends in `redirect(303, ...)`.|
|`/forms`|`forms/+layout.server.ts`, `+layout.svelte`, `+page.server.ts`|layout load: `requireUser()`, forms list (redirect to `/setup` if empty), user, sidebar cookie. Page load: redirect to the first form.|
|`/forms/[formId]`|`forms/[formId]/+layout.server.ts`, `+layout.svelte`, `+page.server.ts`|layout load: form or `error(404)`. Page load: redirect to `submissions`. Breadcrumb label from `page.route.id`.|
|`.../submissions`|`submissions/+page.server.ts`, `+page.svelte`|load: list, stats, 30 day buckets (same JS math as today). `deleteSubmission` remote `form()`; a successful `form()` re-runs loads, so no `invalidateAll()`.|
|`.../submissions.csv`|`submissions.csv/+server.ts`|`GET`, `requireUser()`, `Content-Disposition: attachment`. The button becomes `<a href download>`.|
|`.../integration`|`integration/+page.svelte`|no server code; endpoint from `page.url.origin`|
|`.../settings`|`settings/+page.svelte`|`renameForm.for(form.id)` and `deleteForm` remote `form()`s|
|notification settings|`NotificationSettingsDialog.svelte`, `NotificationForm.svelte`|`getNotificationSettings` `query()`, `notificationSettings` `form()` with `intent` = `test` or `save`, `clearNotificationSettings` `form()`|
|`/api/auth/*`|`hooks.server.ts`|`svelteKitHandler`|
|`/api/forms/[formId]/submissions`|`api/forms/[formId]/submissions/+server.ts`|`POST`, `OPTIONS`, `fallback` (405 with CORS headers). Status codes, headers and redirect targets identical to today: 201 JSON, 303 to `?redirect`, then referer, then `/success`, 302 to `/error?error=...`. Email via `waitUntil` from `cloudflare:workers`.|
|`/success`, `/error`|`success/+page.svelte`, `error/+page.svelte`|`/error` reads `page.url.searchParams`|
|errors|`src/routes/+error.svelte`|replaces `root.tsx` `ErrorBoundary`|

## 5. React patterns replaced

### 5.1 Data and state

- Page data comes from `+page.server.ts` / `+layout.server.ts` loads (server-rendered, no experimental flag). `query()` is used once, for notification settings, because that data loads only when the dialog opens. It is read with `{#await}`, so `compilerOptions.experimental.async` stays off. Turn it on only if a later feature needs `await` in markup.
- Every mutation is a remote `form()`, including deletes and sign out, so all of them work without JavaScript and refresh loads automatically. `command()` is not used.
- Runes only. `$effect` is never used. Each React effect maps to:

|React effect|Svelte replacement|
|-|-|
|Lazy-load settings when the dialog opens (`useEffect` + `fetcher.load`)|`<Dialog.Root bind:open>` with `{#if open}{#await getNotificationSettings() then saved}{#key saved?.updated_at}<NotificationForm {saved} />{/key}{/await}{/if}` inside `Dialog.Content`. The user menu item sets `open = true` in `onSelect`.|
|Copy settings props into state when they change|No local copies. Initial values go in `.as('email', saved.notification_email)`. Current values are read with `fields.x.value()`.|
|Debounced SMTP provider autodetect|`provider = $derived(SMTP_PROVIDERS[emailDomain(email)])`. Host and port for known providers are derived and sent as hidden inputs. No timer.|
|Reset "test passed" whenever a field changes (3 effects)|`testedKey = $state('')`, set from the `enhance` callback after a successful test. `testPassed = $derived(testedKey === key)`, where `key` is the derived JSON of the four field values.|
|Reset the form after "Disable notifications"|The clear form re-runs `getNotificationSettings`, which returns `null`. `{#key saved?.updated_at}` around `NotificationForm` remounts it empty.|
|`setName(form.name)` when loader data changes|`renameForm.for(form.id)` with `.as('text', form.name)`; the second argument sets both the value and the reset value|
|Close the switcher dialog on pathname change|`createForm.enhance(async ({ submit }) => { if (await submit()) open = false; })` with `<Dialog.Root bind:open>`|
|`ResultButton` 2 s "Saved!" effect timer|`SubmitButton.svelte` wraps `ui/button` and takes `pending` and `done`. The caller sets `done = true` and one `setTimeout` in its `enhance` callback. No effect.|
|`useIsMobile` (`matchMedia` effect)|`useSidebar().isMobile` from the CLI-copied sidebar (`MediaQuery` from `svelte/reactivity`, no effect in app code)|
|Logout via `fetcher.submit`|A hidden `<form {...signOut}>` plus `DropdownMenu.Item onSelect={() => form.requestSubmit()}`|
|One delete dialog per row|One `DeleteSubmissionDialog` with `pending = $bindable<Submission \| null>()`; `Dialog.Root open={pending !== null}`; the form carries hidden `id` and `form_id`|
|`useMemo` columns from data|`$derived` field list (section 6.1)|

The `NotificationForm`, `SubmissionsTable`, `UserMenu`, `NotificationSettingsDialog` and `DeleteSubmissionDialog` sketches used to derive these rules passed `svelte-autofixer` with no issues (`UserMenu` got only a suggestion to prefer an attachment over `bind:this`).

### 5.2 Components and native platform choices

Rule (decision D3): use the shadcn-svelte component wherever one exists for the piece. Native HTML only where shadcn-svelte has no component or the platform is clearly simpler. Browser policy (D6): Baseline newly available features without polyfills.

|UI|Today|Port|Why|
|-|-|-|-|
|Buttons, cards, inputs, labels, separators, breadcrumb, empty state|shadcn React|`ui/button`, `ui/card`, `ui/input`, `ui/label`, `ui/separator`, `ui/breadcrumb`, `ui/empty`|Same class strings and API shape; `asChild` becomes bits-ui's `child` snippet|
|Sidebar, mobile sheet, collapse, Ctrl+B, cookie|shadcn React `Sidebar`|`ui/sidebar` (pulls `sheet`, `tooltip`, `skeleton`). `collapsible="offcanvas"` per D2; `collapsible="icon"` restores the icon rail with no other change. Layout load reads the `sidebar_state` cookie and passes `open` to `Sidebar.Provider`, so there is no flash.|One-to-one port; rebuilding it natively is the largest avoidable cost|
|Form switcher, user menu|Radix DropdownMenu|`ui/dropdown-menu`, `side={sidebar.isMobile ? 'bottom' : 'right'}` as today|bits-ui implements the menu keyboard contract and positioning; native needs anchor positioning (limited availability per `viewport-aware-dropdowns`)|
|Create-form, delete-submission, delete-form, settings dialogs|Radix Dialog|`ui/dialog` with `bind:open`|One-to-one. bits-ui handles focus trap, Esc and outside click.|
|Snippet tabs|Radix Tabs|`ui/tabs`|One-to-one; correct ARIA tabs and arrow keys|
|"Send a test email first" and redirect-URL help tooltips|Radix Tooltip|`ui/tooltip` (trigger wraps the disabled button in a `span`, as today), plus the same text as visible helper under the buttons, because a disabled button does not receive focus|`interest-triggered-tooltips`: tooltips must not be the only path to the information|
|Exact time on each table row|Radix Tooltip per row, 1 s delay|`<time datetime title>`|Platform simpler: one attribute instead of a bits-ui instance per row|
|Table|shadcn Table + TanStack|`ui/table` markup, hand-written `$derived` filter and sort (6.1), `aria-sort` on the sorted `Table.Head`, a ghost `Button` inside it, keyed `{#each}`|`sortable-table`|
|Chart|recharts via `ui/chart`|Inline SVG inside `ui/card` (D4). Uses `--chart-2`.|30 points of one series|
|Dark mode|next-themes + `.dark` class|Keep shadcn-svelte's token block names. Change `@custom-variant dark` to `(@media (prefers-color-scheme: dark))`, move the `.dark { ... }` token block into `@media (prefers-color-scheme: dark) { :root { ... } }`, add `color-scheme: light dark` on `:root` and `<meta name="color-scheme" content="light dark">`. No mode-watcher (no toggle exists). Code blocks keep a fixed dark theme with `color-scheme: dark`.|`dark-mode`; same tokens as the CLI emits, so later `shadcn-svelte add` output still works|
|Form validation|Mostly none|Native attributes on `ui/input` (`type`, `required`, `minlength`, `autocomplete`), `:user-invalid` styling, valibot schema on the server and as `preflight`. shadcn-svelte `form`/`field` (formsnap) not used: remote `form()` already provides fields and issues.|`forms`, `validate-input-after-interaction`|
|Copy buttons|One shared flag|`CopyButton.svelte` on `ui/button`, own state per block, `navigator.clipboard.writeText`, not disabled during feedback|`copy-button`|
|Responsive stat tiles|Viewport breakpoints|`@container` on the inset with Tailwind 4 `@md:` / `@lg:` variants||
|Page transitions|none|Skipped|`cross-document-transitions` checked, not applied|

## 6. Dependency ledger

### 6.1 TanStack Table: `@tanstack/svelte-table` 9.3.2 evaluated

Read from the published package: Svelte 5 runes adapter, `createTable({ features, columns, get data() })`, features declared with `tableFeatures({ rowSortingFeature, globalFilteringFeature })`, row models from `createSortedRowModel(sortFns)` / `createFilteredRowModel`, cells rendered with `FlexRender`, `renderSnippet` or `renderComponent`. Depends on `@tanstack/table-core` 9.3.1 (about 1 MB unpacked) and `@tanstack/svelte-store`.

Today's table uses two sortable columns, a JSON-string search, dynamic columns from data keys and one action cell. No pagination, selection, visibility or resizing.

- With v9: feature and row-model setup, a column-def array with header and cell snippets, `FlexRender` in the template, plus the shadcn-svelte `data-table` wrapper. The `columns.tsx` structure ports almost one to one, so the line count stays near today's 304 lines.
- Without it: the sketch in this plan (field list, filter, sort, `aria-sort`, keyed rows) is about 55 lines plus `ui/table` markup, and passed `svelte-autofixer`.

Verdict: **drop.** Keep `ui/table` for markup and styling, sort and filter with `$derived`. Revisit if pagination, column visibility or virtualisation arrive, at which point v9 with shadcn-svelte's `data-table` recipe is the right tool.

### 6.2 Sweep

|Package|Decision|Reason|
|-|-|-|
|`@tanstack/svelte-table`|drop|6.1|
|`shadcn-svelte` CLI 1.8.1|use via `npx shadcn-svelte@1.8.1`, not a dependency|Copies components into `src/lib/components/ui/`. Resolves `$lib` aliases from `tsconfig` (`.svelte-kit/tsconfig.json` after `svelte-kit sync`), so Kit 3's missing `svelte.config.js` should not matter (unverified until stage 3).|
|`bits-ui` 2.x + peer `@internationalized/date`|add (stage 3)|Headless primitives under dialog, dropdown-menu, sheet, tooltip, tabs, label, separator|
|`tailwind-variants`|add (stage 3)|Variants in button, sidebar, sheet, empty; replaces `class-variance-authority`|
|`cn`|add (stage 3)|shadcn-svelte `utils` now imports `cn` from `cn`; replaces `clsx` + `tailwind-merge`|
|`tw-animate-css`|keep|shadcn-svelte enter and exit animations|
|`@lucide/svelte`|swap from `lucide-react`|Same icon names, per-icon imports. Also a shadcn-svelte component dependency.|
|`layerchart`|drop (D4)|Inline SVG chart|
|`better-auth/svelte-kit`|keep (new)|`svelteKitHandler` and `sveltekitCookies` remove the hand-written `/api/auth` route and cookie plumbing|
|`better-auth/svelte` (client)|drop|Auth runs server-side inside remote forms|
|`mode-watcher`|drop|No theme toggle exists; system mode via media query on shadcn tokens|
|`next-themes`|drop|Same|
|`prismjs` (core + `jsx`, `typescript` components)|swap from `prism-react-renderer`|The HTML snippet changes as the user types the redirect URL, so highlighting stays at render: `Prism.highlight()` in `$derived`, rendered with `{@html}`. Prism escapes its input, so the user-typed URL cannot inject markup. Runs in SSR too. The `vsDark` theme becomes about 20 lines of CSS.|
|`date-fns`|drop|Used once (`formatDistanceToNow`). `Intl.RelativeTimeFormat` in `src/lib/time.ts`, about 10 lines.|
|`recharts`, `@radix-ui/*`, `@tanstack/react-table`, `isbot`, `class-variance-authority`, `clsx`, `tailwind-merge`, `vite-tsconfig-paths`, `@cloudflare/vite-plugin`|drop (stage 8; the Vite plugin in stage 2)|React-only or replaced by the stage 3 additions|
|`valibot`|add (stage 4)|Standard Schema validation for remote functions at the trust boundary. Server-side, and reused as `preflight`.|
|`tailwindcss` 4, `@tailwindcss/vite`|keep|Required by shadcn-svelte|
|`better-auth`, `kysely-d1`, `nodemailer`|keep|Framework-free. No native D1 dialect in better-auth 1.7.|
|`better-sqlite3`, `dotenv-cli`, `@better-auth/cli` script|keep|CLI schema generation only|
|`@playwright/test`|add (stage 1)|Parity gate|

## 7. Stages

Conventions for every stage:

- Branch `port/s<N>-<slug>` from `origin/main`, worktree `../formzero-s<N>`, PR to `main`, rebase on `origin/main` before merge, `gh pr merge --rebase`. One PR per stage; 7a, 7b and 6 are separate PRs.
- Each commit builds and passes `npm run test:e2e`, so `main` is bisectable. Page stages add components first (not yet routed) and switch the route in the last commit, deleting the React route in that same commit.
- Each Claude-written PR is reviewed by a GPT profile before merge. Qwen work is reviewed by Sonnet 5.5.
- Commit trailer: `Co-Authored-By: <the agent's model> <noreply@anthropic.com>` (or the agent's own trailer).

Verification for every stage:

```sh
npm run typecheck
npm run build
npm run test:e2e
```

Stages 2 onward also run:

```sh
npx wrangler deploy --dry-run --outdir .wrangler/dry
```

```sh
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5473/no-such-page
```

The second must print `404` while `wrangler dev --port 5473` (started by Playwright or by hand) is running. Stop any server you start.

### Stage 0: security fixes (React)

Goal: fix pre-existing defects so both UIs share correct behaviour. Profile: Sonnet 5.5. Size: about 2 hours. Can run in parallel with stage 1 (disjoint files).

|Commit|Files|
|-|-|
|`fix(settings): require auth on notification settings loader`|`app/routes/settings.notifications.tsx`|
|`fix(settings): never send the SMTP password to the browser` (loader returns `has_password`; blank password on save or test keeps the stored one)|`app/routes/settings.notifications.tsx`, `app/routes/settings.notifications.test.tsx`, `app/components/settings-dialog.tsx`, `app/types/settings.ts`|
|`fix(forms): 404 for unknown form id`|`app/routes/forms.$formId.tsx`|
|`fix(forms): reject form names that produce an empty slug`|`app/routes/forms.tsx`|

Extra verification (with `wrangler dev --port 5473` running):

```sh
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5473/settings/notifications
```

Must print a redirect (`302`) to `/login`, not `200`.

### Stage 1: Playwright parity suite (React)

Goal: a suite that passes on React today and is the gate for every later stage. Selectors by role, label and text only, never by class or DOM shape, so the suite survives the port unchanged. Profile: Sonnet 5.5. Size: about 1 day.

|Commit|Files|
|-|-|
|`test: playwright harness on wrangler dev 5473 with a fresh local D1`|`playwright.config.ts`, `tests/global-setup.ts`, `package.json` (`@playwright/test`, `test:e2e`), `.gitignore`|
|`test: public submission API contract`|`tests/api.spec.ts`: JSON 201 `{success,id}`; urlencoded and multipart 303 to `?redirect`, then referer, then `/success`; JSON 404 and 415; form-post 302 to `/error?error=form_not_found`; `OPTIONS` 204 with the exact four CORS headers; `GET` 405 with CORS; urlencoded post with `Origin: https://customer.example` still 303|
|`test: auth and redirect flows`|`tests/auth.spec.ts`: first signup, second signup 403, login, wrong password message, logout, redirects for `/`, `/login`, `/signup`, `/setup`, `/forms`, `/forms/<id>`, unknown form 404, unauthenticated `/settings/notifications` not 200|
|`test: dashboard flows`|`tests/dashboard.spec.ts`: create first form, create second form from the switcher, submission appears, search, sort by time and email, CSV download has the header row, delete submission, rename, type-to-confirm delete form, integration endpoint text and copy, notification settings: save disabled until a test passes, test against an unreachable host shows an error, disable clears a seeded row|

Harness: `globalSetup` deletes `.wrangler/e2e`, applies migrations with `--local --persist-to .wrangler/e2e`. `webServer` runs `npm run build` then `npx wrangler dev --port 5473 --persist-to .wrangler/e2e --var BETTER_AUTH_SECRET:e2e-only-0123456789abcdef0123456789`. `workers: 1`, a `setup` project signs up once and saves `storageState`. Every non-GET request made with the `request` fixture sends `Origin: http://localhost:5473` except the deliberate cross-origin cases.

### Stage 2: SvelteKit hosts the Worker, React behind a catch-all

Goal: the production Worker is SvelteKit; every URL is still answered by React; the suite is green. Profile: Opus 5.5. Size: half a day plus the 3-hour spike.

|Commit|Files|
|-|-|
|`build: upgrade react-router 7.18, vite 8, typescript 6`|`package.json`, `package-lock.json`|
|`build: sveltekit hosts the worker and serves react router through a catch-all` (includes `csrf.trustedOrigins: ['*']` and the cross-site guard, because the suite's cross-origin API post fails without the first and the guard must land with it)|`vite.config.ts` (now Kit), `vite.react.config.ts` (old config minus the Cloudflare plugin), `react-router.config.ts` (`buildDirectory`), `src/app.html`, `src/app.d.ts`, `src/hooks.server.ts` (guard only), `src/routes/[...legacy]/+server.ts`, `wrangler.jsonc`, `tsconfig.json` (Kit) and `tsconfig.react.json` (old root solution), `package.json` scripts, `.node-version`, `.gitignore`; delete `workers/app.ts`|
|`test: cross-site writes are rejected outside the public API`|`tests/csrf.spec.ts`: cross-origin urlencoded `POST /forms` 403, no-Origin `POST /forms` 403, cross-origin `POST /api/forms/<id>/submissions` 303|

Spike first (do not commit until it passes): run steps in 3.4, record Worker gzip size and results in the PR body. If any step fails and cannot be fixed within 3 hours, stop and report; the coordinator switches to 3.5.

### Stage 3: Svelte server core and shared components

Goal: auth endpoint, public API, the shadcn-svelte component set, root layout and the two static pages run on Svelte. Profile: Opus 5.5 (security-sensitive), which also owns the component-set commit because every later stage depends on it. Size: about 1 day.

|Commit|Files|
|-|-|
|`feat(auth): better-auth on cloudflare:workers env with single-user guard, served from hooks`|`src/lib/server/auth.ts`, `src/hooks.server.ts`, `src/app.d.ts` (`Locals.user`); delete `app/routes/api.auth.$.tsx` and its `app/routes.ts` entry|
|`refactor: move email module to src/lib/server/email.ts` (`git mv`, imports only)|`src/lib/server/email.ts`, `app/routes/api.forms.$formId.submissions.tsx`, `app/routes/settings.notifications.test.tsx`|
|`feat(api): public submission endpoint in sveltekit`|`src/lib/server/submissions.ts`, `src/routes/api/forms/[formId]/submissions/+server.ts`; delete the React route and entry|
|`build: shadcn-svelte init and component set`|`npx shadcn-svelte@1.8.1 init`, then `npx shadcn-svelte@1.8.1 add button card dialog dropdown-menu input label separator sidebar sheet skeleton tooltip tabs table breadcrumb empty`. Writes `components.json` (replaces the React one), `src/app.css`, `src/lib/utils.ts`, `src/lib/hooks/is-mobile.svelte.ts`, `src/lib/components/ui/**`, `package.json` (`bits-ui`, `@internationalized/date`, `tailwind-variants`, `cn`, `tw-animate-css`, `@lucide/svelte`). Then: copy React's token values from `app/app.css` into the same variable names, apply the dark-mode change in 5.2, set `SIDEBAR_COOKIE_NAME` to `sidebar_state`. Nothing imports the components yet; the build and suite stay green.|
|`feat(ui): root layout, success and error pages`|`src/routes/+layout.svelte`, `src/routes/+error.svelte`, `src/routes/success/+page.svelte`, `src/routes/error/+page.svelte` (built from `ui/card`, `ui/button`); delete `app/routes/success.tsx`, `error.tsx` and entries|

If the CLI cannot resolve aliases under Kit 3, run `npx svelte-kit sync` first; if it still fails, stop and report (fallback: copy the `files[].content` from `https://shadcn-svelte.com/registry/<name>.json` by hand). Record the Worker gzip size before and after this stage (bits-ui is now in the server bundle).

Extra: on a preview (`npx wrangler versions upload`), save real SMTP settings on the React dialog and submit once; record whether the notification email arrived (section 2, nodemailer row).

### Stage 4: auth pages and setup

Goal: `/`, `/login`, `/signup`, `/setup` on Svelte. Profile: Sonnet 5.5. Size: half a day.

|Commit|Files|
|-|-|
|`feat(auth): login and signup with remote forms`|`src/lib/schemas.ts`, `src/lib/auth.remote.ts` (`signIn`, `signUp`), `src/routes/login/+page.server.ts`, `+page.svelte`, `src/routes/signup/+page.server.ts`, `+page.svelte` (`ui/input`, `ui/label`, `ui/button`); delete `app/routes/login.tsx`, `signup.tsx` and entries|
|`feat: root redirect and first-form setup`|`src/routes/+page.server.ts`, `src/lib/server/forms.ts`, `src/lib/forms.remote.ts` (`createForm`), `src/routes/setup/+page.server.ts`, `+page.svelte`; delete `app/routes/home.tsx`, `setup.tsx` and entries|

`app/routes/logout.tsx` stays: React's sidebar still uses it until stage 8.

### Stage 5: app shell and integration page

Goal: Svelte `/forms` layouts with sidebar, switcher, nav, user menu, create-form dialog, and the integration page. Submissions and settings pages still React. Profile: Opus 5.5. Size: about 1 day.

|Commit|Files|
|-|-|
|`feat(shell): forms layouts with sidebar, form switcher, nav and sign out`|`src/routes/forms/+layout.server.ts` (forms, user, `sidebar_state` cookie), `+layout.svelte` (`Sidebar.Provider`, `Sidebar.Inset`), `+page.server.ts`, `src/routes/forms/[formId]/+layout.server.ts`, `+layout.svelte` (header, `Sidebar.Trigger`, `ui/breadcrumb`), `+page.server.ts`, `src/lib/components/{AppSidebar,FormSwitcher,FormNav,UserMenu,SubmitButton}.svelte`, `src/lib/auth.remote.ts` (`signOut`). `FormNav` links to Submissions and Settings carry `data-sveltekit-reload`.|
|`feat(shell): create-form dialog`|`src/lib/components/CreateFormDialog.svelte` (`ui/dialog`), `FormSwitcher.svelte`|
|`feat(integration): integration page with highlighted snippets`|`src/lib/highlight.ts`, `src/lib/snippets.ts`, `src/lib/components/{CodeBlock,CopyButton}.svelte`, `src/routes/forms/[formId]/integration/+page.svelte` (`ui/tabs`, `ui/card`, `ui/input`, `ui/tooltip`); `app/components/form-nav.tsx` (`reloadDocument` on Integration); delete `app/routes/forms.$formId.integration.tsx` and entry|

### Stages 6, 7a, 7b: parallel

Each branches from `origin/main` after stage 5 merges. File ownership below is exclusive. Read-only in these stages: `src/lib/components/ui/**`, `components.json`, `src/app.css`, `AppSidebar.svelte`, `SubmitButton.svelte`, `forms.remote.ts`, `auth.ts`. No stage runs `shadcn-svelte add`; if a component is missing, stop and report. Extra styles go in component `<style>` blocks or Tailwind classes. Merge order 7a, 6, 7b; the later ones rebase.

#### Stage 6: submissions (Opus 5.5, about 1 day)

Owns: `src/routes/forms/[formId]/submissions/**`, `src/routes/forms/[formId]/submissions.csv/**`, `src/lib/server/dashboard.ts`, `src/lib/submissions.remote.ts`, `src/lib/time.ts`, `src/lib/components/{StatTile,SubmissionsChart,SubmissionsTable,DeleteSubmissionDialog}.svelte`, the Submissions `data-sveltekit-reload` removal in `FormNav.svelte`, and the matching `reloadDocument` in `app/components/form-nav.tsx`.

|Commit|Content|
|-|-|
|`feat(submissions): dashboard queries, stat tiles and svg chart components`|`dashboard.ts`, `StatTile` (`ui/card`), `SubmissionsChart` (inline SVG in `ui/card`) (not routed)|
|`feat(submissions): table with search and sort`|`SubmissionsTable` (`ui/table`, `ui/input`, ghost `ui/button` in sortable heads, `$derived` sort and filter), `time.ts`|
|`feat(submissions): delete remote form and confirm dialog`|`submissions.remote.ts`, `DeleteSubmissionDialog` (`ui/dialog`, one shared instance)|
|`feat(submissions): csv export endpoint`|`submissions.csv/+server.ts`|
|`feat(submissions): submissions page`|`+page.server.ts`, `+page.svelte` (`ui/empty` for the empty state), nav link edits; delete `app/routes/forms.$formId.submissions.tsx`, the `forms.$formId.submissions/` directory, `forms.$formId.submissions.$submissionId.tsx` and entries|

#### Stage 7a: form settings page (Sonnet 5.5, half a day)

Owns: `src/routes/forms/[formId]/settings/**`, `src/lib/form-settings.remote.ts`, the Settings link edits in `FormNav.svelte` and `form-nav.tsx`.

|Commit|Content|
|-|-|
|`feat(form-settings): rename and delete remote forms`|`form-settings.remote.ts` (`renameForm` returns `{ saved: true }`, `deleteForm` redirects 303 to `/forms`)|
|`feat(form-settings): settings page`|`+page.svelte` (`ui/card` rename card and danger zone, `ui/dialog` type-to-confirm), nav edits; delete `app/routes/forms.$formId.settings.tsx` and entry|

#### Stage 7b: notification settings dialog (Opus 5.5, about 1 day)

Owns: `src/lib/settings.remote.ts`, `src/lib/server/settings.ts`, `src/lib/smtp.ts`, `src/lib/components/{NotificationSettingsDialog,NotificationForm}.svelte`, and `UserMenu.svelte` (adds the Settings `DropdownMenu.Item`).

|Commit|Content|
|-|-|
|`feat(notifications): settings query and remote forms`|`getNotificationSettings` (returns `has_password`, never the password), `notificationSettings` (`intent` `test` sends the test email and returns `{ tested: true }`; `save` upserts; blank `_password` keeps the stored one), `clearNotificationSettings`|
|`feat(notifications): settings dialog in the user menu`|`NotificationSettingsDialog` (`ui/dialog` with `bind:open`), `NotificationForm` (`ui/card`, `ui/input`, `ui/label`, `ui/tooltip`, `SubmitButton`), `UserMenu.svelte` item|

React's `/settings/notifications` and `/settings/notifications/test` routes stay until stage 8, because React pages still render the old dialog until 6 and 7a merge.

### Stage 8: remove React

Goal: no React left. Profile: Qwen (Hetzner) for commits 1 and 2, a GPT profile for commit 3. Size: half a day.

|Commit|Content|
|-|-|
|`chore: remove the react router app and catch-all`|delete `app/`, `src/routes/[...legacy]/`, `vite.react.config.ts`, `react-router.config.ts`, `tsconfig.react.json`, `tsconfig.cloudflare.json`, `tsconfig.node.json`; `git mv public static`; `build` script becomes `vite build`; `typecheck` becomes `wrangler types && svelte-kit sync && svelte-check`. `components.json` stays (it is the shadcn-svelte one since stage 3).|
|`chore(deps): drop react-era dependencies`|`package.json`, `package-lock.json`: remove `react`, `react-dom`, `react-router`, `@react-router/dev`, `@types/react`, `@types/react-dom`, all `@radix-ui/*`, `@tanstack/react-table`, `recharts`, `next-themes`, `prism-react-renderer`, `lucide-react`, `date-fns`, `isbot`, `class-variance-authority`, `clsx`, `tailwind-merge`, `vite-tsconfig-paths`. Keep `tw-animate-css`, `bits-ui`, `@internationalized/date`, `tailwind-variants`, `cn`, `@lucide/svelte`.|
|`docs: readme for the sveltekit app`|`README.md`: dev command and port, scripts, `.node-version`, Kit 3 requirement, adding components with `npx shadcn-svelte@1.8.1 add`, LLM disclaimer|

Then run the suite against a preview bound to a copy of production D1 (`npx wrangler d1 export` into a preview database), and test the Deploy to Cloudflare button against the fork.

### Ordering

Stages 0 and 1 are already running on React. Nothing in this revision changes them.

|Stage|Depends on|Parallel with|Ships|
|-|-|-|-|
|0 fixes|-|1|main|
|1 tests|-|0|main|
|2 host|0, 1|-|main|
|3 server core + components|2|-|main|
|4 auth pages|3|-|main|
|5 shell|4|-|main|
|6 submissions|5|7a, 7b|main|
|7a form settings|5|6, 7b|main|
|7b notifications|5|6, 7a|main|
|8 remove React|6, 7a, 7b|-|main|

Total: about 5 to 6 agent-days, of which about 2 run in parallel. Production deploys happen per stage, after the coordinator asks the user (D8).

## 8. Agent briefs

Shared preamble for every brief (paste above the stage brief):

```
Repo: ~/dev/exp/formzero (GitHub mrgnw/formzero; upstream BohdanPetryshyn/formzero, never push there).
Plan: docs/svelte-port/02-plan.md on origin/main (or origin/port-refine until merged). Read sections 2, 4, 5 and your stage before writing code. The plan wins over 01-analysis.md.
Setup:
	git fetch origin
	git worktree add ../formzero-s<N> -b port/s<N>-<slug> origin/main
Work only in that worktree. Do not touch other worktrees or the main checkout.
Rules: tabs, not spaces. No comments unless asked. Svelte 5 runes only; never use $effect. No form actions; mutations are remote form()s that call requireUser() first. Build UI from the shadcn-svelte components in $lib/components/ui per plan 5.2; use native HTML only where 5.2 says so. Do not edit files under $lib/components/ui and do not run shadcn-svelte add (stage 3 owns both); if a component is missing, stop and report. Dependencies: only those listed in plan 6.2. Use the Svelte MCP (get-documentation, svelte-autofixer) on every .svelte file until it reports no issues. Load skills: web-svelte, svelte-core-bestpractices, sveltekit-remote-functions, modern-web-guidance (search before each UI piece).
Server: only port 5473 (wrangler dev via Playwright). Check `lsof -ti :5473` first. Stop any server you start.
Commits: exactly the commit list for your stage, one concern each, each passing `npm run typecheck && npm run build && npm run test:e2e`. Push after every commit: `git push -u origin HEAD`. Open one PR to main with `gh pr create`, body lists verification output. Do not merge and do not deploy to production.
Stop and report instead of improvising if the plan is wrong about an API or a file.
Follow the `concise-output` skill. Final report under 2000 characters, outcomes not process.
```

Stage briefs (stages 0 and 1 are already running from the previous revision and are unaffected):

```
Stage 0 (Sonnet 5.5): Implement plan section 7, stage 0, on React. Four commits. For the password fix: the loader returns has_password instead of notification_email_password; the POST and the test route use the stored password when the submitted one is blank; the dialog's password input starts empty with a placeholder when has_password is true. Verify with the curl in stage 0 plus typecheck and build. There are no tests yet unless stage 1 has merged; if it has, run them.
```

```
Stage 1 (Sonnet 5.5): Implement plan section 7, stage 1, against the React app. Selectors by role, label and visible text only. The suite must pass on React unchanged and is the parity gate for every later stage, so assert behaviour (status codes, headers, redirects, visible text), not markup. SMTP cannot be reached in tests: assert the gating and error states listed in the plan, and seed a settings row with wrangler d1 execute --local for the disable test.
```

```
Stage 2 (Opus 5.5): Implement plan section 3.1 and stage 2. Start with the spike in 3.4 and do not commit until all four checks pass; record the Worker gzip size and results in the PR body. If the spike fails after 3 hours, stop and report what failed. Keep script names build, deploy, migrate, seed and the cloudflare.bindings block. Kit 3 config lives in vite.config.ts, not svelte.config.js. Bindings come from cloudflare:workers, not event.platform. Do not install shadcn-svelte here; stage 3 does.
```

```
Stage 3 (Opus 5.5): Implement plan 4.3, 4.4 (api, success, error, /api/auth) and stage 3, including the shadcn-svelte init and component-set commit exactly as listed. The public API must match today's status codes, headers and redirect targets byte for byte; the stage 1 api.spec.ts is the contract. After init, keep shadcn-svelte's variable names, copy React's token values from app/app.css, switch dark mode to prefers-color-scheme per plan 5.2, and set SIDEBAR_COOKIE_NAME to sidebar_state. Leave app/app.css untouched for React. Report Worker gzip size before and after the component commit, and the nodemailer smoke test result.
```

```
Stage 4 (Sonnet 5.5): Implement stage 4 with ui/input, ui/label and ui/button. Remote forms per plan 4.4: password field named _password, valibot schemas in src/lib/schemas.ts used as both the server schema and preflight, signup password match checked in the schema, better-auth APIError mapped to invalid() with today's messages. Pages must work with JavaScript disabled; add one Playwright test that logs in with javaScriptEnabled: false.
```

```
Stage 5 (Opus 5.5): Implement stage 5 per plan 5.1 and 5.2: ui/sidebar with collapsible="offcanvas" (D2) and the sidebar_state cookie read in the layout load, ui/dropdown-menu for the form switcher and user menu (sign out via a hidden remote form and requestSubmit), ui/dialog for create-form, ui/tabs and ui/tooltip on the integration page, ui/breadcrumb in the header. Port class strings from the React components so the result matches visually; take screenshots of React /forms/<id>/integration before deleting it and compare. SubmitButton.svelte is shared by stages 6, 7a and 7b, so keep its props small. Add data-sveltekit-reload to links to unported pages and reloadDocument to the React Integration link.
```

```
Stage 6 (Opus 5.5): Implement stage 6. Own only the files listed for stage 6. Table: ui/table markup with $derived search and sort per plan 6.1 (no TanStack), aria-sort on the sorted head, <time datetime title> for exact times. One shared DeleteSubmissionDialog on ui/dialog. Chart: inline SVG inside ui/card using --chart-2, with grid lines, y ticks, sparse x labels, a per-point <title>, and a visually hidden summary for screen readers. Empty state with ui/empty. Stats math and UTC bucketing stay identical to today. CSV columns: ID, Created At (ISO 8601), then sorted data keys, same escaping as today. Switch the route in the last commit and delete the React files in that commit.
```

```
Stage 7a (Sonnet 5.5): Implement stage 7a with ui/card, ui/input, ui/label, ui/button and ui/dialog. Own only the listed files. Rename uses renameForm.for(form.id) with .as('text', form.name); Save stays disabled until the trimmed value differs. Delete uses a ui/dialog with a type-to-confirm input; the delete button is disabled until the input equals the form name. Switch the route in the last commit and delete the React file in that commit.
```

```
Stage 7b (Opus 5.5): Implement stage 7b per plan 5.1 (effect-free mapping) and the NotificationForm sketch rules: no local copies of saved values, provider derived from the email domain, testedKey/testPassed derivation, one form with intent test|save, a separate clear form whose button sits in the same row via the form attribute, {#key saved?.updated_at} around the form, ui/dialog with bind:open and {#if open} around the query. The "send a test email first" hint is a ui/tooltip plus visible helper text. Never return the stored password to the client. Own only the listed files.
```

```
Stage 8 (Qwen): Implement stage 8 commits 1 and 2 exactly as listed. Delete only the listed paths and remove only the listed packages. After each commit run typecheck, build and the full suite. Do not edit any file under src/ except deleting src/routes/[...legacy]/.
```

```
Stage 8 docs (GPT profile): Write commit 3 of stage 8: README dev and deploy sections for the SvelteKit app, keeping the Deploy to Cloudflare section and the LLM disclaimer from the readme-standards skill.
```

Review brief (GPT profile, after each Claude PR):

```
Review PR #<n> in mrgnw/formzero against docs/svelte-port/02-plan.md. Check: every remote function calls requireUser() first; no $effect; no form actions; no dependencies outside plan 6.2; no edits under src/lib/components/ui outside stage 3; public API behaviour unchanged; each commit builds and passes the suite (git rebase -x 'npm run typecheck && npm run build && npm run test:e2e' origin/main on a scratch worktree); shadcn-svelte components used where plan 5.2 says so; files touched are within the stage's ownership list. Report findings with file:line. Do not push.
```

## 9. Decisions

|ID|Question|Status|
|-|-|-|
|D1|Coexistence on `main` or rewrite on a `svelte-port` branch?|Decided: coexistence on `main`, gated by the stage 2 spike|
|D2|Sidebar collapse: icon rail or hide fully?|Default kept: hide fully (`collapsible="offcanvas"`). With shadcn-svelte, the icon rail is a one-prop change.|
|D3|Component styling: CSS classes or shadcn-svelte?|Decided: shadcn-svelte + bits-ui|
|D4|Chart: inline SVG or `layerchart`?|Default kept: inline SVG|
|D5|CSV export: server endpoint with ISO 8601 timestamps or browser export as today?|Default kept: server endpoint, ISO|
|D6|Browser support: Baseline newly available without polyfills?|Default kept: yes|
|D7|Is the port meant for upstream?|Default kept: fork only; upstream PR after stage 8 if wanted|
|D8|Ship each stage to production?|Decided: ship each stage; the coordinator asks the user before each production deploy|

## 10. Not verified

- Nothing was built or run. The catch-all design (3.1) is unproven until the stage 2 spike. Worker size is unmeasured, and bits-ui adds to it from stage 3.
- shadcn-svelte CLI 1.8.1 under Kit 3 (no `svelte.config.js`): read from the CLI bundle, it resolves aliases through `tsconfig`, which should work after `svelte-kit sync`. Not run. Registry contents and component dependencies were checked on 2026-11-15.
- nodemailer STARTTLS delivery on Workers is untested on either UI.
- Behaviour kept for parity and worth a follow-up: open redirect via `?redirect=` and referer on the public API; unbounded `SELECT` of all submissions on the dashboard; UTC day buckets and UTC timestamp tooltips; multipart file fields stored as `{}`.
