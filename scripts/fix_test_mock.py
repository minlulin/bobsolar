with open("c:\\bobsolar\\src\\actions\\quotation-actions.test.ts", "r", encoding="utf-8") as f:
    code = f.read()

old_block = """    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(async () => undefined),
          })),
        })),
        delete: vi.fn(() => ({
          where: vi.fn(async () => undefined),
        })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(async () => [state.txInsertedQuote]),
          })),
        })),
      };
      return await fn(tx);
    }),"""

new_block = """    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => {
              const result = [state.quotationDetail?.status === "accepted" ? { ...state.quote, status: "accepted" } : state.quote];
              return {
                for: vi.fn(async () => result),
                then: (resolve: any) => resolve([]),
              };
            }),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(async () => undefined),
          })),
        })),
        delete: vi.fn(() => ({
          where: vi.fn(async () => undefined),
        })),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(async () => [state.txInsertedQuote]),
          })),
        })),
      };
      return await fn(tx);
    }),"""

code = code.replace(old_block, new_block)

with open("c:\\bobsolar\\src\\actions\\quotation-actions.test.ts", "w", encoding="utf-8") as f:
    f.write(code)

print("done")
