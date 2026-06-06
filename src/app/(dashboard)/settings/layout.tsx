import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/validate";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.ReactNode> {
  const session = await requireAuth();

  // Only admins can access settings — owner role is redirected to the dashboard
  if (session.role !== "admin") {
    redirect("/");
  }

  return children;
}
