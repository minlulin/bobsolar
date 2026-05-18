"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, FileText, FolderKanban, Users } from "lucide-react";
import { motion, type Variants } from "motion/react";
import Link from "next/link";
import type * as React from "react";

type ActivityItem = {
  type: "quotation" | "project" | "customer" | "alert";
  description: string;
  timestamp: Date;
  link: string;
};

type ActivityStreamProps = {
  items: ActivityItem[];
  isPending?: boolean;
};

const streamItem = {
  hidden: { opacity: 0, y: 12, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 210, damping: 24 },
  },
} satisfies Variants;

export function ActivityStream({
  items,
  isPending = false,
}: ActivityStreamProps): React.JSX.Element {
  if (isPending) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="bg-muted/50 border-border/60 h-16 animate-pulse rounded-2xl border"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground bg-muted/30 border-border/60 rounded-2xl border border-dashed px-4 py-5 text-sm">
        No recent activity.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((activity, index) => (
        <motion.div
          key={`${activity.type}-${activity.timestamp.toString()}-${activity.description}`}
          variants={streamItem}
          initial="hidden"
          animate="show"
          whileHover={{ x: 3 }}
          transition={{ delay: index * 0.045 }}
          className="relative pl-6"
        >
          <span className="via-border/80 absolute top-0 left-1 h-full w-px bg-gradient-to-b from-amber-300/45 to-transparent" />
          <span className="absolute top-1.5 left-0 h-3 w-3 rounded-full border border-amber-200/50 bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.5)]" />
          <Link
            href={activity.link}
            className={`group bg-muted/30 border-border/70 hover:bg-muted/55 flex items-start gap-3 rounded-2xl border border-l-2 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors ${leftBorderClass(activity.type)}`}
          >
            <ActivityIcon type={activity.type} />
            <div>
              <p className="text-muted-foreground group-hover:text-foreground text-sm transition-colors">
                {activity.description}
              </p>
              <p className="text-muted-foreground text-xs">
                {formatDistanceToNow(new Date(activity.timestamp), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

function leftBorderClass(type: "quotation" | "project" | "customer" | "alert"): string {
  if (type === "quotation") return "border-l-indigo-400";
  if (type === "project") return "border-l-emerald-400";
  if (type === "customer") return "border-l-sky-400";
  return "border-l-amber-400";
}

function ActivityIcon({
  type,
}: {
  type: "quotation" | "project" | "customer" | "alert";
}): React.JSX.Element {
  const className = "mt-0.5 h-4 w-4";

  if (type === "quotation") {
    return <FileText className={`${className} text-indigo-400`} />;
  }
  if (type === "project") {
    return <FolderKanban className={`${className} text-emerald-400`} />;
  }
  if (type === "customer") {
    return <Users className={`${className} text-sky-400`} />;
  }

  return <AlertTriangle className={`${className} text-amber-400`} />;
}
