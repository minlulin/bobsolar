import { eq } from "drizzle-orm";
import Image from "next/image";
import { redirect } from "next/navigation";
import type * as React from "react";
import { getCompanyLogoUrl } from "@/actions/settings-actions";
import { CommandBar } from "@/components/layout/command-bar";
import { NavOrbit } from "@/components/layout/nav-orbit";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserNav } from "@/components/layout/user-nav";
import { RouteTransition } from "@/components/shared/route-transition";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { clearSessionCookies } from "@/lib/auth/session";
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

  // Parallelize independent data fetches to avoid sequential waterfall
  const [user, companyLogoUrl] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: { name: true, role: true },
    }),
    getCompanyLogoUrl(),
  ]);

  if (!user) {
    await clearSessionCookies();
    redirect("/login");
  }

  const userName = user.name;
  const userRole = user.role;
  const logoSrc = companyLogoUrl || "/icons/logo.png";

  return (
    <div className="bg-background relative min-h-screen">
      <a
        href="#main-content"
        className="bg-solar text-background sr-only z-60 rounded-md px-3 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      {/* Top Bar */}
      <header className="border-border/70 bg-background/90 sticky top-0 z-40 w-full border-b backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="bg-solar shadow-solar ring-background relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl ring-2">
              <Image
                src={logoSrc}
                alt="BOB Solar Logo"
                fill
                sizes="40px"
                className="object-contain p-1"
                priority
                unoptimized
              />
            </div>
            <span className="font-heading text-foreground hidden text-xl font-semibold tracking-tight sm:block">
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
