# CMS Platform

One CMS for every client. Your agency signs in once and sees all clients; each
client gets its own branded workspace (their logo, their colour) with its own
team. Each client's website is a separate Next.js site that reads its content
through the **site kit**. You change the design per client and keep the CMS as it is.

```
apps/cms              the CMS: admin + content API            (Next 16, Postgres)
packages/site-kit     what a client site imports to read the CMS
examples/acme-site    a complete client site built on the kit  (the design to copy)
```

## Run it locally

Needs Node 22.13 or newer. No database to install: locally the CMS uses PGlite,
a real Postgres running in-process, kept in `apps/cms/data/pglite`.

```bash
npm install
npm run setup        # writes apps/cms/.env.local with a fresh secret
npm run dev          # CMS on http://localhost:3000
```

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

Any Node host works: Vercel, Railway, Render, Fly or a VM. It needs Postgres 14
or newer (Neon, Supabase, RDS and so on).

```bash
npm run build
npm start            # runs migrations (scripts/migrate.mjs), then next start
```

Set these environment variables (`apps/cms/.env.example` lists them all):

| Variable | |
|---|---|
| `CMS_URL` | its public address, e.g. `https://cms.your-agency.com` |
| `CMS_SECRET` | 32+ random characters: `openssl rand -base64 32` |
| `DATABASE_URL` | `postgres://…?sslmode=require` |
| `CMS_SETUP_TOKEN` | needed to create the first account at `/setup` |
| `SMTP_*`, `MAIL_FROM` | for real email (invites, resets, sign-in codes, enquiries) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | image uploads |
| `TRUSTED_PROXY_COUNT` | proxies in front of the app, for correct rate limiting |

The database user needs `CREATEROLE` for the first migration. That migration
creates the restricted `cms_app` role that client content is read and written as,
under row-level security. Managed Postgres providers give their default user this.
On a host where `npm start` is not used (Vercel), run `npm run db:migrate` in the
build or release step, or set `CMS_AUTO_MIGRATE=true`.

PGlite also works in production for a single small server with a persistent disk.
Leave `DATABASE_URL` unset and point `PGLITE_DIR` at the disk. It is a
one-process database, so run exactly one instance.

### A client site

Deploy it like any Next.js app (Vercel is simplest), with the four variables from
"Adding a client". `TRUSTED_PROXY_COUNT` (default 1) is used for the contact
form's rate limit.

## Tests

```bash
npm test             # 312 unit and integration tests, on in-memory Postgres
npm run test:e2e     # builds both apps, then 17 browser tests across CMS + site
npm run typecheck && npm run lint
```

The unit suite covers permissions, tenancy and row-level security, the content
API, the sanitiser (a large XSS corpus), auth, rate limits, webhooks and SSRF. The
end-to-end suite walks the whole product in a real browser:

- setup with a token, then creating a client and inviting a team;
- a writer sends a post for review and an editor publishes it;
- the post appears on the live site, and an edit reaches the site through the webhook;
- the contact form lands in the inbox, which exports to CSV;
- preview links work;
- cross-client URLs return 404;
- security headers, session revocation and forged webhooks;
- a hostile HTML post, and login lockout.

Both suites also run against a real Postgres:

```bash
TEST_POSTGRES_URL=postgres://user:pw@localhost:5432/postgres npm test   # user needs CREATEDB, CREATEROLE
E2E_DATABASE_URL=postgres://user:pw@localhost:5432/cms_e2e npm run test:e2e   # an empty database
```

See [SECURITY.md](SECURITY.md) for the threat model and what each defence covers.
#   c m s _ w e b s i t e  
 