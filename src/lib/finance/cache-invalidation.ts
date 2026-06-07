"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

export async function invalidateFinanceCache(): Promise<void> {
  revalidateTag(CACHE_TAGS.FINANCE, "default");
  revalidatePath("/finance");
  revalidatePath("/finance/expenses");
  revalidatePath("/finance/ledger");
  revalidatePath("/finance/reports");
  revalidatePath("/finance/transfers");
  revalidatePath("/");
}

export async function invalidateFinanceCacheForWrite(): Promise<void> {
  revalidateTag(CACHE_TAGS.FINANCE, "default");
  revalidateTag(CACHE_TAGS.LEDGER, "default");
  revalidatePath("/finance");
  revalidatePath("/finance/expenses");
  revalidatePath("/finance/ledger");
  revalidatePath("/finance/reports");
  revalidatePath("/finance/transfers");
  revalidatePath("/");
}
