import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customers",
};

export default function CustomersLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactNode {
  return children;
}
