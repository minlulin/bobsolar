'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { getCompanySettings, setCompanyLogoUrl } from '@/actions/settings-actions';
import { FileUpload } from '@/components/shared/file-upload';
import { Label } from '@/components/ui/label';

const LOGO_KEY = 'company_logo_url';

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
          Upload the BOB Solar mark — it echoes through PDF quotations and onboarding moments.
          Add{' '}
          <span className="text-solar font-mono text-[11px]">BLOB_READ_WRITE_TOKEN</span> in Vercel
          for Blob-backed uploads.
        </p>
      </div>

      <section className="border-border max-w-xl space-y-4 rounded-[2rem] border bg-black/55 p-8 backdrop-blur">
        <Label className="text-[11px] font-bold uppercase tracking-[0.3em]">
          Brand crest
        </Label>
        <FileUpload
          folder="logos"
          disabled={logoSaving || settingsQuery.isFetching}
          onUploaded={(next) => void persistLogo(next)}
        />
        {logoUrl ? (
          <p className="text-muted-foreground text-[11px] uppercase tracking-wide">
            Live asset synced
          </p>
        ) : (
          <p className="text-muted-foreground text-[11px]">
            JPG · PNG · Webp — 5 MB max per upload burst
          </p>
        )}
      </section>
    </div>
  );
}
