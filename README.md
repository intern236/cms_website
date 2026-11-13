# CMS Platform

One CMS for every client. Your agency signs in once and sees all clients; each
client gets its own branded workspace (their logo, their colour) with its own
team. Each client's website is a separate Next.js site that reads its content
through the **site kit**. You change the design per client and keep the CMS as it is.

```
apps/cms              the CMS: admin + content API            (Next 16, MongoDB)
packages/site-kit     what a client site imports to read the CMS
examples/acme-site    a complete client site built on the kit  (the design to copy)
```

## Run it locally

Needs Node 22.13 or newer. No database to install: `npm run dev` starts a local
MongoDB for you (a single-node replica set on port 27027, data kept in
`apps/cms/data/mongo`). The first run downloads MongoDB once, about 100 MB.

```bash
npm install
npm run setup        # writes apps/cms/.env.local with a fresh secret
npm run dev          # local MongoDB + the CMS on http://localhost:3000
```

To use your own MongoDB instead (Atlas, say), put `DATABASE_URL=mongodb+srv://…/cms`
in `apps/cms/.env.local` and `npm run dev` connects to it rather than starting one.

Open http://localhost:3000. The first visit asks you to create the agency account.
Leave **Add demo clients** on to get three sample clients (Acme, Northwind,
Halcyon) with posts, authors, enquiries and a team. It also connects the example
site for you. Then, in a second terminal:

```bash
npm run dev:site     # the Acme example site on http://localhost:3100
```

Demo client logins all use the password `demo-password-2026`:
`owner@acme.test`, `editor@acme.test`, `writer@acme.test`. The workspace sign-in
page is http://localhost:3000/acme/login.

In development no email is sent. Every invite, reset link and sign-in code goes to
**Agency → Outbox**.

## How it fits together

- **Agency.** Your team. Agency users see every client, create and archive
  clients, connect their websites, and act as owner inside any workspace.
- **Workspaces.** One per client. Each has its own address (`/acme`), sign-in
  page, logo, accent colour, posts, authors, inbox and people.
- **Roles inside a workspace:**

  | | Owner | Editor | Writer |
  |---|---|---|---|
  | Write drafts, send for review | ✓ | ✓ | ✓ (own posts only) |
  | Publish, schedule, edit anyone's post | ✓ | ✓ | |
  | Authors, inbox, activity | ✓ | ✓ | |
  | Site settings, branding, site keys, people | ✓ | | |

  A workspace always keeps at least one owner, and nobody can grant a role above
  their own. Connecting a website (its address and webhook) is agency-only.
- **Client sites** read only *published* content of *their own* workspace, using a
  secret site key. When content changes, the CMS calls the site's webhook and the
  site refreshes within seconds. Without the webhook it refreshes within 60 seconds.

## The database

The CMS runs on **MongoDB**, and is written so it can move to SQL later without
rewriting the app.

- **One data layer.** All database code lives in `apps/cms/lib/db`. The rest of the
  app calls plain methods (`posts.list`, `sessions.findActive`, …) defined in
  `lib/db/store.ts`, and never imports a database driver — a lint rule enforces it.
- **Two adapters, one test suite.** `lib/db/mongo` (used in production) and
  `lib/db/postgres` (Postgres, or PGlite in-process) both implement that contract.
  `DATABASE_URL` picks one: `mongodb://…` / `mongodb+srv://…`, `postgres://…`, or
  `pglite`. Every unit and browser test passes on both.
- **Portable data.** Collections mirror tables one-to-one with the same field
  names; ids are our own 24-character strings, not MongoDB ObjectIds; validators
  and unique indexes in `lib/db/mongo/schema.mjs` enforce the same rules as the
  Postgres columns and constraints.
- **Client isolation without row-level security.** MongoDB cannot hide rows by
  itself, so client content is only reachable through a workspace "fence"
  (`lib/db/mongo/scoped.ts`) that adds the client to every query and every
  document, inside a transaction. A test records every command sent to MongoDB and
  fails if one is not pinned to its client. On Postgres, row-level security does
  the same job in the database.
- **Fast reads.** Pages and the content API's GETs use `readWorkspace(id, …)`:
  the same fence, but with no transaction on MongoDB, so a page's lookups run in
  parallel (`Promise.all`) — one database round trip instead of five. Anything
  that writes uses `inWorkspace(id, …)`; a write through a read scope throws.

