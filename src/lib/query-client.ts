import { QueryClient } from "@tanstack/react-query";

/**
 * QueryClient Factory SSoT
 * Creates a properly configured QueryClient with sensible defaults.
 *
 * SERVER: Create a fresh instance per request (never share across requests).
 * CLIENT: Reuse the same instance across the app.
 */

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (error instanceof Error && error.message.includes("4")) return false;
          return failureCount < 2;
        },
      },
    },
  });
}
