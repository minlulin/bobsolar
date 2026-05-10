import type { Metadata, Viewport } from 'next';
import { Outfit, Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from '@/components/providers';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const fontHeading = Outfit({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  preload: true,
});

const fontBody = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  preload: true,
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: 'BOB Solar — Solar Installation Management',
  description: 'A premium management system for BOB Solar.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BOB Solar',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#F59E0B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontHeading.variable} ${fontBody.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="font-body flex min-h-full flex-col">
        <Providers>
          <TooltipProvider>{children}</TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
