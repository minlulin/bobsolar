import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects",
};

export default function ProjectsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactNode {
  return children;
}
