# Onboarding — get productive in one day

Read this first, then `CLAUDE.md` (the law), then `docs/ROADMAP.md` (what to build next)
and `docs/DECISIONS.md` (why things are the way they are).

## What this project is

A content-led directory of Botox and aesthetic injectors. Next.js 15 (App Router) + React 19
frontend, Payload CMS 3 admin/API, PostgreSQL + PostGIS. Production target is DigitalOcean.

## Prerequisites

- Node 20+ (project uses ESM, `"type": "module"`).
- PostgreSQL 16+ with the PostGIS extension installed under a `postgis` schema.
- A local database named `injectors_world_dev`.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in real values.
   - Local DB string: `postgres://postgres:admin@localhost:5432/injectors_world_dev`
3. `npm run db:push` — pushes the Payload schema to the database.
4. `npm run generate:types` — regenerates `payload-types.ts`.
5. `npm run seed` — loads mock data (idempotent, upserts by slug; safe to re-run).
6. `npm run dev` — starts the dev server.

## URLs

- Site: http://localhost:3000
- Admin: http://localhost:3000/admin
- Default admin login: `admin@injector.world` / `changeme` (change after first login)

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build (runs db-push first) |
| `npm run seed` | Seed/upsert mock data |
| `npm run import` | Import providers from CSV (reads data/samples) |
| `npm run scan:alerts` | Scan for data integrity issues (DataAlerts) |
| `npm run db:push` | Push schema to DB (after any collection change) |
| `npm run generate:types` | Regenerate payload-types.ts |

## Project layout (the parts you touch)

```
app/(frontend)/     public site (catch-all router at [...path])
app/(payload)/      Payload admin + REST API
collections/        Payload collection configs (the data model)
components/         UI, grouped per homepage section + shared
lib/                queries, merit ranking, import engine, route resolver
scripts/            seed, import, db-push, alert scan
docs/               this folder: roadmap, decisions, ship gate, onboarding
payload.config.ts   Payload root config
tailwind.config.ts  design tokens
```

## The rules that bite if you ignore them

- After changing any collection: `npm run db:push` then `npm run generate:types`.
- Dark mode: never `text-white` on `bg-brand-primary` (invisible in dark). Use
  `text-surface-canvas`. See CLAUDE.md "Dark mode rules".
- Relationship IDs in the import pipeline must stay raw numbers, not `String()` (Postgres).
- One focused task per chat. Backup before touching data. Run `docs/DONE.md` before shipping.
