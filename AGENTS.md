# Agent Instructions

## Next.js Initialization

When starting work on a Next.js project, automatically call the `init` tool
from the **next-devtools-mcp** server **first**. This establishes proper
context and ensures all subsequent Next.js queries use official
documentation.

## Required Skills

### TypeScript / React / Next.js Stack

For all TypeScript, React, Next.js, PWA, Vercel, build, deployment, linting,
or configuration work, the agent **must** follow:

`.agents/skills/typescript-pwa-vercel-deploy/SKILL.md`

This skill is **mandatory** for:

- `tsconfig` changes
- ESLint configuration changes
- package scripts
- Next.js / Vite configuration
- PWA / service worker work
- Vercel deployment configuration
- TypeScript refactors

The agent **must** enforce:

- **No `any`** — every value must have an explicit, meaningful type
- **Strict TypeScript** with all compiler strict flags enabled
- **Explicit, meaningful types** on all declarations
- **No weakening** of compiler or lint rules
- **No disabling** strict flags to make code compile

---

### Neon Serverless Postgres

For Neon Serverless Postgres, Postgres database setup, Neon CLI, Neon
branching, Neon auth, Neon connection strings, or Neon-related deployment
work, the agent **must** follow:

`.agents/skills/neon-postgres/SKILL.md`

---

### Frontend Design

When the user provides frontend requirements (a component, page, application,
or interface to build), including any context about purpose, audience, or
technical constraints, the agent **must** follow:

`.agents/skills/frontend-design/SKILL.md`
