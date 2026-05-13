export const dashboardStatMeta = [
  {
    title: 'Total Revenue',
    tone: 'from-amber-300 via-orange-400 to-emerald-300',
    description: 'Total recognized revenue across accepted and completed work.',
  },
  {
    title: 'Active Projects',
    tone: 'from-emerald-300 via-teal-400 to-cyan-300',
    description: 'Projects currently in planning, in progress, or on hold.',
  },
  {
    title: 'Pending Quotations',
    tone: 'from-indigo-300 via-violet-400 to-sky-300',
    description: 'Quotations waiting for customer decision (draft or sent).',
  },
  {
    title: 'Accepted This Month',
    tone: 'from-lime-300 via-emerald-400 to-teal-300',
    description: 'Quotations accepted during the current calendar month.',
  },
  {
    title: 'Total Customers',
    tone: 'from-sky-300 via-cyan-400 to-emerald-300',
    description: 'Number of active customer records in the system.',
  },
  {
    title: 'Overdue Alerts',
    tone: 'from-rose-300 via-orange-400 to-amber-300',
    description: 'Warranty or maintenance alerts currently past due.',
  },
] as const;
