# FormZero: React Router 7 to SvelteKit port, analysis

Status: analysis only, no code ported. Written 2026-11-15 against `origin/main` at `c26c843`.

## Verdict

Go. The app is small: 13 routes, 5 app components, 16 shadcn components, about 2,600 lines of non-generated TSX. All server logic is plain D1 SQL plus better-auth, which already ships a SvelteKit integration. Every React-only dependency has a current Svelte 5 replacement or can be dropped.

Recommended approach: a contract-tested rewrite on one branch (option C below). The React app stays in production until a single cut-over deploy. Running both UIs side by side costs more glue code than the port itself, and it breaks the one-Worker Deploy to Cloudflare button.

Estimated size: 3 to 5 agent-days in total. Stages 3 to 6 can run in parallel.

## 1. Codebase inventory

### Runtime and build

|File|What it does|Port impact|
|-|-|-|
|`wrangler.jsonc`|One Worker, `main: ./workers/app.ts`, D1 binding `DB`, `nodejs_compat`, compat date 2025-04-04|Rewritten: `main` and `assets` point at adapter output. D1 block unchanged.|
|`workers/app.ts`|Wraps the React Router request handler and passes `{cloudflare: {env, ctx}}`|Deleted. SvelteKit exposes `event.platform.env` and `event.platform.ctx`.|
|`vite.config.ts`, `react-router.config.ts`|`@cloudflare/vite-plugin`, Tailwind 4, React Router SSR|Replaced with `sveltekit()` + Tailwind 4. `svelte.config.js` uses `adapter-cloudflare`.|
|`app/entry.server.tsx`|React streaming SSR, `isbot`|Deleted. SvelteKit handles SSR.|
|`package.json` `cloudflare.bindings`|Deploy button prompts for `BETTER_AUTH_SECRET`|Kept verbatim. Script names `build`, `deploy`, `migrate` stay the same so the deploy button keeps working.|
|`better-auth/config.ts`|CLI-only config for schema generation against local SQLite|Kept unchanged.|
|`components.json`|shadcn config|Replaced by the shadcn-svelte `components.json`.|

No tests exist. `app/routes/settings.notifications.test.tsx` is a route (`POST /settings/notifications/test`), not a test file. `app/welcome/` is dead code with no importers.

### Routes

|URL|File|Server logic|UI|Mutation transport today|
|-|-|-|-|-|
|`/`|`home.tsx`|Session check, then redirect to `/forms` or `/login`|none|none|
|`/login`|`login.tsx`|Loader: redirect if logged in, redirect to `/signup` if there are 0 users|Email and password form|`clientAction` calls the better-auth client in the browser|
|`/signup`|`signup.tsx`|Loader: redirect if logged in or if more than 0 users|4-field form, client-side password match|`clientAction` calls the better-auth client|
|`/logout`|`logout.tsx`|none|none|`clientAction` calls `authClient.signOut()`|
|`/setup`|`setup.tsx`|Auth check. Redirects to `/forms` if any form exists.|Create-first-form form|`useFetcher` POST to the `/forms` action|
|`/forms` (layout)|`forms.tsx`|`requireAuth`, list forms, redirect to `/setup` or to the first form. Action: create form (slug from name).|Sidebar shell|server action|
|`/forms/:formId` (layout)|`forms.$formId.tsx`|`requireAuth`, load form, redirect bare path to `/submissions`|Header, breadcrumb, sidebar trigger|none|
|`/forms/:formId/submissions`|`forms.$formId.submissions.tsx` + `columns.tsx` + `data-table.tsx`|Loads every submission, computes week and month trends and 30-day buckets in JS|Stat tiles, recharts line chart, TanStack table with search and sort, CSV export, empty state|none|
|`/forms/:formId/submissions/:submissionId`|`...submissions.$submissionId.tsx`|`DELETE` a submission|none|`useFetcher` `DELETE` from a row dialog|
|`/forms/:formId/integration`|`forms.$formId.integration.tsx`|none, pure UI|Endpoint copy, redirect URL input, 5 code tabs highlighted by `prism-react-renderer`|none|
|`/forms/:formId/settings`|`forms.$formId.settings.tsx`|Load form. `POST` renames, `DELETE` deletes.|Rename card, danger zone, type-to-confirm dialog|`useFetcher`|
|`/settings/notifications`|`settings.notifications.tsx`|Loader returns the whole `settings` row. `POST` upserts, `DELETE` clears.|none (resource route)|`useFetcher` from the settings dialog|
|`/settings/notifications/test`|`settings.notifications.test.tsx`|Sends a test email via nodemailer|none|`useFetcher`|
|`/api/auth/*`|`api.auth.$.tsx`|better-auth handler plus a single-user signup guard (403 when a user exists)|none|external|
|`/api/forms/:formId/submissions`|`api.forms.$formId.submissions.tsx`|Public API. CORS `*`. JSON or form body. Inserts the row, emails in `waitUntil`. Returns JSON 201, or a 303 redirect to `?redirect`, the referer, or `/success`.|none|external, cross-origin|
|`/success`, `/error`|`success.tsx`, `error.tsx`|`/error` maps `?error=` to a message|Static cards|none|

