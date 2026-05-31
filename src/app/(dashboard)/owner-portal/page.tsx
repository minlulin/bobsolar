import type { Metadata } from "next";
import { getOwnerPortalData } from "./actions";
import { OwnerPortalClient } from "./client";

export const metadata: Metadata = {
  title: "Owner Portal - Shareholder Equity",
  description: "View company reserves and individual owner capital accounts.",
};

export default async function OwnerPortalPage() {
  const data = await getOwnerPortalData();

  return (
    <div className="w-full h-full p-4 md:p-8 overflow-y-auto">
      <OwnerPortalClient data={data} />
    </div>
  );
}
