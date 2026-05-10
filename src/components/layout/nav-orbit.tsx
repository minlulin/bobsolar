'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { Home, ClipboardList, Zap, Package, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const dockSpring = {
  mass: 0.42,
  stiffness: 280,
  damping: 24,
} as const;

const navItems = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Quotes', href: '/quotations', icon: ClipboardList },
  { name: 'Projects', href: '/projects', icon: Zap },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Customers', href: '/customers', icon: Users },
] satisfies ReadonlyArray<{
  name: string;
  href: string;
  icon: LucideIcon;
}>;

type DockItemProps = {
  href: string;
  icon: LucideIcon;
  isActive: boolean;
  mouseX: MotionValue<number>;
  name: string;
};

function DockItem({
  href,
  icon: Icon,
  isActive,
  mouseX,
  name,
}: DockItemProps): React.JSX.Element {
  const ref = React.useRef<HTMLAnchorElement>(null);
  const distance = useTransform(mouseX, (latestMouseX: number): number => {
    const bounds = ref.current?.getBoundingClientRect();

    if (bounds === undefined || !Number.isFinite(latestMouseX)) {
      return 1_000;
    }

    return latestMouseX - bounds.left - bounds.width / 2;
  });

  const itemWidth = useSpring(
    useTransform(distance, [-150, 0, 150], [58, 76, 58], { clamp: true }),
    dockSpring,
  );
  const iconSize = useSpring(
    useTransform(distance, [-150, 0, 150], [20, 31, 20], { clamp: true }),
    dockSpring,
  );
  const lift = useSpring(
    useTransform(distance, [-150, 0, 150], [0, -13, 0], { clamp: true }),
    dockSpring,
  );
  const glowOpacity = useSpring(
    useTransform(distance, [-140, 0, 140], [0, 0.95, 0], { clamp: true }),
    { ...dockSpring, damping: 28 },
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          className="relative flex h-full items-center justify-center"
          style={{ width: itemWidth }}
        >
          <Link
            ref={ref}
            href={href}
            aria-label={name}
            aria-current={isActive ? 'page' : undefined}
            className="group relative flex h-full w-full items-center justify-center rounded-xl outline-none"
          >
            {isActive && (
              <motion.div
                layoutId="dock-active"
                className="absolute inset-x-0 top-1 bottom-1 rounded-xl bg-white/10 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.22),0_14px_36px_-18px_rgb(245_158_11_/_0.85)]"
                transition={{ type: 'spring', bounce: 0.16, duration: 0.65 }}
              />
            )}

            <motion.div
              aria-hidden="true"
              className="absolute h-11 w-11 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.34)_0%,rgba(16,185,129,0.12)_46%,transparent_72%)] blur-xl"
              style={{ opacity: glowOpacity, y: lift }}
            />

            <motion.div
              className={cn(
                'relative grid place-items-center rounded-xl border transition-colors duration-500',
                'border-white/0 bg-white/0 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08)]',
                'group-hover:border-white/15 group-hover:bg-white/10',
                'group-focus-visible:border-solar-amber/60 group-focus-visible:ring-solar-amber/35 group-focus-visible:ring-2',
                isActive && 'border-solar-amber/25 bg-solar-amber/10',
              )}
              style={{
                height: itemWidth,
                width: itemWidth,
                y: lift,
              }}
              whileTap={{ scale: 0.92, y: -3 }}
              transition={dockSpring}
            >
              <motion.span
                className="absolute inset-0 rounded-xl bg-[linear-gradient(135deg,rgba(255,255,255,0.30),transparent_36%,rgba(255,255,255,0.08)_70%,transparent)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                aria-hidden="true"
              />
              <motion.div
                className={cn(
                  'relative grid place-items-center transition-colors duration-300',
                  isActive ? 'text-solar-amber' : 'text-muted-foreground',
                  'group-hover:text-foreground',
                )}
                style={{ height: iconSize, width: iconSize }}
              >
                <Icon
                  className="h-full w-full"
                  strokeWidth={isActive ? 2.35 : 2}
                />
              </motion.div>
            </motion.div>

            <motion.span
              className={cn(
                'bg-solar shadow-solar pointer-events-none absolute -bottom-3 h-1 rounded-full opacity-0',
                isActive && 'opacity-100',
              )}
              animate={{ width: isActive ? 18 : 4 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            />
          </Link>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={16}
        className="border border-white/10 bg-black/85 px-2.5 py-1 text-[11px] font-medium text-white shadow-2xl backdrop-blur-xl"
      >
        {name}
      </TooltipContent>
    </Tooltip>
  );
}

export function BottomDock(): React.JSX.Element {
  const pathname = usePathname();
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);

  return (
    <TooltipProvider delayDuration={120}>
      <motion.div
        className="fixed bottom-5 left-1/2 z-50 w-full max-w-xl -translate-x-1/2 px-4 sm:bottom-6"
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          type: 'spring',
          stiffness: 170,
          damping: 22,
          delay: 0.08,
        }}
      >
        <motion.nav
          aria-label="Primary navigation"
          onMouseMove={(event: React.MouseEvent<HTMLElement>): void => {
            mouseX.set(event.clientX);
          }}
          onMouseLeave={(): void => {
            mouseX.set(Number.POSITIVE_INFINITY);
          }}
          className={cn(
            'relative mx-auto flex h-[76px] w-fit max-w-full items-end justify-center gap-1 overflow-visible rounded-3xl px-2 pt-3 pb-2',
            'border border-white/15 bg-black/72 shadow-[0_24px_80px_-32px_rgb(0_0_0_/_0.85),inset_0_1px_0_rgb(255_255_255_/_0.22)] backdrop-blur-2xl',
            'before:pointer-events-none before:absolute before:inset-x-8 before:top-px before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/45 before:to-transparent',
            'after:pointer-events-none after:absolute after:inset-0 after:rounded-3xl after:bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.18),transparent_46%)]',
          )}
        >
          <motion.div
            aria-hidden="true"
            className="absolute inset-x-5 bottom-1 h-5 rounded-full bg-black/45 blur-lg"
            animate={{ opacity: [0.55, 0.8, 0.55], scaleX: [0.94, 1, 0.94] }}
            transition={{
              duration: 4.8,
              ease: [0.33, 1, 0.68, 1],
              repeat: Infinity,
              repeatType: 'mirror',
            }}
          />
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <DockItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                isActive={isActive}
                mouseX={mouseX}
                name={item.name}
              />
            );
          })}
        </motion.nav>
      </motion.div>
    </TooltipProvider>
  );
}
