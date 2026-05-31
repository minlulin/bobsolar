# Code Review Checklist

Quick-reference for PR reviews. Based on patterns established in this codebase.

---

## Server Components

- [ ] Pages use the 3-file pattern: `page.tsx` (server) → `*-hydrated.tsx` (boundary) → `*-client.tsx` (client)
- [ ] Server component calls server actions directly, not hooks
- [ ] `dehydrate(queryClient)` passes state to `<HydrationBoundary>`
- [ ] No `"use client"` in `page.tsx`
- [ ] Dynamic routes use `params: Promise<{ id: string }>` + `await params`

## Server Actions

- [ ] Returns `ActionResponse<T>` (`{ success: true, data: T }` or `{ success: false, error: string }`)
- [ ] Calls `requireAuth()` / `requireFinanceAccess()` at the top
- [ ] Validates input with Zod before database access
- [ ] Uses `successResponse()` / `errorResponse()` helpers from `action-response.ts`
- [ ] Wrapped in transactions where multiple writes are needed

## Mutation Hooks

- [ ] Simple mutations use `createMutationHook` factory
- [ ] `invalidateKeys` uses `*Keys.all` (prefix-based invalidation covers child keys)
- [ ] Optimistic updates use manual `useMutation` with `onMutate`/`onError` rollback
- [ ] No `queryClient.invalidateQueries()` in factory hooks (MutationCache handles it)
- [ ] Toast messages are concise and user-facing

## Query Hooks

- [ ] Query key uses the `*Keys` factory (e.g., `supplierKeys.all`, `purchaseKeys.detail(id)`)
- [ ] `staleTime` uses `STALE_TIME` constants from `query-config.ts`
- [ ] `enabled` is set for parameterized queries (e.g., `enabled: !!id`)
- [ ] `queryFn` checks `res.success` and throws on error

## Types & Validation

- [ ] Zod schema in `lib/validators/` is SSoT for input types
- [ ] No `as` casts — use Zod parsing or type narrowing
- [ ] No `any` types — use `unknown` and narrow
- [ ] Domain constants (payment methods, cost types) live in `lib/domain/`

## Finance & Accounting

- [ ] Payment method → ledger account mapping uses `PAYMENT_METHOD_LEDGER_MAP` SSoT
- [ ] Cost type → expense account mapping uses `COST_TYPE_EXPENSE_MAP` SSoT
- [ ] Journal entries are balanced (debits === credits)
- [ ] Double-entry bookkeeping rules are enforced in server actions

## Error Handling

- [ ] Server actions wrap DB calls in try/catch
- [ ] Mutation hooks show toast on error
- [ ] Query hooks throw so React Query's error boundary catches it
- [ ] No swallowed errors

## Performance

- [ ] No unnecessary re-renders (memoize expensive computations)
- [ ] No `refetchInterval` on non-realtime data — use `refetchOnWindowFocus`
- [ ] Parallel `Promise.all` for independent server-side fetches
- [ ] Dynamic imports for heavy client-only components (`dynamic(..., { ssr: false })`)

## Naming Conventions

- [ ] Files: `use-*.ts` for hooks, `*-actions.ts` for server actions
- [ ] Query keys: `*Keys` factory object with `.all`, `.list()`, `.detail(id)`
- [ ] Components: PascalCase, co-located with route or in `components/shared/`
- [ ] Validators: `*Schema` for Zod, `*Input` for inferred types

## Before Merging

- [ ] `npx tsc --noEmit` passes (0 errors)
- [ ] `npx biome check` passes (0 errors)
- [ ] No console.log left in production code
- [ ] No secrets or keys committed
- [ ] Query invalidation covers all affected data
