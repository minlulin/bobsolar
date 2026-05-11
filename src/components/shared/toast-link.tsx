'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastLinkInput = {
  title: string;
  href: string;
  description?: string;
  variant?: 'success' | 'error' | 'info' | 'warning';
};

export function showLinkedToast({
  title,
  href,
  description,
  variant = 'info',
}: ToastLinkInput): string | number {
  return toast.custom((id) => (
    <Link
      href={href}
      onClick={() => toast.dismiss(id)}
      className={cn(
        'flex min-w-[280px] items-start justify-between gap-3 rounded-xl border px-4 py-3 shadow-lg transition hover:opacity-95',
        variant === 'success' &&
          'border-emerald-500/40 bg-emerald-950/80 text-emerald-100',
        variant === 'error' && 'border-red-500/40 bg-red-950/80 text-red-100',
        variant === 'warning' &&
          'border-amber-500/40 bg-amber-950/80 text-amber-100',
        variant === 'info' && 'border-sky-500/40 bg-sky-950/80 text-sky-100',
      )}
    >
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description ? (
          <p className="mt-0.5 text-xs opacity-90">{description}</p>
        ) : null}
      </div>
      <ArrowUpRight className="mt-0.5 h-4 w-4 opacity-90" />
    </Link>
  ));
}
