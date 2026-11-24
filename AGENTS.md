<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Checks

Use npm (`package-lock.json`). Run from the repository root:

- Tests: `npx vitest run`. There is no `npm test` script.
- Types: `npx tsc --noEmit`.
- Lint: `npm run lint`. It has existing errors; do not add new ones in files you touch.
- Build: `npm run build` (runs `prisma generate` first).

## Skills

- `.vorflux/skills/vorflux-local-env/SKILL.md`: env vars and Prisma database commands.
