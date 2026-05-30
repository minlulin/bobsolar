import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Warranty & Aftersales",
};

export default function WarrantyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactNode {
  return children;
}
