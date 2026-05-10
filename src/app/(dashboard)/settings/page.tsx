'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  getCompanySettings,
  setCompanyLogoUrl,
  updateCompanySettings,
} from '@/actions/settings-actions';
import { FileUpload } from '@/components/shared/file-upload';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccountTab } from './components/account-tab';

const LOGO_KEY = 'company_logo_url';
const INFO_KEYS = [
  'company_name',
  'company_address',
  'company_phone',
  'company_email',
  'company_tax_id',
  'company_bank_details',
];

export default function SettingsPage() {
  const settingsQuery = useQuery({
    queryKey: ['settings', 'company'],
    queryFn: async () => {
      const response = await getCompanySettings();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [logoSaving, setLogoSaving] = React.useState(false);
  const [infoSaving, setInfoSaving] = React.useState(false);
  const [formEdits, setFormEdits] = React.useState<Record<string, string>>({});

  async function persistLogo(url: string) {
    setLogoSaving(true);
    try {
      const res = await setCompanyLogoUrl({ url });
      if (res.success) {
        toast.success('Company logo synced');
        void settingsQuery.refetch();
      } else {
        toast.error(res.error ?? 'Logo save failed');
      }
    } finally {
      setLogoSaving(false);
    }
  }

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    setInfoSaving(true);
    try {
      const payload: Record<string, string> = {};
      INFO_KEYS.forEach((key) => {
        const value = formEdits[key] ?? settingsQuery.data?.[key] ?? '';
        payload[key] = String(value);
      });
      const res = await updateCompanySettings(payload);
      if (res.success) {
        toast.success('Company info saved successfully');
        setFormEdits({});
        void settingsQuery.refetch();
      } else {
        toast.error(res.error ?? 'Failed to save company info');
      }
    } finally {
      setInfoSaving(false);
    }
  }

  const logoUrl =
    typeof settingsQuery.data?.[LOGO_KEY] === 'string'
      ? settingsQuery.data[LOGO_KEY]
      : '';

  return (
    <div className="mx-auto space-y-10 pb-36">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tighter">
          Studio settings
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
          Upload the BOB Solar mark — it echoes through PDF quotations and
          onboarding moments. Configure company information that appears on
          official documents.
        </p>
      </div>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="mb-8 border border-white/5 bg-black/55">
          <TabsTrigger value="company">Company Details</TabsTrigger>
          <TabsTrigger value="account">Account & Security</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <section className="border-border space-y-4 rounded-[2rem] border bg-black/55 p-8 backdrop-blur">
              <Label className="text-[11px] font-bold tracking-[0.3em] uppercase">
                Brand crest
              </Label>
              <FileUpload
                folder="logos"
                disabled={logoSaving || settingsQuery.isFetching}
                onUploaded={(next) => void persistLogo(next)}
              />
              {logoUrl ? (
                <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
                  Live asset synced
                </p>
              ) : (
                <p className="text-muted-foreground text-[11px]">
                  JPG · PNG · Webp — 5 MB max per upload burst
                </p>
              )}
            </section>

            <section className="border-border space-y-6 rounded-[2rem] border bg-black/55 p-8 backdrop-blur">
              <Label className="text-[11px] font-bold tracking-[0.3em] uppercase">
                Company Profile
              </Label>

              <form onSubmit={handleSaveInfo} className="space-y-4">
                <div className="space-y-1">
                  <Label
                    htmlFor="company_name"
                    className="text-muted-foreground text-xs"
                  >
                    Company Name
                  </Label>
                  <Input
                    id="company_name"
                    value={
                      formEdits['company_name'] ??
                      settingsQuery.data?.['company_name'] ??
                      ''
                    }
                    onChange={(e) =>
                      setFormEdits((prev) => ({
                        ...prev,
                        company_name: e.target.value,
                      }))
                    }
                    className="border-white/10 bg-white/5"
                    placeholder="BOB Solar"
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="company_address"
                    className="text-muted-foreground text-xs"
                  >
                    Address
                  </Label>
                  <Input
                    id="company_address"
                    value={
                      formEdits['company_address'] ??
                      settingsQuery.data?.['company_address'] ??
                      ''
                    }
                    onChange={(e) =>
                      setFormEdits((prev) => ({
                        ...prev,
                        company_address: e.target.value,
                      }))
                    }
                    className="border-white/10 bg-white/5"
                    placeholder="123 Solar Street, Yangon"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label
                      htmlFor="company_phone"
                      className="text-muted-foreground text-xs"
                    >
                      Phone
                    </Label>
                    <Input
                      id="company_phone"
                      value={
                        formEdits['company_phone'] ??
                        settingsQuery.data?.['company_phone'] ??
                        ''
                      }
                      onChange={(e) =>
                        setFormEdits((prev) => ({
                          ...prev,
                          company_phone: e.target.value,
                        }))
                      }
                      className="border-white/10 bg-white/5"
                      placeholder="+95 9 123 456 789"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="company_email"
                      className="text-muted-foreground text-xs"
                    >
                      Email
                    </Label>
                    <Input
                      id="company_email"
                      value={
                        formEdits['company_email'] ??
                        settingsQuery.data?.['company_email'] ??
                        ''
                      }
                      onChange={(e) =>
                        setFormEdits((prev) => ({
                          ...prev,
                          company_email: e.target.value,
                        }))
                      }
                      className="border-white/10 bg-white/5"
                      placeholder="info@bobsolar.com"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="company_tax_id"
                    className="text-muted-foreground text-xs"
                  >
                    Tax ID / TIN
                  </Label>
                  <Input
                    id="company_tax_id"
                    value={
                      formEdits['company_tax_id'] ??
                      settingsQuery.data?.['company_tax_id'] ??
                      ''
                    }
                    onChange={(e) =>
                      setFormEdits((prev) => ({
                        ...prev,
                        company_tax_id: e.target.value,
                      }))
                    }
                    className="border-white/10 bg-white/5"
                    placeholder="TIN-2026-XXXXX"
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor="company_bank_details"
                    className="text-muted-foreground text-xs"
                  >
                    Bank Details
                  </Label>
                  <Input
                    id="company_bank_details"
                    value={
                      formEdits['company_bank_details'] ??
                      settingsQuery.data?.['company_bank_details'] ??
                      ''
                    }
                    onChange={(e) =>
                      setFormEdits((prev) => ({
                        ...prev,
                        company_bank_details: e.target.value,
                      }))
                    }
                    className="border-white/10 bg-white/5"
                    placeholder="KBZ Bank | A/C: 123-456-789-0"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={infoSaving || settingsQuery.isFetching}
                  className="mt-2 w-full"
                >
                  {infoSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save Company Info
                </Button>
              </form>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="account">
          <AccountTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