### App components

|Component|Notes for the port|
|-|-|
|`app-sidebar.tsx`|Footer user menu. Lazy-loads settings with `useEffect` + `fetcher.load` when the dialog opens. Logout via fetcher.|
|`form-switcher.tsx`|Dropdown of forms plus a create-form dialog. Closes the dialog with an effect on pathname change.|
|`form-nav.tsx`|3 links using `NavLink`.|
|`settings-dialog.tsx` (350 lines)|SMTP form. 6 `useEffect`s: a debounced provider autodetect, test-passed gating, and a reset after clear. Most of the porting judgment goes here.|
|`result-button.tsx`|Shows a "Saved!" state for 2 s via an effect timer.|
|`theme-provider.tsx`|`next-themes` with `defaultTheme="system"`. No `setTheme` caller exists, so there is no theme toggle.|

### shadcn components actually used

`button`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `separator`, `sidebar` (pulls in `sheet`, `skeleton`, `tooltip`, `use-mobile`), `table`, `tabs`, `tooltip`, `breadcrumb`, `empty`, `chart`.
Present but unused: `alert`, `avatar`, `collapsible`.

All of them exist in the shadcn-svelte registry, checked on 2026-11-15: `button card dialog dropdown-menu input label separator sidebar sheet skeleton table tabs tooltip breadcrumb empty chart`.

### Dependencies and replacements

Versions checked with `npm view` on 2026-11-15.

|React-side dependency|Used for|Replacement|Version|
|-|-|-|-|
|`react`, `react-dom`, `react-router`, `@react-router/dev`, `isbot`|framework|`svelte`, `@sveltejs/kit`, `@sveltejs/vite-plugin-svelte`|5.57.3, 3.2.0, ^7|
|`@cloudflare/vite-plugin` + `workers/app.ts`|Workers runtime in dev and build|`@sveltejs/adapter-cloudflare` (dev bindings via wrangler `getPlatformProxy`)|8.0.2|
|`@radix-ui/*` (9 packages)|shadcn primitives|`bits-ui` via `shadcn-svelte` CLI|2.21.0 / 1.8.1|
|`lucide-react`|26 icons|`@lucide/svelte`|1.73.0|
|`@tanstack/react-table`|Sort on 2 columns plus row rendering|Drop it: `$derived` sort and filter, about 25 lines. (`@tanstack/svelte-table` 9.3.2 exists if needed later.)|-|
|`recharts` + `ui/chart.tsx`|One 30-point line chart with tooltip|shadcn-svelte `chart` (`layerchart`)|2.10.1|
|`prism-react-renderer`|Live-highlighted snippets that depend on the redirect URL input|`prismjs`: `Prism.highlight()` in a `$derived`, rendered with `{@html}`. Highlighting must stay client-side because snippets change as the user types.|1.30.0|
|`next-themes`|System dark mode only|Drop it: Tailwind `@custom-variant dark (@media (prefers-color-scheme: dark))`. `mode-watcher` 1.1.0 is only needed if a toggle is added later.|-|
|`better-auth/react` client|Sign in, sign up, sign out in the browser|Server-side `auth.api.signInEmail` / `signUpEmail` / `signOut` inside remote `form()`s, with the `sveltekitCookies` plugin. No auth client bundle.|better-auth exports `./svelte-kit` (`svelteKitHandler`, `sveltekitCookies`)|
|`class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`|styling utils|Same packages, used by shadcn-svelte (`tailwind-variants` replaces `cva` in shadcn-svelte)|-|
|`date-fns`, `nodemailer`, `kysely-d1`, `better-auth`, `better-sqlite3`, `dotenv-cli`|framework-free|Kept|-|

