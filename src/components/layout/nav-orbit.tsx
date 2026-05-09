'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, ClipboardList, Zap, Package, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Quotes', href: '/quotations', icon: ClipboardList },
  { name: 'Projects', href: '/projects', icon: Zap },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Customers', href: '/customers', icon: Users },
];

export function BottomDock() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 px-4">
      <nav className="flex h-16 items-center justify-around gap-1 rounded-2xl border border-white/10 bg-black/80 p-2 shadow-2xl backdrop-blur-xl">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex h-full flex-1 flex-col items-center justify-center gap-1 rounded-xl transition-colors hover:bg-white/5"
            >
              {isActive && (
                <motion.div
                  layoutId="dock-active"
                  className="bg-solar/10 shadow-glow-solar absolute inset-0 rounded-xl"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <Icon
                className={cn(
                  'h-5 w-5 transition-colors',
                  isActive ? 'text-solar' : 'text-muted-foreground',
                )}
              />
              <span
                className={cn(
                  'text-[10px] font-medium transition-colors',
                  isActive ? 'text-solar' : 'text-muted-foreground',
                )}
              >
                {item.name}
              </span>
              {isActive && (
                <motion.div
                  layoutId="dock-dot"
                  className="bg-solar absolute -bottom-1 h-1 w-1 rounded-full"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
