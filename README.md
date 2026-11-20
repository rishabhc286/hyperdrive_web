# HyperDrive — website

**Mount all your cloud storage as a local drive.**

This is the landing page and early-access waitlist for **HyperDrive**, a Windows virtual filesystem that merges Google Drive, Dropbox, and OneDrive into a single native `H:\` drive in File Explorer. Files stream on demand through HTTP Range requests and a local LRU chunk cache, so nothing downloads upfront.

> The HyperDrive app itself is in development. This repository contains the website only.

![HyperDrive landing page](docs/hero.png)

---

## Contents

- [What's on the page](#whats-on-the-page)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database (PostgreSQL)](#database-postgresql)
- [Waitlist emails (Gmail)](#waitlist-emails-gmail)
- [Waitlist API](#waitlist-api)
- [Project structure](#project-structure)
- [How the interactive parts work](#how-the-interactive-parts-work)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)
- [Notes for contributors](#notes-for-contributors)

---

## What's on the page

| Section | What it does |
| --- | --- |
| **Hero + waitlist** | Headline, provider picker (Google Drive / Dropbox / OneDrive), email signup, and a live waitlist counter. |
| **How it works** | A fully interactive Windows File Explorer mock of `H:\`. Press **Stream** or **Seek** on any file to watch Windows reads (`IRP_MJ_READ`) turn into HTTP `Range` requests that fill a 4 MB-chunk LRU cache — with a live chunk map, request log, and telemetry. It's a client-side simulation; no real network requests are made. |
| **Features** | The six core capabilities: unified namespace, range streaming, sparse files + capped cache, native WinFsp integration, local credential vault, delta sync. |
| **Architecture** | The six layers from a Win32 `ReadFile()` down to the provider APIs. Click, hover, or arrow-key through layers to inspect each one's role, protocols, latency target, and purpose. |
| **Roadmap** | The five build phases, from the Spring Boot foundation to the public alpha, with status for each. |
| **FAQ** | Accordion with privacy, disk usage, editing, and platform answers (also emitted as `FAQPage` JSON-LD for search engines). |
| **Get started + footer** | Second signup form, links, and credits. |
| **Scroll rail** | On screens ≥ 1024 px, a scroll-linked rail on the right: section names peel off a stack, climb the edge letter by letter, and land as the current title, next to a document ruler with a % marker. |

![Interactive drive simulator](docs/simulator.png)

## Tech stack

- **[Next.js 16](https://nextjs.org)** (App Router, Turbopack, Cache Components) + **React 19** + **TypeScript**
- **[Tailwind CSS v4](https://tailwindcss.com)** — design tokens live in `app/globals.css` (`@theme`), no `tailwind.config`
- **[lucide-react](https://lucide.dev)** icons
- **Inter** + **JetBrains Mono** via `next/font`
- **PostgreSQL** via [`pg`](https://node-postgres.com) for waitlist storage
- **[Nodemailer](https://nodemailer.com)** for waitlist emails over SMTP
- Generated OpenGraph image (`next/og`), SVG favicon, full SEO metadata

## Getting started

**Requirements:** Node.js **20.9 or newer** and npm.

```bash
git clone https://github.com/rishabhc286/hyperdrive_web.git
cd hyperdrive_web
npm install
cp .env.example .env.local   # optional — only needed for emails / production URLs
npm run dev
```

Open <http://localhost:3000>. The site works without any environment variables; waitlist emails are simply skipped until SMTP is configured.

| Script | Description |
| --- | --- |
| `npm run dev` | Start the development server with hot reload. |
| `npm run build` | Create a production build (type-checks the project). |
| `npm start` | Serve the production build. |
| `npm run lint` | Run ESLint. |

## Environment variables

Copy `.env.example` to `.env.local` and fill in what you need. `.env*` files are gitignored (except the example).

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | In production | Public URL used for canonical and OpenGraph links. Defaults to `http://localhost:3000`. |
| `NEXT_PUBLIC_GITHUB_URL` | No | Shows a "Star on GitHub" link in the footer when set. |
| `DATABASE_URL` | In production | PostgreSQL connection string for waitlist signups. Without it, signups are kept in memory only. |
| `DATABASE_POOL_MAX` | No | Max database connections per server instance. Defaults to `3`. |
| `SMTP_USER` | For emails | Address the waitlist emails are sent from (e.g. your Gmail). |
| `SMTP_PASS` | For emails | SMTP password — for Gmail, an **App Password** (spaces are fine). |
| `WAITLIST_NOTIFY_EMAIL` | No | Also send yourself a short note for every new signup. |
| `SMTP_HOST` | No | Defaults to `smtp.gmail.com`. |
| `SMTP_PORT` | No | Defaults to `465` (implicit TLS). Use `587` for STARTTLS providers. |
| `MAIL_FROM_NAME` | No | Sender display name. Defaults to `HyperDrive`. |

