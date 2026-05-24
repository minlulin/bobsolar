"use client";

import type { LucideIcon } from "lucide-react";
import { BookOpen, ClipboardList, Home, Package, Users, Wallet, Zap } from "lucide-react";
import type { MotionValue } from "motion/react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// --- Premium Physics Configuration ---
// Insanely responsive spring: snaps without aggressive bounce
const dockSpringConfig = {
  mass: 0.1,
  stiffness: 400,
  damping: 30,
};

const navItems = [
  { name: "Dashboard", href: "/", icon: Home, bg: "bg-blue-500", text: "text-white" },
  { name: "Customers", href: "/customers", icon: Users, bg: "bg-teal-500", text: "text-white" },
  {
    name: "Quotations",
    href: "/quotations",
    icon: ClipboardList,
    bg: "bg-amber-500",
    text: "text-white",
  },
  { name: "Projects", href: "/projects", icon: Zap, bg: "bg-violet-500", text: "text-white" },
  {
    name: "Inventory",
    href: "/inventory",
    icon: Package,
    bg: "bg-emerald-500",
    text: "text-white",
  },
  { name: "Finance", href: "/finance", icon: Wallet, bg: "bg-rose-500", text: "text-white" },
  {
    name: "Ledger",
    href: "/finance/ledger",
    icon: BookOpen,
    bg: "bg-indigo-500",
    text: "text-white",
  },
];

function NavIcon({
  item,
  isActive,
  mouseX,
}: {
  item: { name: string; href: string; icon: LucideIcon; bg: string; text: string };
  isActive: boolean;
  mouseX: MotionValue<number>;
}): React.JSX.Element {
  const Icon = item.icon;
  const iconRef = React.useRef<HTMLDivElement>(null);

  // Calculate distance from mouse to the center of this icon
  const distance = useTransform(mouseX, (val: number) => {
    const bounds = iconRef.current?.getBoundingClientRect() ?? {
      x: 0,
      width: 0,
    };
    return val - bounds.x - bounds.width / 2;
  });

  // Transform distance into a scale value (Peak size: 64px, Base size: 40px)
  // Magnification zone is [-150, 0, 150] pixels from center
  const scaleSync = useTransform(distance, [-120, 0, 120], [1, 1.3, 1]);
  const scale = useSpring(scaleSync, dockSpringConfig);

  // Transform scale into translation to push adjacent icons away smoothly
  const translateYSync = useTransform(distance, [-120, 0, 120], [0, -6, 0]);
  const translateY = useSpring(translateYSync, dockSpringConfig);

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Link href={item.href} prefetch={true} className="group relative outline-none">
          <motion.div
            ref={iconRef}
            style={{ scale, y: translateY }}
            className={cn(
              "relative flex items-center justify-center rounded-[12px] transition-shadow duration-200",
              "h-10 w-10",
              item.bg,
              item.text,
              isActive
                ? "shadow-lg ring-2 ring-white/25"
                : "opacity-80 hover:opacity-100 hover:shadow-md",
            )}
          >
            <Icon className="relative z-10 h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />

            {/* Active Indicator (Flowing Solar Dot) */}
            {isActive && (
              <motion.div
                layoutId="nav-orbit-indicator"
                className="absolute -bottom-2.5 h-1 w-1 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </motion.div>
        </Link>
      </TooltipTrigger>
      <TooltipContent
        sideOffset={16}
        className="premium-glass border-border/70 text-foreground px-4 py-2 shadow-2xl"
      >
        <p className="text-xs font-bold tracking-wide uppercase">{item.name}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function NavOrbit(): React.JSX.Element {
  const pathname = usePathname();
  const mouseX = useMotionValue(Infinity);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <TooltipProvider>
        <div className="group pointer-events-auto relative">
          {/* Base Plate with Premium Glassmorphism */}
          <motion.div
            className={cn(
              "flex items-end gap-3 rounded-2xl px-4 py-3",
              "premium-glass border border-white/10",
              // Subtle inner glow instead of heavy shadow
              "shadow-inner shadow-primary/20",
              // Add a subtle reflection beneath the dock
              "after:absolute after:right-[10%] after:-bottom-4 after:left-[10%] after:-z-10 after:h-4 after:rounded-full after:bg-gradient-to-t after:from-transparent after:to-primary/5 after:blur-md",
            )}
            onMouseMove={(e) => {
              mouseX.set(e.pageX);
            }}
            onMouseLeave={() => {
              mouseX.set(Infinity);
            }}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
              mass: 0.5,
              delay: 0.1,
            }}
          >
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return <NavIcon key={item.name} item={item} isActive={isActive} mouseX={mouseX} />;
            })}
          </motion.div>
        </div>
      </TooltipProvider>
    </div>
  );
}
