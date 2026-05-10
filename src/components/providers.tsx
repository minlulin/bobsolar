'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { LazyMotion, domAnimation } from 'framer-motion';
import { toast } from 'sonner';
import { NotificationToast } from '@/components/shared/notification-toast';
import {
  getErrorMessage,
  isNetworkError,
  isServerError,
  isUnauthorizedError,
} from '@/lib/utils/query-error';

function handleQueryError(error: unknown) {
  if (isUnauthorizedError(error)) {
    toast.error('Session expired. Redirecting to sign in...');
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return;
  }

  if (isNetworkError(error)) {
    toast.error('Connection lost. Please retry.', {
      action: {
        label: 'Retry',
        onClick: () => {
          if (typeof window !== 'undefined') window.location.reload();
        },
      },
    });
    return;
  }

  if (isServerError(error)) {
    toast.error('Server error. Please try again in a moment.');
    return;
  }

  toast.error(getErrorMessage(error));
}

export function Providers({ children }: { children: React.ReactNode }) {
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
      <NextThemesProvider
        attribute="class"
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
