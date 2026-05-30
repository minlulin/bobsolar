"use client";

import * as React from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PREF_KEY = "bobsolar.preferences.v1";

const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  defaultTaxPercent: z.string(),
  defaultWarrantyMonths: z.string(),
});

type Preferences = z.infer<typeof preferencesSchema>;

const defaults: Preferences = {
  theme: "system",
  defaultTaxPercent: "5",
  defaultWarrantyMonths: "12",
};

export function PreferencesTab(): React.JSX.Element {
  const [prefs, setPrefs] = React.useState<Preferences>(() => {
    if (typeof window === "undefined") return defaults;
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return defaults;
    try {
      const parsed = preferencesSchema.partial().safeParse(JSON.parse(raw));
      if (!parsed.success) return defaults;
      return {
        theme: parsed.data.theme ?? defaults.theme,
        defaultTaxPercent: parsed.data.defaultTaxPercent ?? defaults.defaultTaxPercent,
        defaultWarrantyMonths: parsed.data.defaultWarrantyMonths ?? defaults.defaultWarrantyMonths,
      };
    } catch {
      return defaults;
    }
  });

  function savePreferences(): void {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    toast.success("Preferences saved");
  }

  return (
    <div className="border-border bg-card max-w-3xl space-y-6 rounded-xl border p-6">
      <h3 className="font-heading text-lg font-semibold">Preferences</h3>
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs">Theme</Label>
        <Select
          value={prefs.theme}
          onValueChange={(value) => {
            const theme = preferencesSchema.shape.theme.safeParse(value);
            if (!theme.success) return;
            setPrefs((p) => ({
              ...p,
              theme: theme.data,
            }));
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs">Default Tax %</Label>
        <Input
          value={prefs.defaultTaxPercent}
          onChange={(e) => {
            setPrefs((p) => ({ ...p, defaultTaxPercent: e.target.value }));
          }}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs">
          Default Warranty Alert Duration (months)
        </Label>
        <Input
          value={prefs.defaultWarrantyMonths}
          onChange={(e) => {
            setPrefs((p) => ({ ...p, defaultWarrantyMonths: e.target.value }));
          }}
        />
      </div>
      <Button className="rounded-lg" onClick={savePreferences}>
        Save Preferences
      </Button>
    </div>
  );
}
