'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { Home, ClipboardList, Zap, Package, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// --- Premium Physics Configuration ---
// Insanely responsive spring: snaps without aggressive bounce
const dockSpringConfig = {
  mass: 0.1,
  stiffness: 400,
  damping: 30,
};

const navItems = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Quotations', href: '/quotations', icon: ClipboardList },
  { name: 'Projects', href: '/projects', icon: Zap },
  { name: 'Inventory', href: '/inventory', icon: Package },
];

function NavIcon({
  item,
  isActive,
  mouseX,
}: {
  item: { name: string; href: string; icon: LucideIcon };
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
  const scaleSync = useTransform(distance, [-150, 0, 150], [1, 1.6, 1]);
  const scale = useSpring(scaleSync, dockSpringConfig);

  // Transform scale into translation to push adjacent icons away smoothly
  const translateYSync = useTransform(distance, [-150, 0, 150], [0, -8, 0]);
  const translateY = useSpring(translateYSync, dockSpringConfig);

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          prefetch={true}
          className="group relative outline-none"
        >
          <motion.div
            ref={iconRef}
            style={{ scale, y: translateY }}
            className={cn(
              'relative flex items-center justify-center rounded-xl transition-colors duration-300',
              'h-10 w-10', // Base size (40px)
              isActive
                ? 'text-[var(--color-solar-amber)]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )}
          >
            <Icon
              className="relative z-10 h-5 w-5 drop-shadow-md"
              strokeWidth={isActive ? 2.5 : 2}
            />

            {/* Active Indicator (Flowing Solar Dot) */}
            {isActive && (
              <motion.div
                layoutId="nav-orbit-indicator"
                className="absolute -bottom-2 h-1.5 w-1.5 rounded-full bg-[var(--color-solar-amber)] shadow-[0_0_8px_rgba(var(--color-solar-amber),0.8)]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </motion.div>
        </Link>
      </TooltipTrigger>
      <TooltipContent
        sideOffset={16}
        className="premium-glass text-foreground border-border/70 shadow-xl"
      >
        <p className="text-sm font-medium">{item.name}</p>
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
              'flex items-end gap-3 rounded-2xl px-4 py-3',
              'premium-glass',
              // Add a subtle reflection beneath the dock
              'after:absolute after:right-[10%] after:-bottom-4 after:left-[10%] after:-z-10 after:h-4 after:rounded-full after:bg-gradient-to-t after:from-transparent after:to-white/5 after:blur-md',
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
              type: 'spring',
              stiffness: 300,
              damping: 25,
              mass: 0.5,
              delay: 0.1,
            }}
          >
            {navItems.map((item) => (
              <NavIcon
                key={item.name}
                item={item}
                isActive={pathname === item.href}
                mouseX={mouseX}
              />
            ))}
          </motion.div>
        </div>
      </TooltipProvider>
    </div>
  );
}
