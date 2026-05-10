'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PREF_KEY = 'bobsolar.preferences.v1';

type Preferences = {
  theme: 'light' | 'dark' | 'system';
  defaultTaxPercent: string;
  defaultWarrantyMonths: string;
};

const defaults: Preferences = {
  theme: 'system',
  defaultTaxPercent: '5',
  defaultWarrantyMonths: '12',
};

export function PreferencesTab() {
  const [prefs, setPrefs] = React.useState<Preferences>(() => {
    if (typeof window === 'undefined') return defaults;
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return defaults;
    try {
      const parsed = JSON.parse(raw) as Partial<Preferences>;
      return { ...defaults, ...parsed };
    } catch {
      return defaults;
    }
  });

  function savePreferences() {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    toast.success('Preferences saved');
  }

  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-black/55 p-6">
      <h3 className="font-heading text-lg font-semibold">Preferences</h3>
      <div className="space-y-2">
        <Label>Theme</Label>
        <Select
          value={prefs.theme}
          onValueChange={(value) =>
            setPrefs((p) => ({
              ...p,
              theme: value as 'light' | 'dark' | 'system',
            }))
          }
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
        <Label>Default Tax %</Label>
        <Input
          value={prefs.defaultTaxPercent}
          onChange={(e) =>
            setPrefs((p) => ({ ...p, defaultTaxPercent: e.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Default Warranty Alert Duration (months)</Label>
        <Input
          value={prefs.defaultWarrantyMonths}
          onChange={(e) =>
            setPrefs((p) => ({ ...p, defaultWarrantyMonths: e.target.value }))
          }
        />
      </div>
      <Button onClick={savePreferences}>Save Preferences</Button>
    </div>
  );
}