Toolchain jump: SvelteKit 3.2 requires `vite ^8` and `typescript ^6`. The React app is on Vite 7 and TS 5.9. Both projects therefore cannot share one `package.json` without first moving React Router to Vite 8, which `@react-router/dev` 7.18 allows. This is a further cost of options A and B.

## 2. Shared untouched vs rewritten

### Shared as-is

- `migrations/*.sql`, `seed.sql`, D1 binding name `DB`, database id. There is no schema change, and sessions, forms and submissions carry over.
- `app/lib/email.server.ts` (pure nodemailer + string templates). It moves to `src/lib/server/email.ts` unchanged.
- `app/lib/auth.server.ts` (`getAuth`, `getUserCount`). The only change is adding `plugins: [sveltekitCookies(getRequestEvent)]` at cut-over.
- `app/types/*.ts`.
- `better-auth/config.ts`, `public/*` (favicons, manifest). SvelteKit serves them from `static/`.
- `app/app.css` theme tokens (`@theme inline`, `:root`, `.dark`). shadcn-svelte uses the same OKLCH variable names.

### Made shareable first (stage 1, on React, before any Svelte)

Extract the logic from route modules into framework-free functions that take `(db, input)` or `(request, env, ctx)` and return plain data or a `Response`:

- `src/lib/server/submissions-api.ts`: `handleSubmission(request, formId, env, ctx): Promise<Response>` and `handleSubmissionPreflight()`. This is the whole public API, CORS included. React Router and SvelteKit each wrap it in a few lines, so the public contract is literally the same code.
- `src/lib/server/forms.ts`: `listForms`, `getForm`, `createForm`, `renameForm`, `deleteForm`, `deleteSubmission`, `listSubmissions`, `submissionStats`.
- `src/lib/server/settings.ts`: `getSettings`, `saveSettings`, `clearSettings`.
- The single-user signup guard moves from `api.auth.$.tsx` into better-auth `hooks.before` inside `getAuth`. It then applies to every caller, including server-side `auth.api.signUpEmail`.

### Rewritten

All `.tsx` UI (routes, app components, shadcn copies), `root.tsx`, `entry.server.tsx`, `workers/app.ts`, `auth.client.ts`, `require-auth.server.ts` (becomes a `hooks.server.ts` + `requireUser()` helper), and the build config.

## 3. Port designs evaluated

### A. Big-bang rewrite on a branch

Replace the toolchain and port every route on one branch, then deploy once.
Pros: no glue, one build. Cons: no safety net, because there are no tests and parity is checked by eye.

### B. Staged coexistence, React and Svelte live together

B1, one Worker: two Vite projects (`apps/react`, `apps/svelte`) and a hand-written entry Worker that imports both server builds and dispatches by path. Assets are merged into one directory: React Router uses `/assets/*`, SvelteKit uses `/_app/*`.
B2, two Workers: SvelteKit is the front Worker and forwards unported paths to the React Worker through a service binding.

What both variants share:
- Auth cookies. Both UIs call the same `getAuth` against the same D1 tables with the same `BETTER_AUTH_SECRET` and the same default cookie name, `better-auth.session_token`. Sessions carry across with no work, on the same origin.
- Public API. It lives on whichever side owns `/api/forms/*`. With the stage-1 extraction it is the same function either way.
- Static assets. In B1 the asset directories must be merged and `public/` deduplicated. In B2 each Worker serves its own.

Why B is rejected:
- Throwaway glue: a dispatcher Worker, a merged assets step, two Tailwind builds kept visually in sync, and a Vite 8 / TS 6 upgrade of the React app just to share a lockfile. That glue is roughly the size of porting 3 or 4 of the 13 routes.
- B2 needs two Workers and a service binding. The Deploy to Cloudflare button deploys one Worker from one repo, so every self-hoster's update path would break mid-migration.
- Navigation between the two UIs reloads the page, and the sidebar layout would exist twice during the migration.
- The app is small enough that coexistence never pays back.

### C. Recommended: contract-tested rewrite with a shared server core

1. On `main`, still React: add a Playwright and API contract suite, and extract server logic into framework-free modules (section 2). Each piece ships to production and is useful on its own.
2. On a `svelte-port` branch: replace the toolchain, then port routes. Every stage is preview-deployed (`wrangler versions upload`) against a preview D1 and must pass the same suite.
3. Cut over with one merge and one production deploy. Rollback is `wrangler rollback`, because the schema and cookies are unchanged.