### Why it feels fast

The CMS is built so a click costs as few database round trips as possible — that
is what makes the difference when the database is far away (e.g. MongoDB Atlas in
another region).

- **No server trip at all** for settings tabs, post status filters, post search,
  and inbox folders and search: the page sends everything once and the browser
  switches.
- **One round trip per click** for the sign-in check: the session, the user and
  their memberships come back in one query, with the workspace looked up beside
  it; the result is reused for the rest of the request.
- **Parallel reads** on every page (dashboard panels, editor lists, inbox lists).
- **Pages fetched before the click.** The sidebar, the "New post" button and
  "Your account" fetch their whole page (data included) as soon as they are on
  screen; post rows, inbox rows, client cards, dashboard tiles and the workspace
  switcher fetch theirs when the pointer reaches them. The click then needs no
  server at all. Visited and fetched pages are kept for 30 seconds.
- **Never stale for long.** A page shown from that store that is more than a few
  seconds old refreshes itself in the background (`components/fresh`); the
  editor re-opens with the fresh copy. Your own saves refresh everything at once.
- **Two round trips per page, at most,** on the server: every page's lookups run
  side by side (members with their people in one query, all authors' post
  counts in one query).
- **A spinner on the clicked link** if a page still takes more than a moment.
- `tests/e2e/1b-speed.spec.ts` fails the build if a tab or filter starts asking the
  server again, if a sidebar page is not ready before the click (it cuts the
  server off and clicks), or if a page gets slow.

**Moving to SQL later** is a settings change plus a data copy: point
`DATABASE_URL` at Postgres, run `npm run db:migrate`, copy the collections into
the matching tables (same names, same fields), check record counts per client,
and switch over — keeping MongoDB read-only for a week as a fallback. The client
sites do not change: they only talk to the content API.

## Adding a client

1. **Agency → New client.** Enter the name, workspace address, website and the
   owner's email. The owner gets an invite and can then invite their own team.
2. Open the workspace's **Settings → Website & keys**. Create a site key, which is
   shown once. Then reveal the webhook secret.
3. Make the client's site: copy `examples/acme-site`, change the design (see
   below), and set its environment:

   ```bash
   CMS_URL=https://cms.your-agency.com
   CMS_SITE_KEY=cms_xxxxxxxxxx_…
   CMS_WEBHOOK_SECRET=…
   SITE_URL=https://client.com
   ```
4. Back in the CMS (as agency), set the revalidate webhook to
   `https://client.com/api/cms/revalidate` and press **Send a test**.

## Building a client site with the kit

Everything a theme needs comes from one object:

```ts
// cms.ts
import 'server-only'
import { createCms } from '@cms/site-kit'

export const cms = createCms({
  url: process.env.CMS_URL ?? '',
  key: process.env.CMS_SITE_KEY ?? '',
  siteUrl: process.env.SITE_URL,
  revalidate: 60,
})
```

| Call | Returns |
|---|---|
| `cms.site()` | name, logo, accent, social links, blog and contact settings |
| `cms.latest(n)` | the newest posts |
| `cms.blogIndex(page)` / `cms.tag(slug, page)` | a page of posts, with pagination URLs |
| `cms.post(slug)` | `{ site, post, related }` or `null` |
| `cms.preview(token)` | a draft, for the `/preview` page |
| `cms.authors()` / `cms.author(slug)` | author profiles and their posts |

Every URL is already built and every date already formatted in the client's
locale, so a theme never builds a link itself.

Ready-made routes and helpers live in `@cms/site-kit/next`:

```ts
// app/api/cms/revalidate/route.ts
export const POST = revalidateHandler({ secret: process.env.CMS_WEBHOOK_SECRET })
// app/api/contact/route.ts      (forwards the form with the key, never exposing it)
export const POST = contactHandler(cms)
// app/feed.xml/route.ts
export const GET = feedHandler(cms)
// app/sitemap.ts
export default () => sitemapEntries(cms, ['/', '/contact'])
```

