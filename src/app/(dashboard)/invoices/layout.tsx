import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoices",
};

export default function InvoicesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactNode {
  return children;
}
