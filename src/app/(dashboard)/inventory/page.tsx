import { requireAuth } from "@/lib/auth/validate";
import { InventoryPageClient } from "./page-client";

export default async function InventoryPage(): Promise<React.JSX.Element> {
  const auth = await requireAuth();
  return <InventoryPageClient canEdit={auth.role === "admin"} />;
}