You also get `rootMetadata`, `postMetadata`, `blogMetadata`, `tagMetadata` and
`authorMetadata` for SEO. `@cms/site-kit/ui` has the JSON-LD schemas, the safe
renderer for HTML-page posts (`HtmlPage`, `PostHtml`) and `useContactForm`.

**To restyle for a client**, change `examples/acme-site/theme/` and
`app/globals.css`. Leave `app/` routes and `cms.ts` alone. The client's
accent colour from the CMS arrives as the CSS variable `--accent`.
`examples/acme-site/DESIGN.md` explains the example's design.

If the CMS cannot be reached while a site builds, the build still succeeds. The
affected pages render on their first request instead of being prebuilt with
placeholder content.

## Deploying

### The CMS

Any Node host works: Vercel, Railway, Render, Fly or a VM. It needs a current
MongoDB (tested on 8.2) **running as a replica set**, because several steps are
all-or-nothing transactions. MongoDB Atlas is always a replica set, including its free tier; a
self-hosted MongoDB must be started with `--replSet`.

```bash
npm run build
npm start            # brings the database up to date (scripts/migrate.mjs), then next start
```

Set these environment variables (`apps/cms/.env.example` lists them all):

| Variable | |
|---|---|
| `CMS_URL` | its public address, e.g. `https://cms.your-agency.com` |
| `CMS_SECRET` | 32+ random characters: `openssl rand -base64 32` |
| `DATABASE_URL` | `mongodb+srv://user:password@cluster…mongodb.net/cms` (the path names the database) |
| `CMS_SETUP_TOKEN` | needed to create the first account at `/setup` |
| `SMTP_*`, `MAIL_FROM` | for real email (invites, resets, sign-in codes, enquiries) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | image uploads |
| `TRUSTED_PROXY_COUNT` | proxies in front of the app, for correct rate limiting |

On MongoDB the CMS also checks its collections, validators and indexes every time
it starts, so on a host where `npm start` is not used (Vercel) nothing else is
needed. A database user with `readWrite` on the CMS's database is enough to run
it; an upgrade that changes the collection rules also needs `dbAdmin` (without it
the CMS keeps working and logs a warning).

**On Postgres instead:** set `DATABASE_URL=postgres://…?sslmode=require` (Postgres 14+).
The database user needs `CREATEROLE` for the first migration, which creates the
restricted `cms_app` role that row-level security runs as. On hosts without
`npm start`, run `npm run db:migrate` in the release step or set `CMS_AUTO_MIGRATE=true`.

### A client site

Deploy it like any Next.js app (Vercel is simplest), with the four variables from
"Adding a client". `TRUSTED_PROXY_COUNT` (default 1) is used for the contact
form's rate limit.

## Tests

```bash
npm test                # 325 unit and integration tests, on a throwaway MongoDB
npm run test:postgres   # the same tests on Postgres (PGlite, in-process)
npm run test:e2e        # builds both apps, then 23 browser tests across CMS + site
npm run typecheck && npm run lint
```

The unit suite covers permissions, client isolation (the MongoDB fence and
Postgres row-level security), the content API, the sanitiser (a large XSS
corpus), auth, rate limits, webhooks and SSRF. The end-to-end suite walks the
whole product in a real browser, in production mode:

- setup with a token, then creating a client and inviting a team;
- a writer sends a post for review and an editor publishes it;
- the post appears on the live site, and an edit reaches the site through the webhook;
- the contact form lands in the inbox, which exports to CSV;
- preview links work;
- cross-client URLs return 404;
- security headers, session revocation and forged webhooks;
- a hostile HTML post, and login lockout;
- speed budgets: tabs and filters switch with no server trip, pages answer quickly.

The browser tests run on a throwaway MongoDB by default. To point either suite
elsewhere (Mac/Linux syntax; in PowerShell set `$env:NAME="…"` first):

```bash
TEST_MONGO_URL=mongodb://…/?replicaSet=…  npm test                   # an existing replica set
TEST_DB=postgres TEST_POSTGRES_URL=postgres://user:pw@host/postgres npx vitest run   # user needs CREATEDB, CREATEROLE
E2E_DATABASE_URL=postgres://user:pw@host/cms_e2e npm run test:e2e   # any empty database, or "pglite"
```

See [SECURITY.md](SECURITY.md) for the threat model and what each defence covers.
#   c m s _ w e b s i t e  
 