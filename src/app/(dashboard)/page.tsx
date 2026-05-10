import { EnergyFlow } from '@/components/dashboard/energy-flow';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Welcome to BOB Solar.</p>
      <EnergyFlow />
    </div>
  );
}
