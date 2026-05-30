import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quotations",
};

export default function QuotationsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactNode {
  return children;
}
