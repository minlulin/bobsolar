"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { domAnimation, LazyMotion } from "motion/react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import * as React from "react";
import { toast } from "sonner";
import { NotificationToast } from "@/components/shared/notification-toast";
import { extractMutationMeta } from "@/lib/mutation-meta";
import {
  getErrorMessage,
  isNetworkError,
  isServerError,
  isUnauthorizedError,
} from "@/lib/utils/query-error";

export function useAppTheme() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return {
    theme: (theme === "dark" ? "dark" : "light") as "light" | "dark",
    setTheme: (t: "light" | "dark" | "system") => setTheme(t),
    mounted,
  };
}

function handleQueryError(error: unknown): void {
  if (isUnauthorizedError(error)) {
    toast.error("Session expired. Redirecting to sign in...");
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return;
  }

  if (isNetworkError(error)) {
    toast.error("Connection lost. Please retry.", {
      action: {
        label: "Retry",
        onClick: (): void => {
          if (typeof window !== "undefined") window.location.reload();
        },
      },
    });
    return;
  }

  if (isServerError(error)) {
    toast.error("Server error. Please try again in a moment.");
    return;
  }

  toast.error(getErrorMessage(error));
}

export function Providers({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [queryClient] = React.useState(() => {
    const client = new QueryClient({
      queryCache: new QueryCache({
        onError: handleQueryError,
      }),
      mutationCache: new MutationCache({
        onSuccess: (_data, _variables, _context, mutation) => {
          const meta = extractMutationMeta(mutation.meta);
          if (meta?.invalidates) {
            Promise.all(
              meta.invalidates.map((key) => client.invalidateQueries({ queryKey: key })),
            ).catch((err) => {
              console.error("MutationCache auto-invalidation failed:", err);
            });
          }
        },
        onError: handleQueryError,
      }),
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
        },
      },
    });
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <LazyMotion features={domAnimation}>
          {children}
          <NotificationToast />
        </LazyMotion>
      </NextThemesProvider>
    </QueryClientProvider>
  );
}