This keeps the safety of B (the same tests gate both UIs, sessions survive, the API is byte-identical) without B's glue.

Per-stage shippability: stages 0 to 2 ship to production on React. Stages 3 to 7 ship as previews. Each preview is a working app for every route ported so far, and links to unported routes 404 until their stage lands. Production gets Svelte only at stage 8.

## 4. Target design (SvelteKit)

- `svelte.config.js`: `adapter-cloudflare`, the `remoteFunctions` experimental flag (still opt-in in Kit 3.2), and `csrf.trustedOrigins: ['*']` (see below).
- `wrangler.jsonc`: `main: .svelte-kit/cloudflare/_worker.js`, `assets: { binding: "ASSETS", directory: ".svelte-kit/cloudflare" }`, same D1 block, same `compatibility_flags`. Keep compat date 2025-04-04 or later, because `nodejs_compat` populates `process.env` for `BETTER_AUTH_SECRET` from 2025-04-01.
- `src/hooks.server.ts`: build `auth` per request from `event.platform.env.DB`, put `user` on `event.locals` via `auth.api.getSession`, and delegate `/api/auth/*` to `svelteKitHandler`.
- The public API lives in `src/routes/api/forms/[formId]/submissions/+server.ts`: `POST` and `OPTIONS` call the shared handler, and `fallback` returns 405 with CORS headers.

CSRF, which is critical: SvelteKit rejects cross-origin form-encoded `POST`s with 403 before `hooks.handle` runs (`internal_respond` in `@sveltejs/kit/src/runtime/server/respond.js`). Plain HTML forms posting from customer sites would break. The fix is `csrf.trustedOrigins: ['*']`, which compiles the origin check out. That is safe here only because:
- every app mutation is a remote function, and remote functions keep their own same-origin check, which ignores `trustedOrigins`;
- `/api/auth/*` keeps better-auth's own origin check;
- there are no `+page.server.ts` form actions.

Rule for the port: no form actions. All mutations go through `form()` / `command()`.

### Route mapping

|Route|SvelteKit|
|-|-|
|`/`|`src/routes/+page.server.ts` redirect|
|`/login`, `/signup`|`+page.server.ts` load for redirects. A remote `form()` in `auth.remote.ts` calls `auth.api.signInEmail` / `signUpEmail`. Works without JS.|
|`/logout`|`form()` in the user menu (a `<form>` button, no JS needed)|
|`/setup`, create form|`createForm` remote `form()` in `forms.remote.ts`, used by `/setup` and the switcher dialog. Redirects on success.|
|`/forms` layout|`(app)/forms/+layout.server.ts` loads `forms` and `user`. The `+page.server.ts` at `/forms` redirects.|
|`/forms/[formId]` layout|`+layout.server.ts` loads the form or throws `error(404)`. The header crumb label comes from `page.url`.|
|submissions|`+page.server.ts` load (submissions, stats, chart). `deleteSubmission` is a `command()` followed by `invalidateAll()`. Search and sort use `$state` + `$derived`. CSV is built client-side from page data, as today.|
|integration|`+page.svelte` only. The endpoint uses `page.url.origin`, which is correct during SSR, unlike today's `window` check.|
|form settings|`renameForm` `form()`, `deleteForm` `command()` then `goto('/forms')`|
|notification settings|`getSettings` `query()` awaited inside the dialog (`{#await}`), so there is no effect-driven lazy load. `saveSettings` `form()`, `testEmail` `command()`, `clearSettings` `command()`.|
|`/success`, `/error`|`+page.svelte`. `/error` reads `page.url.searchParams`.|

### Effect-free rewrites of the React effects

|React effect|Svelte 5 without `$effect`|
|-|-|
|Settings lazy load on dialog open|`{#if open}{#await getSettings() then s}<SettingsForm {s}/>{/await}{/if}`. The form mounts with its data, so no sync effect is needed.|
|`setName(form.name)` when data changes|`{#key form.id}` around the form, or a writable `$derived`|
|Debounced SMTP autodetect|Derive the provider from the email domain (`$derived`), and fill host and port in the `oninput` handler. No debounce needed.|
|Reset "test passed" when fields change|`testedFor = $state(snapshot)`; `testPassed = $derived(testedFor === currentSnapshot)`|
|Close the switcher dialog on navigation|Close it in the remote form's success callback (`enhance`)|
|`ResultButton` 2-second flash|`setTimeout` in the submit handler, or a CSS animation on a `data-saved` attribute|
|`useIsMobile`|bits-ui sidebar ships `IsMobile` (runed `MediaQuery`). Prefer CSS breakpoints where only layout changes.|

