'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, domAnimation } from 'framer-motion';
import { NotificationToast } from '@/components/shared/notification-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
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
