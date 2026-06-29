# AGENTS.md - Single Source Of Command Center for Coding Agents

This file serves as the central command center for all coding agents working on the BOB Solar repository. It consolidates instructions, skills, and workflow information from across the repository.

## 📁 Repository Structure & Key Locations

### Core Directories
- **Source Code**: `src/` - Main application code (App Router, components, hooks, lib)
- **Database**: `src/lib/db/` - Drizzle schema, migrations, and client
- **Actions**: `src/actions/` - Server Actions for business logic
- **Skills**: `.agents/skills/` - Domain-specific skill guides
- **Instructions**: `.github/instructions/` - Domain-specific working instructions
- **Scripts**: `scripts/` - Database and operational scripts
- **Tests**: `e2e/` - End-to-end tests, `src/lib/tests/` - unit tests

### Configuration Files
- **Package Manager**: `package.json` (pnpm@11.9.0)
- **TypeScript**: `tsconfig.json`, `tsconfig.sw.json`
- **Linting**: `biome.json`, `eslint.config.mjs`
- **Testing**: `vitest.config.mts`
- **Database**: `drizzle.config.ts`, `drizzle.test.config.ts`

## 🧠 Available Skills (Authoritative Guidance)

Agents MUST consult relevant skills for domain-specific work. Skills are located in `.agents/skills/`:

1. **TypeScript/React/Next.js** (`typescript-modern-skill/SKILL.md`)
   - Mandatory for tsconfig, Biome/Lefthook, package scripts, Next.js config, TypeScript refactors

2. **Neon Serverless Postgres** (`neon-postgres/SKILL.md`)
   - Mandatory for Neon/Postgres CLI, connection strings, auth, deployment

3. **Frontend Design** (`frontend-design/SKILL.md`)
   - Mandatory for UI/component/page work; includes accessibility and testing expectations

4. **Code Pattern Guidance** (`code-pattern-guidance/SKILL.md`)
   - Contains migration notes and recommended idioms (advisory) for large migrations

5. **Kilo Configuration** (`kilo-config/SKILL.md`)
   - Guide for Kilo configuration: config paths, commands, agents, skills, permissions, MCPs, providers, TUI settings

## 📋 Domain-Specific Instructions

Domain-specific working instructions are located in `.github/instructions/`:
- `bobsolar-architecture.instructions.md` - Layered architecture, Server Actions pattern
- `bobsolar-typescript.instructions.md` - TypeScript best practices
- `bobsolar-nextjs.instructions.md` - Next.js App Router specifics
- `bobsolar-testing.instructions.md` - Testing strategies and patterns
- `bobsolar-db.instructions.md` - Database operations and migrations
- `bobsolar-ui.instructions.md` - UI/Component guidelines
- `bobsolar-tooling.instructions.md` - Development tooling
- `bobsolar-finance.instructions.md` - Financial domain specifics
- `bobsolar-ssot.instructions.md` - Single Source of Truth principles

## 🔧 Required Skills & Enforcement Rules

All agents MUST follow these rules:

1. **Identify affected skills** at start of task and list them in PR description
2. **Load skill guidance** as system/context for generation where applicable
3. **Fail-fast on policy violations**: Do not implement changes that break skill constraints
4. **Add/update automated checks** (linters, typechecks, unit tests) that enforce rules when feasible
5. **Document exceptions** in PR description with justification and risk mitigations

## 🏗️ Canonical File Structure (SSoT)

For each feature domain, follow this structure:
```
src/lib/db/schema.ts           → DB tables/enums
src/lib/domain/<domain>.ts     → Enum values, labels, constants, guards
src/lib/validators/<domain>.ts → Zod input/output schemas
src/actions/<domain>-actions.ts→ Server behavior (permissions, validation, DB, side-effects)
src/hooks/use-<domain>.ts      → Uses action-derived types + query key factory
src/components/<domain>/*      → NO canonical business literals
```

## 📋 PR / Commit Requirements

Every change MUST include:
- **Intent**: Short summary of what and why
- **Affected skills**: List of skills consulted (e.g., `typescript-modern-skill`, `neon-postgres`)
- **Local test commands**: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`
- **Tests added/updated**: List of new unit/integration/tsd tests
- **Rollback plan**: Steps to revert or mitigate if change regresses in production

### PR Checklist Template
```markdown
- **Intent:** [Short summary of what and why]
- **Affected skills:** [typescript-modern-skill, neon-postgres, etc.]
- **Commands to run locally:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`
- **Tests added/updated:** [List of new tests]
- **Rollback plan:** [Steps to revert or mitigate if change regresses]
```

### SSoT Checklist
```markdown
- [ ] Existing canonical sources checked
- [ ] No duplicate domain types added
- [ ] No local status/account/role/query-key literals added (except approved tests/migrations)
- [ ] Form/API types derived from Zod or DB models
- [ ] Query keys use `src/lib/query-keys.ts` when factory exists
- [ ] New constants placed in `src/lib/domain/*` or `src/lib/domain/policies.ts`
- [ ] `pnpm typecheck`, `pnpm lint`, and relevant tests passed
```

## 🎯 Minimal Agent Behavior

- Always prefer explicit, type-safe solutions
- Ask clarifying questions if requirements are ambiguous
- Add tests and linters to prevent regressions
- When in doubt, pause and request approval rather than introducing risky changes

## 🚀 Quick Start for Next.js Development

When starting work on this Next.js project:
1. Check if `init` tool from next-devtools-mcp server is available
2. If available, call it first; otherwise proceed with repo-local instructions
3. Always verify you're working against Node.js >=24 <26 (per package.json engines)
4. Use pnpm@11.5.2 for package management (per package.json packageManager)

## 🔄 Agent Manager Commands

For worktree-based development:
- Use Agent Manager to create isolated worktrees for feature work
- Setup scripts: `.kilo/setup-script.*` (platform-specific)
- Run scripts: `.kilo/run-script.*` (platform-specific)
- State tracking: `.kilo/agent-manager.json`

## 🔧 Available Commands

Access commands via `/command-name` syntax. Commands are loaded from:
- `.kilo/command/`
- `.kilocode/command/`
- `.opencode/command/`
- Global config locations

Common commands include:
- `/test` - Run test suites
- `/build` - Build the application
- `/lint` - Run linters
- `/typecheck` - Run TypeScript checker
- `/dev` - Start development server
- `/db:migrate` - Run database migrations
- `/db:seed` - Seed database