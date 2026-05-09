import * as React from 'react';
import { Sun, Bell, User } from 'lucide-react';
import { requireAuth } from '@/lib/auth/validate';
import { BottomDock } from '@/components/layout/nav-orbit';
import { CommandBar } from '@/components/layout/command-bar';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Button } from '@/components/ui/button';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  return (
    <div className="relative min-h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-solar shadow-solar">
              <Sun className="h-6 w-6 text-white" />
            </div>
            <span className="hidden font-heading text-xl font-bold tracking-tight sm:block">
              BOB Solar
            </span>
          </div>

          <div className="flex flex-1 justify-center px-4">
            <CommandBar />
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-solar" />
            </Button>
            
            <ThemeToggle />
            
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted border-2 border-white/10 overflow-hidden">
              <User className="h-6 w-6" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-7xl px-4 py-8 pb-32">
        {children}
      </main>

      {/* Bottom Dock */}
      <BottomDock />
    </div>
  );
}
