import type { ActionResponse } from "@/lib/utils/action-response";

export async function unwrap<T>(action: () => Promise<ActionResponse<T>>): Promise<T> {
  const res = await action();
  if (!res.success) throw new Error(res.error);
  return res.data;
}
