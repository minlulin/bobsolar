'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { AlertTriangle, FileText, FolderKanban, Users } from 'lucide-react';

type ActivityItem = {
  type: 'quotation' | 'project' | 'customer' | 'alert';
  description: string;
  timestamp: Date;
  link: string;
};

type ActivityStreamProps = {
  items: ActivityItem[];
  isLoading?: boolean;
};

export function ActivityStream({ items, isLoading = false }: ActivityStreamProps) {
  if (isLoading) return <p className="text-muted-foreground text-sm">Loading activity...</p>;
  if (items.length === 0) return <p className="text-muted-foreground text-sm">No recent activity.</p>;

  return (
    <div className="space-y-3">
      {items.map((activity, index) => (
        <motion.div
          key={`${activity.type}-${activity.timestamp.toString()}-${activity.description}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="relative pl-6"
        >
          <span className="absolute top-0 left-1 h-full w-px bg-white/10" />
          <span className="absolute top-1.5 left-0.5 h-2 w-2 rounded-full bg-amber-400" />
          <Link
            href={activity.link}
            className={`hover:bg-white/5 flex items-start gap-3 rounded-xl border border-white/10 border-l-2 px-4 py-3 transition-colors ${leftBorderClass(activity.type)}`}
          >
            <ActivityIcon type={activity.type} />
            <div>
              <p className="text-sm">{activity.description}</p>
              <p className="text-xs text-white/50">
                {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
              </p>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

function leftBorderClass(type: 'quotation' | 'project' | 'customer' | 'alert'): string {
  if (type === 'quotation') return 'border-l-indigo-400';
  if (type === 'project') return 'border-l-emerald-400';
  if (type === 'customer') return 'border-l-sky-400';
  return 'border-l-amber-400';
}

function ActivityIcon({ type }: { type: 'quotation' | 'project' | 'customer' | 'alert' }) {
  if (type === 'quotation') return <FileText className="mt-0.5 h-4 w-4 text-indigo-400" />;
  if (type === 'project') return <FolderKanban className="mt-0.5 h-4 w-4 text-emerald-400" />;
  if (type === 'customer') return <Users className="mt-0.5 h-4 w-4 text-sky-400" />;
  return <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />;
}
