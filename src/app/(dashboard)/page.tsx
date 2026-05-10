import type { Metadata } from 'next';
import DashboardPage from './dashboard-page-client';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default function DashboardRootPage() {
  return <DashboardPage />;
}
