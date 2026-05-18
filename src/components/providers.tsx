"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { domAnimation, LazyMotion } from "motion/react";
import * as React from "react";
import { toast } from "sonner";
import { NotificationToast } from "@/components/shared/notification-toast";
import {
  getErrorMessage,
  isNetworkError,
  isServerError,
  isUnauthorizedError,
} from "@/lib/utils/query-error";

type AppTheme = "light" | "dark";

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  mounted: boolean;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function applyThemeClass(theme: AppTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [theme, setThemeState] = React.useState<AppTheme>(() => {
    if (typeof window === "undefined") return "light";
    const savedTheme = window.localStorage.getItem("theme");
    if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  React.useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  const mounted = React.useSyncExternalStore(
    React.useCallback(() => (): void => undefined, []),
    (): boolean => true,
    (): boolean => false,
  );

  const setTheme = React.useCallback((nextTheme: AppTheme): void => {
    setThemeState(nextTheme);
    window.localStorage.setItem("theme", nextTheme);
    applyThemeClass(nextTheme);
  }, []);

  const value = React.useMemo(
    (): ThemeContextValue => ({ theme, setTheme, mounted }),
    [theme, setTheme, mounted],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within Providers");
  }
  return context;
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
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: handleQueryError,
        }),
        mutationCache: new MutationCache({
          onError: handleQueryError,
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LazyMotion features={domAnimation}>
          {children}
          <NotificationToast />
        </LazyMotion>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
