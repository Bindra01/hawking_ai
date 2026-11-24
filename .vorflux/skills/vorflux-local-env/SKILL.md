---
name: vorflux-local-env
description: Use when you set env vars, run the app locally, or run Prisma commands (db:push, db:seed, migrate) in this repository.
---

# Local env vars and Prisma

- `.env.example` lists every variable the code reads.
- Put `DATABASE_URL` and `DIRECT_URL` in `.env`. Prisma CLI and `prisma/seed.ts` do not read `.env.local`. With only `.env.local`, `npm run db:push` fails with `P1012: Environment variable not found: DIRECT_URL`.
- Shell env vars win over every `.env` file, for Next.js and for Prisma. Before a Prisma command, check the shell value without printing it: `[[ ${DIRECT_URL:-} == postgres* ]] && echo ok`. Do the same for `DATABASE_URL`.
- A non-PostgreSQL shell value gives `P1013: The provided database string is invalid`. Unset it for the command, for example `env -u DIRECT_URL npm run db:push`.
- `npm run db:seed` deletes all `attempts` and `problems` rows, then inserts `prisma/hawking_flows_final.json`. Do not run it against a shared database.
- Admin access is fail-closed: with an empty `ADMIN_EMAILS`, nobody is an admin (`lib/admin.ts`).
