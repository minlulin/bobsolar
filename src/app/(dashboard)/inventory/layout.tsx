import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inventory & Pricing",
};

export default function InventoryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactNode {
  return children;
}
