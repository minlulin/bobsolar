# BobSolar Chatbot Rewrite Plan

## Overview
This plan replaces the existing BobSolar chatbot with a simplified, file-based knowledge assistant.
The target architecture removes database embeddings, vendor lock-in, and heavy AI SDK dependencies in favor of:
- Markdown-based knowledge files in `content/`
- OpenRouter streaming completions
- Provider rotation for resiliency
- A lightweight React chatbot frontend

## Goals
- Eliminate complex chat DB architecture
- Remove Gemini-specific AI SDK dependencies
- Replace embedding search with plain-text knowledge injection
- Simplify the API route and frontend chat component
- Keep the chatbot isolated from the main dashboard UI

## Current Challenges
### Over-engineered stack
- Uses `@ai-sdk/google`, `streamText`, embeddings, vector similarity, and search tools for simple Q&A.
- Maintains chat sessions in a database plus rate limiting, quotas, and cost tracking.

### Vendor lock-in
- Hardcoded to Google Gemini via `@ai-sdk/google` and `createGoogleGenerativeAI`.

### Complex API workflow
- Current route has an 11-step pipeline:
  1. auth
  2. IP throttle
  3. rate limit
  4. quota
  5. validation
  6. normalize
  7. session
  8. save
  9. AI stream
  10. log
  11. return

### Broken auth integration
- `requireChatAccess()` uses `redirect()` from `next/navigation`, causing invalid API behavior.

### Heavy dependencies
- `drizzle-orm`, Postgres, embedding tables, vector indexes are overkill for a markdown-driven assistant.

### Complex frontend settings
- Many settings are saved in `localStorage` and managed by AI SDK features.

## Proposed Architecture
### Core strategy
- Use markdown files in `content/` as knowledge source.
- Read files at request time and inject them into the system prompt.
- Send one streaming request to OpenRouter-compatible providers.
- Rotate providers automatically on failure.

### Provider rotation
- Model: `google/gemma-3-4b-it` or an available Gemma 4 variant.
- Example provider endpoints:
  - `https://openrouter.ai/api/v1/chat/completions`
  - `https://api.groq.com/openai/v1/chat/completions`
  - `https://api.together.xyz/v1/chat/completions`
  - `https://api.fireworks.ai/inference/v1/chat/completions`
- If one provider fails, fall back to the next one.

### Simplified workflow
1. User sends a message.
2. Backend reads all `.md` / `.txt` files from `content/`.
3. Build the system prompt with file content.
4. Send a streaming request to OpenRouter.
5. Return the SSE stream to the frontend.

### Design tradeoffs
- No DB session persistence.
- No embeddings or vector search.
- Optional simple auth only if needed.

## Implementation Plan

### Phase 1: Simplify Backend
- Replace `src/app/api/chat/route.ts`.
- Remove the current Google-specific, DB-dependent route.
- Implement a new route that:
  - reads `content/` markdown files.
  - builds a system prompt.
  - sends a streaming request with `stream: true`.
  - rotates providers on failure.

#### New route behavior
- Reads `.md` and `.txt` files from `content/`.
- Adds a fallback when no knowledge files exist.
- Uses `OPENROUTER_API_KEY`.
- Returns `text/event-stream` directly from the working provider.

### Phase 2: Create `content/`
- Add plain knowledge files instead of embedding storage.
- Example files:
  - `content/inverter-fault-codes.md`
  - `content/safety-warnings.md`
  - `content/diagnostic-flows.md`
  - `content/brands.md`
- This replaces `knowledgeChunks`, embeddings, and search tools.

### Phase 3: Simplify Frontend
- Replace `src/components/chat/chat-bot.tsx`.
- Remove AI SDK dependency and custom transport logic.
- Implement simple SSE fetch to `/api/chat`.
- Use `react-markdown` and `remark-gfm` for rendering.
- Keep UI state lightweight (no complex session persistence).
- Maintain clean dark UI and float/chat widget pattern.

### Phase 4: Remove Unused Code
Delete these files if they are only chat-related:
- `src/lib/chat/key-rotator.ts`
- `src/lib/chat/rate-limit.ts`
- `src/lib/chat/ip-throttle.ts`
- `src/lib/chat/quota.ts`
- `src/lib/chat/metrics.ts`
- `src/lib/chat/sessions.ts`
- `src/lib/chat/cost.ts`
- `src/lib/chat/validation.ts`
- `src/lib/knowledge/markdown.ts`
- `src/lib/query-config.ts`
- `src/lib/query-keys.ts`
- `src/lib/cache-tags.ts`

Simplify existing files:
- `src/lib/domain/policies.ts` → strip chat-specific constants.
- `src/lib/db/schema.ts` → remove `knowledgeChunks` and related tables.
- `src/lib/auth/validate.ts` → simplify `requireChatAccess` or remove if chat is public.

### Phase 5: Update Dependencies
Remove from `package.json`:
- `@ai-sdk/google`
- `@ai-sdk/react`
- `ai`
- `drizzle-orm` (only if chat is the only remaining consumer)
- `ws` (if only used for chat)

Add:
- `react-markdown`
- `remark-gfm`
- `react-syntax-highlighter`
- `mermaid` (optional for diagrams)

### Phase 6: Dashboard Integration
- Update `src/app/(dashboard)/layout.tsx` if needed.
- Keep existing floating widget layout if it still fits the design.
- Import the new simplified chat component cleanly.

### Phase 7: Environment Variables
Simplify environment configuration:
```env
OPENROUTER_API_KEY=your_key_here
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
Remove chat-specific env vars:
- `GEMINI_API_KEY_PRIMARY`
- `GEMINI_API_KEY_BACKUP_1`
- `GEMINI_API_KEY_BACKUP_2`
- `GEMINI_API_KEY_BACKUP_3`
- `GEMINI_API_KEY_BACKUP_4`
- Any DB credential vars only used for chat

## Migration Checklist
| # | Task | Impact |
|---|---|---|
| 1 | Create `content/` directory with knowledge markdown files | High |
| 2 | Rewrite `src/app/api/chat/route.ts` with file-based provider rotation | High |
| 3 | Rewrite `src/components/chat/chat-bot.tsx` to use SSE and markdown rendering | High |
| 4 | Remove unused chat support files | Medium |
| 5 | Clean `src/lib/domain/policies.ts` and remove chat constants | Medium |
| 6 | Update `package.json` dependencies | Medium |
| 7 | Simplify `.env` variables | Low |
| 8 | Remove or update tests referencing old chat code | Medium |
| 9 | Update dashboard layout if required | Low |
| 10 | Verify build and run passes | High |

## Key Design Decisions
- **OpenRouter provider rotation** gives resiliency without managing multiple proprietary API keys.
- **File-based knowledge** makes content easy to author and maintain.
- **No embeddings** keeps the stack simple and transparent.
- **Optional public chat** avoids auth complexity for a local business tool.
- **Floating chat widget** preserves a user-friendly access pattern.

## Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Knowledge files exceed context window | Keep files concise, apply chunking or summarization if needed |
| Provider rotation latency | Use 15s per provider timeout and only try a few providers in sequence |
| Lost conversation history | Accept as a tradeoff; can add export/history later |
| Dashboard breakage | Keep chat isolated and import only the new component |
| Build failures from removed imports | Search for references before deleting files |

## Summary
This plan reduces the chatbot architecture from an 11-step DB-driven pipeline to a lean 4-step flow:
1. Read Markdown content
2. Build prompt
3. Call OpenRouter provider
4. Stream response

It removes vendor lock-in, simplifies dependencies, and aligns the chatbot with the `knowledge-assistant` strategy while preserving a resilient provider failover path.
