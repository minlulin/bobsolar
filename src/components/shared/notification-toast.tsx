"use client";

import { Toaster } from "@/components/ui/sonner";

export function NotificationToast(): React.JSX.Element {
  return <Toaster position="top-right" duration={5000} richColors closeButton />;
}
