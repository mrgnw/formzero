<h1 align="center">FormZero</h1>

<div align="center">
	A free, open-source form backend for static sites you can self-host on Cloudflare
	<br/>
	<br/>
	<em>No paid features. Own your data.</em>
</div>

> [!NOTE]
> This project was built with heavy LLM assistance and should be considered proof-of-concept. Contributions are welcome, but I can't guarantee the accuracy of the code or that I will continue to maintain it. If there are any mistakes in attribution or anything else, please let me know.

![FormZero Dashboard](media/screenshot.png)

For contact forms, waitlists, surveys, newsletter signups, and more.

This is the SvelteKit fork of [Bohdan Petryshyn's FormZero](https://github.com/BohdanPetryshyn/formzero).

## Why FormZero?

- **Save time** - Connect your static site's forms to an existing backend.
- **Own your data** - Store submissions in your Cloudflare account and export them as CSV.
- **Self-host** - Deploy a Worker and D1 database from this repository.

## Features

- **HTML forms** - Add your form's submission endpoint to its `action` attribute.
- **JSON submissions** - Send data from JavaScript or another HTTP client.
- **Multiple forms** - Manage forms and submissions from one dashboard.
- **Analytics dashboard** - View submission trends and stats.
- **CSV export** - Download submissions for a form.
- **Email notifications** - Configure Simple Mail Transfer Protocol (SMTP) credentials in notification settings.

FormZero has no application-level submission quota. Capacity depends on your [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

## Deploy to Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mrgnw/formzero)

1. Click **Deploy to Cloudflare** and sign in to your Cloudflare account.
2. Follow the prompts to copy the repository, configure the Worker and D1 database, and set `BETTER_AUTH_SECRET` to a random secret of at least 32 characters.
3. Open the deployed URL, create the first account, and create your first form. Further signups are disabled once an account exists.

See [Cloudflare's deploy button documentation](https://developers.cloudflare.com/workers/platform/deploy-buttons/) for the deployment flow.

For manual deployment, install dependencies as described below, then set the Worker name and your own D1 database name and ID in `wrangler.jsonc`. Keep the database binding named `DB`. Configure `BETTER_AUTH_SECRET` as a Worker secret and authenticate Wrangler with your Cloudflare account before deploying. Run production deploys from a clean, fully pushed `main` checkout.

```sh
npm run deploy
```

The deploy script builds the app, applies remote D1 migrations, and deploys the Worker. When updating an existing instance, keep its Worker name, D1 database, database binding, and auth secret to preserve endpoint URLs, data, and session signing. Back up the database before applying migrations.

## Submit data

Create a form in the dashboard and open its **Integration** page. Copy the endpoint and integration example for your site.

- For an HTML form, set `method="POST"` and set `action` to the copied endpoint. Give each submitted input a `name`.
- For JavaScript, send a POST request to the endpoint with `Content-Type: application/json` and a JSON body.
- URL-encoded and multipart form submissions are also accepted. Uploaded file contents are not stored; file fields are currently serialized as empty objects.

The submission API accepts requests from other origins without a dashboard session. Successful JSON requests, or successful requests with `Accept: application/json`, receive a `201` response containing `success: true` and the submission `id`.

Successful HTML submissions redirect to the endpoint's `redirect` query parameter when supplied, otherwise to the referring page, or to `/success` if neither is present. Use your site's thank-you page as the redirect URL.

## Tech stack

- SvelteKit 3 and Svelte 5, with remote functions for application queries and mutations.
- Tailwind CSS 4 and shadcn-svelte components.
- better-auth for authentication.
- Cloudflare Workers and D1 for hosting and storage.
- Vite 8, TypeScript 6, and Playwright for tooling and end-to-end tests.

## Local development

Use Node.js 22.17 or newer and npm. `.node-version` selects Node 22; use an up-to-date release in that line. SvelteKit 3 requires Node 22.17 or newer, Vite 8, and TypeScript 6. The required package versions are declared in `package.json` and locked in `package-lock.json`.

Install dependencies from the repository root:

```sh
npm ci
```

Create an ignored `.dev.vars` file in the repository root. Set this value to a random secret of at least 32 characters:

```dotenv
BETTER_AUTH_SECRET=
```

Apply migrations to the local D1 database:

```sh
npm run migrate -- --local
```

Start the app:

```sh
npm run dev
```

Open http://localhost:5473. The dev script builds the SvelteKit app and then serves it with Wrangler on the fixed port 5473. Restart it after source changes to rebuild. Local D1 data lives under `.wrangler/` and is separate from the remote database.

Create the first account through signup, then create a form. For optional sample submissions, seed the local database once after applying migrations:

```sh
npm run seed -- --local
```

The seed inserts a test form and submissions with fixed IDs. Repeating it can fail on duplicate IDs.

## Build and checks

Build the Cloudflare Worker and static assets into `.svelte-kit/cloudflare/`:

```sh
npm run build
```

Generate Cloudflare binding types, sync SvelteKit, and check Svelte and TypeScript with warnings treated as failures:

```sh
npm run typecheck
```

Install the Chromium browser used by Playwright:

```sh
npx playwright install chromium
```

Run the end-to-end suite:

```sh
npm run test:e2e
```

Playwright builds the app, resets and migrates its own local D1 database in `.wrangler/e2e`, and starts Wrangler with a test-only auth secret. It does not reuse an existing server. Stop the development server first, or select a separate port with `E2E_PORT`:

```sh
E2E_PORT=5474 npm run test:e2e
```

The suite covers signup and login, the dashboard, submission API contracts, CSV exports, and cross-site request checks.

## Add UI components

Use the shadcn-svelte CLI version declared in `package.json`. For example, to add the checkbox component:

```sh
npx shadcn-svelte@1.8.1 add checkbox
```

The CLI reads `components.json` and copies component source into `src/lib/components/ui/`.

## Project layout

|Path|Contents|
|-|-|
|`src/routes/`|SvelteKit pages, layouts, the public submission API, and CSV export route|
|`src/lib/server/`|Server-only authentication, database queries, submissions, and email delivery|
|`src/lib/*.remote.ts`|Remote functions for authentication, forms, settings, and submissions|
|`src/lib/components/`|Application components|
|`src/lib/components/ui/`|shadcn-svelte component source|
|`src/hooks.server.ts`|Session handling, better-auth integration, and cross-site write checks|
|`src/app.css`|Tailwind styles and theme tokens|
|`static/`|Favicons and other static assets|
|`migrations/`|D1 SQL migrations|
|`seed.sql`|Optional local sample data|
|`tests/`|Playwright tests and isolated database setup|
|`vite.config.ts`|SvelteKit, Cloudflare adapter, remote functions, and Tailwind configuration|
|`wrangler.jsonc`|Worker configuration and D1 binding|

## Contributing

Contributions are welcome. Open an issue or pull request in [this fork](https://github.com/mrgnw/formzero). Run the typecheck and end-to-end checks before submitting code changes.

## License

[MIT](LICENSE)
