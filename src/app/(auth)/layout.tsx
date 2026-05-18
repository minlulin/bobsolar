import { redirect } from "next/navigation";
import { getSessionFromCookie } from "@/lib/auth/session";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const session = await getSessionFromCookie();

  if (session) {
    redirect("/");
  }

  return <div className="min-h-screen">{children}</div>;
}
