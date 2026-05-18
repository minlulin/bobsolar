import { eq } from "drizzle-orm";
import Image from "next/image";
import type * as React from "react";
import { CommandBar } from "@/components/layout/command-bar";
import { NavOrbit } from "@/components/layout/nav-orbit";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserNav } from "@/components/layout/user-nav";
import { RouteTransition } from "@/components/shared/route-transition";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { requireAuth } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const session = await requireAuth();

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: {
      name: true,
      role: true,
    },
  });

  const userName = user?.name || "User";
  const userRole = user?.role || "user";

  return (
    <div className="bg-background relative min-h-screen">
      <a
        href="#main-content"
        className="bg-solar text-background sr-only z-[60] rounded-md px-3 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      {/* Top Bar */}
      <header className="bg-background border-border sticky top-0 z-40 w-full border-b">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="bg-solar relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
              <Image
                src="/icons/logo.png"
                alt="BOB Solar Logo"
                fill
                sizes="40px"
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
            <NotificationBell />

            <ThemeToggle />

            <UserNav userName={userName} userRole={userRole} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="container mx-auto max-w-7xl px-4 py-8 pb-32">
        <RouteTransition>{children}</RouteTransition>
      </main>

      {/* Bottom Dock */}
      <NavOrbit />
    </div>
  );
}