## Database (PostgreSQL)

Waitlist signups are stored in PostgreSQL (12 or newer) when `DATABASE_URL` is set. Any host works: [Neon](https://neon.tech) (one click from the Vercel Marketplace), Railway, Render, AWS RDS, or your own server.

- **No setup step.** The `waitlist_entries` table is created automatically on first use. The schema is also in [`db/schema.sql`](db/schema.sql) if you prefer to run it yourself: `psql "$DATABASE_URL" -f db/schema.sql`.
- **Duplicates are safe.** Emails are unique, so a repeat signup — even two at the same instant — returns the original queue position instead of creating a second row.
- **Positions are gap-free.** They're computed by counting rows, not from the serial id.
- **Outages are handled.** If the database is unreachable, the API returns `503` and the form shows a "temporarily unavailable" message.
- **Serverless hosting.** On Vercel, use your provider's *pooled* connection string (e.g. Neon's `-pooler` host); each instance keeps at most `DATABASE_POOL_MAX` connections.

**Local development:** leave `DATABASE_URL` empty to use the in-memory store, or point it at a local PostgreSQL, e.g. `postgres://postgres:yourpassword@localhost:5432/hyperdrive` (create the database first with `createdb hyperdrive`).

**Viewing signups:** use any PostgreSQL client (pgAdmin, TablePlus, `psql`, or your host's dashboard):

```sql
SELECT email, providers, created_at FROM waitlist_entries ORDER BY id;
```

## Waitlist emails (Gmail)

When someone joins the waitlist, they receive a confirmation email (with their queue position and chosen clouds) sent from your address. Optionally, you get a notification with `Reply-To` set to the new signup.

1. Turn on **2-Step Verification** for your Google account.
2. Create an App Password at <https://myaccount.google.com/apppasswords>.
3. Put your address in `SMTP_USER` and the App Password in `SMTP_PASS` in `.env.local`, then restart the dev server.

Emails are sent **after** the API responds (via Next.js `after()`), so they never slow down the form, and an email failure never fails a signup. Duplicate signups and bot (honeypot) submissions don't trigger emails.

> A personal Gmail account can send roughly 500 emails/day, and messages from `@gmail.com` may land in spam. For larger volumes, point the `SMTP_*` variables at a transactional provider (Resend, Postmark, SES, …) on your own domain — no code changes needed.

## Waitlist API

`GET /api/waitlist` → current number of signups (straight from the database).

```json
{ "total": 42 }
```

`POST /api/waitlist` with `Content-Type: application/json`:

```json
{ "email": "you@company.com", "providers": ["google-drive", "dropbox", "onedrive"] }
```

Providers must be one or more of `google-drive`, `dropbox`, `onedrive`. Emails are trimmed and lower-cased.

| Status | Meaning |
| --- | --- |
| `201` | Joined. Body: `{ ok, email, providers, position, total, alreadyJoined: false }` |
| `200` | Already on the list — returns the original position with `alreadyJoined: true`. |
| `400` | Body is not valid JSON. |
| `413` | Body larger than 4 KB. |
| `415` | Content type is not `application/json`. |
| `422` | Validation failed — `fieldErrors.email` / `fieldErrors.providers` explain why. |
| `429` | More than 5 signups from the same IP in 10 minutes (`Retry-After` header set). |
| `503` | The database is unreachable. `GET` returns the same status. |

## Project structure

```text
app/
  api/waitlist/route.ts      Waitlist API (validation, rate limit, emails)
  globals.css                Design tokens (@theme) + scroll-rail layout
  layout.tsx                 Fonts, base metadata, viewport
  page.tsx                   Page composition + page-level SEO metadata
  opengraph-image.tsx        Generated 1200×630 social image
  icon.svg                   Favicon
components/landing/
  Navbar.tsx                 Sticky nav, active-section highlight, mobile menu
  HeroWaitlist.tsx           Hero + live counter
  WaitlistForm.tsx           Signup form (used in hero and footer)
  VirtualDriveSimulator.tsx  "How it works" section
  simulator/                 Explorer window + chunk inspector UI
  FeaturesBento.tsx          Features grid
  ArchitecturePipeline.tsx   Layer list + inspector
  Roadmap.tsx                Build phases
  FaqSection.tsx             FAQ accordion + JSON-LD
  Footer.tsx                 Closing CTA + footer
  ScrollRail.tsx             Scroll-linked section rail + ruler
  Section.tsx, Logo.tsx      Shared layout pieces
lib/
  waitlist.ts                Shared types + validation (client and server)
  waitlist-store.ts          Waitlist storage (PostgreSQL, or in-memory fallback)
  db.ts                      PostgreSQL pool + automatic schema setup
  mailer.ts                  SMTP email sending
  rate-limit.ts              Per-IP rate limiter
  site.ts                    Section links + optional GitHub URL
  drive-sim/catalog.ts       Simulated files, providers, byte formatting
  drive-sim/engine.ts        Pure reducer that simulates the read path
db/schema.sql                Reference SQL schema
docs/                        README screenshots
```

## How the interactive parts work

**Drive simulator.** `lib/drive-sim/engine.ts` is a pure reducer: time and random latency are passed in through actions, so the initial render is identical on server and client. Each tick completes due range requests, inserts chunks into an LRU (evicting the coldest), and issues new reads. "Stream" reads the first 24 chunks (96 MB), "Seek" jumps to 65% and reads 12. The cache budget is 192 MB on purpose, so eviction shows up quickly. Tunables (`LRU_CAPACITY_CHUNKS`, `STREAM_READ_AHEAD`, `MAX_IN_FLIGHT`, …) are at the top of the file; the file list lives in `catalog.ts`.

**Scroll rail.** `components/landing/ScrollRail.tsx` updates everything imperatively from one `requestAnimationFrame`-throttled scroll handler, so scrolling never re-renders React. Each section's progress (0 → 1) is measured from when its top enters the viewport to when it reaches the navbar; flying letters are laid out along a horizontal-run → quarter-circle → vertical path. Sizes per breakpoint are in the `TIER_*` constants. Its show/hide and page gutter are plain CSS in `globals.css` (`.scroll-rail`, `.rail-gutter`, `.rail-bleed`) — keep those widths in sync with the tiers.

**Accessibility.** Everything interactive works with the keyboard and has an accessible name. The FAQ and architecture inspector use proper ARIA wiring, the decorative rail is `aria-hidden`, and `prefers-reduced-motion` disables smooth scrolling, the rail's letter animation, and other motion.

## Deployment

The easiest path is **[Vercel](https://vercel.com/new)**:

1. Import this repository.
2. Add the environment variables from the table above — at least `NEXT_PUBLIC_SITE_URL` and `DATABASE_URL` (add `SMTP_*` for emails). With Neon from the Vercel Marketplace, `DATABASE_URL` is added for you.
3. Deploy. Any other host that runs a Node.js Next.js server (`npm run build && npm start`) works too.

## Known limitations

- **Without `DATABASE_URL`, signups live in memory** and are lost on restart, redeploy, or serverless cold start. Always set it in production.
- **Rate limiting is per instance** and trusts the `X-Forwarded-For` header from your host. Use a shared store (e.g. Redis) at scale.
- **The counter shows the real number of signups**, read from the database (polled every 20 seconds). With no signups yet, it reads "Be the first to join the waitlist."
- **Simulator figures are illustrative.** Provider capacities (100 + 50 + 25 GB) total a 175 GB pool, while the Features copy mentions 150 GB.

## Notes for contributors

- This project uses **Next.js 16**, which has breaking changes from older versions. Check the bundled docs in `node_modules/next/dist/docs/` before relying on older patterns (see `AGENTS.md`).
- **Cache Components** is enabled. The page is prerendered as static; `GET /api/waitlist` calls `connection()` so the count is always fresh.
- If the dev server stops picking up new Tailwind classes after you add a file, restart `npm run dev`.
- Run `npx tsc --noEmit`, `npm run lint`, and `npm run build` before pushing — all three should be clean.
