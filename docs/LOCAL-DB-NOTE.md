# Local DB vs DO Production — Important Difference

**Last updated: 2026-06-28**

## The problem

Local DB (`injectors_world_dev`) is NOT in sync with DigitalOcean production DB. Do not assume local dev server reflects what production looks like.

## Current known gaps

| Collection | Local DB | DO Production |
|---|---|---|
| `services` | Table exists (after db:push 2026-06-28) but 0 rows | 10 rows seeded |
| `brands` | Table exists but 0 rows | 10 rows seeded |
| `clinics_rels` (brandsOffered) | 0 rows | 13,481 rows (all linked to Juvederm) |
| `clinics` | ~3,695 (same CSV import) | ~13,481 |

So locally: `/brands`, `/brands/juvederm`, `/services/lip-filler`, etc. will show empty or error. Production is correct.

## To fix local DB

Run in order:

```bash
# 1. Push schema (if tables missing)
PAYLOAD_FORCE_PUSH=true NODE_ENV=development npx tsx --env-file=.env.local scripts/db-push.ts

# 2. Seed services + brands
npx tsx --env-file=.env.local scripts/seed-services-brands.ts

# 3. Seed the rest (locations, authors, etc.) if needed
npm run seed

# 4. Re-run import to link clinic relationships
npm run import -- --dir ./data/fake   # for sample data only
```

For the full 13,481 clinic dataset with brand relationships, you need to run the SQL migration against local DB after seeding brands:

```bash
psql "postgres://postgres:admin@localhost:5432/injectors_world_dev" \
  -f scripts/migrate-clinic-rels-to-services-brands.sql
```

## Rule going forward

Always verify against DO production (not local) for anything related to `services`, `brands`, or `clinics_rels`. Use:

```bash
psql "postgresql://doadmin:...@...ondigitalocean.com:25060/defaultdb?sslmode=require" -c "YOUR QUERY"
```

Or check the live site at the relevant URL path.