### Native-first swaps

- Exact-time tooltip on relative timestamps: `<time datetime title>`.
- "Send a test email first" tooltip on a disabled button: show it as helper text under the buttons, because disabled buttons don't fire hover events reliably anyway.
- Confirm dialogs (delete submission, delete form): native `<dialog>` with `showModal()`. Keep the shadcn-svelte `Dialog` for the large settings dialog and create-form only if visual parity demands it.
- Keep shadcn-svelte `DropdownMenu` and `Sidebar`: menu keyboard semantics and collapsible icon rail are real work to rebuild natively.

## 5. Stage plan

Fixed ports: `5473` for the Svelte dev and preview server, `5474` for the React baseline server used by tests. Neither was in use on 2026-11-15. Check with `lsof -ti :5473` first. Stop any server you start.

Verification for every stage:

```sh
npm run typecheck
npm run build
npx playwright test
```

Playwright runs against `wrangler dev --port 5473` (or `5474` for React) with a local D1 seeded by `npm run migrate && npm run seed`.

### Stage 0: safety fixes (main, React, sequential, ships to prod)

Pre-existing bugs found during the read. Fix them before the port so both UIs share the corrected behaviour.

1. `fix: require auth on notification settings loader`. `settings.notifications.tsx` `loader` has no `requireAuth`, so an unauthenticated `GET /settings/notifications` (a resource route, so the loader response is returned directly) returns the SMTP password.
2. `fix: stop sending SMTP password to the browser`. Return a `has_password` flag, and keep the stored password when the field is left blank.
3. `fix: 404 for unknown form id`. `forms.$formId.tsx` renders `null.name` and crashes.
4. `fix: reject form names that produce an empty slug`. A name like `"!!!"` becomes the id `""`.

Size: S (about 2 hours). Verify: manual curl for item 1, typecheck, build.

### Stage 1: contract tests on React (main, sequential, ships to prod)

1. `test: add playwright config on port 5474 with seeded local D1`
2. `test: public submission API contract`: JSON 201 + `{success,id}`; form-urlencoded and multipart 303 to `?redirect`, then referer, then `/success`; 404, 415, 405 paths; `OPTIONS` 204 with the exact CORS headers; a cross-origin `Origin` header on form posts.
3. `test: auth flows`: first-user signup, the second signup gets 403 `SIGNUP_DISABLED`, login, logout, redirects for `/`, `/login`, `/signup`, `/setup`, `/forms`.
4. `test: dashboard flows`: create form, see submission, search, sort, CSV download, delete submission, rename, delete form, integration copy, settings dialog save and clear (SMTP mocked by asserting the request, not delivery).

Size: M (about 1 day). This suite is the parity gate for every later stage.

### Stage 2: framework-free server core (main, sequential, ships to prod)

1. `refactor: extract submission API handler to framework-free module`
2. `refactor: extract form and submission queries`
3. `refactor: extract settings queries`
4. `refactor: move single-user signup guard into better-auth hooks`

React routes become thin wrappers. Size: S-M (about half a day). Verify: the stage 1 suite stays green.

### Stage 3: SvelteKit skeleton (branch `svelte-port`, sequential, preview)

1. `build: replace react-router toolchain with sveltekit and adapter-cloudflare` (vite 8, TS 6, wrangler `main`/`assets`, keep script names and the `cloudflare.bindings` block)
2. `feat: hooks with better-auth session and /api/auth handler`
3. `feat: public submission API route on shared handler` (with `csrf.trustedOrigins: ['*']`)
4. `feat: success and error pages`
5. `feat: shadcn-svelte init and component set` (button, card, dialog, dropdown-menu, input, label, separator, sidebar, table, tabs, breadcrumb, empty, chart) plus theme tokens and `prefers-color-scheme` dark mode
6. `feat: login, signup, logout via remote forms`

After this stage, a preview already runs the production-critical half of the app: the public API and auth. API and auth contract tests pass. Size: M (about 1 day). Sequential because every later stage depends on it.

### Stage 4: app shell (sequential, preview)

