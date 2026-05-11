# Agent Instructions

## Required Skills

For all TypeScript, React, Next.js, PWA, Vercel, build, deployment, linting,
or configuration work, the agent MUST follow:

.agents/skills/typescript-pwa-vercel-deploy/SKILL.md

This skill is mandatory for:
- tsconfig changes
- ESLint changes
- package scripts
- Next.js/Vite configuration
- PWA/service worker work
- Vercel deployment configuration
- TypeScript refactors

The agent must enforce:
- no `any`
- strict TypeScript
- explicit meaningful types
- no weakening of compiler or lint rules
- no disabling strict flags to make code compile

---

For Neon Serverless Postgres, Postgres database setup, Neon CLI, Neon
branching, Neon auth, Neon connection strings, or Neon-related deployment work,
the agent must follow:

`.agents/skills/neon-postgres/SKILL.md`