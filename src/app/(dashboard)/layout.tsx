import * as React from 'react';
import Image from 'next/image';
import { Bell, User } from 'lucide-react';
import { requireAuth } from '@/lib/auth/validate';
import { BottomDock } from '@/components/layout/nav-orbit';
import { CommandBar } from '@/components/layout/command-bar';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Button } from '@/components/ui/button';
import { RouteTransition } from '@/components/shared/route-transition';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  return (
    <div className="bg-background relative min-h-screen">
      {/* Top Bar */}
      <header className="bg-background/80 sticky top-0 z-40 w-full border-b border-white/5 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="bg-solar shadow-solar relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
              <Image
                src="/icons/logo.png"
                alt="BOB Solar Logo"
                fill
                className="object-contain p-1"
                priority
              />
            </div>
            <span className="font-heading hidden text-xl font-bold tracking-tight sm:block">
              BOB Solar
            </span>
          </div>

          <div className="flex flex-1 justify-center px-4">
            <CommandBar />
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 rounded-full"
            >
              <Bell className="h-5 w-5" />
              <span className="bg-solar absolute top-2.5 right-2.5 h-2 w-2 rounded-full" />
            </Button>

            <ThemeToggle />

            <div className="bg-muted flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white/10">
              <User className="h-6 w-6" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-7xl px-4 py-8 pb-32">
        <RouteTransition>{children}</RouteTransition>
      </main>

      {/* Bottom Dock */}
      <BottomDock />
    </div>
  );
}
