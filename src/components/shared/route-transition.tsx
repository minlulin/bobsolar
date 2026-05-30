"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Wraps page content with a fade-in animation on mount.
 * Uses a stable key (none) so the children are NOT remounted on navigation —
 * only the initial mount triggers the animation.
 */
export function RouteTransition({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  );
}