1. `feat: forms layout with sidebar, form switcher, form nav, user menu`
2. `feat: create form remote form shared by /setup and switcher`
3. `feat: form layout header and breadcrumb, 404 for unknown form`

Size: M (half a day to a day). Stages 5 to 7 depend on this layout.

### Stages 5 to 7: route ports (parallel, one agent each, separate worktrees off `svelte-port`, preview)

|Stage|Commits|Size|
|-|-|-|
|5. Submissions|`feat: submissions load and stat tiles`; `feat: 30-day chart with layerchart`; `feat: submissions table with search and sort`; `feat: delete submission command`; `feat: csv export`|M (about 1 day)|
|6. Integration|`feat: integration page with endpoint copy and redirect input`; `feat: prism highlighted snippet tabs`|S (half a day)|
|7. Settings|`feat: form rename and delete`; `feat: notification settings dialog with query and remote forms`; `feat: test email command`|M (about 1 day; the settings dialog is the riskiest UI)|

These stages touch disjoint route directories. Shared files (`forms.remote.ts`, the `lib/components` additions) are created in stage 4, so merge conflicts should be limited to import lines. Each agent rebases on `svelte-port` and passes its slice of the Playwright suite before merging into it.

### Stage 8: cut-over (sequential, ships to prod)

1. `chore: remove react, radix, recharts, tanstack, next-themes, prism-react-renderer deps`
2. `chore: delete app/ react tree and workers/app.ts`
3. `docs: update README dev instructions and deploy notes`

Then the full suite runs on a preview against a copy of production D1 (`wrangler d1 export` into a preview DB). Visual check of every route against React screenshots taken in stage 1. Merge `svelte-port` through a PR, then deploy from `main`. Rollback: `wrangler rollback` to the last React version. No schema or cookie change, so sessions survive in both directions. Size: S.

### Ordering summary

|Stage|Branch|Parallel?|Ships to|
|-|-|-|-|
|0 fixes|main|no|prod|
|1 tests|main|stages 0 and 1 can run in parallel|prod|
|2 core extract|main|after 1|prod|
|3 skeleton|svelte-port|after 2|preview|
|4 shell|svelte-port|after 3|preview|
|5 submissions|svelte-port|yes, with 6 and 7|preview|
|6 integration|svelte-port|yes|preview|
|7 settings|svelte-port|yes|preview|
|8 cut-over|svelte-port, then main|after 5 to 7|prod|

## 6. Risks and unknowns

|Risk|Impact|Mitigation|
|-|-|-|
|SvelteKit CSRF blocks cross-origin HTML form posts to the public API|Every customer site's form breaks|`trustedOrigins: ['*']` + the no-form-actions rule. A Playwright test posts with a foreign `Origin`. Verified in Kit 3.2 source, not yet run.|
|Remote functions are still `experimental` in Kit 3.2|API churn on upgrade|Pin the Kit minor version. The surface used is small (`form`, `command`, `query`).|
|`nodemailer` on Workers via `nodejs_compat` under the new bundler|Email notifications silently fail (they run in `waitUntil`, errors are only logged)|Stage 3 smoke test: send a test email on the preview. Unverified today on either UI.|
|better-auth server-side sign-in must set cookies through `sveltekitCookies`|Login appears to succeed but no session|Contract test asserts a `Set-Cookie` header and an authenticated `/forms`.|
|Deploy to Cloudflare button build|Self-hoster deploys fail|Keep the `build`/`deploy` script names, `wrangler.jsonc` at the root, and `cloudflare.bindings`. Test the button against the fork before stage 8.|
|Vite 8 / TS 6 / Kit 3 jump at once|Typecheck noise|Isolated in stage 3, commit 1. Nothing else changes in that commit.|
|Visual parity (sidebar collapse, chart styling)|Cosmetic regressions|Screenshots from stage 1 are the reference. Same theme tokens.|
|Unbounded `SELECT` of all submissions on the dashboard|Slow page, Worker CPU limit at large volumes|Out of scope for parity. Follow-up: SQL aggregation + pagination, cheap after stage 2.|
|Open redirect via `?redirect=` and referer on the public API|Existing behaviour that customers depend on|Keep it for compatibility. Document it.|

Unverified in this analysis: nothing was built or run. Package versions, registry contents, the CSRF code path and the better-auth SvelteKit exports were read from published packages. The Playwright ports, Worker bundle size and nodemailer-on-Workers behaviour need stage 1 and stage 3 to confirm.
