import { dehydrate, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { getCompanySettings } from "@/actions/settings-actions";
import { settingsKeys } from "@/lib/query-keys";
import { SettingsPageHydrated } from "./settings-page-hydrated";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const queryClient = new QueryClient();

  const settings = await getCompanySettings();

  if (settings.success) {
    queryClient.setQueryData(settingsKeys.company(), settings.data);
  }

  const dehydratedState = dehydrate(queryClient);

  return <SettingsPageHydrated state={dehydratedState} />;
}
