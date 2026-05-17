'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import {
  getCompanySettings,
  setCompanyLogoUrl,
  updateCompanySettings,
} from '@/actions/settings-actions';
import { FileUpload } from '@/components/shared/file-upload';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccountTab } from './components/account-tab';
import { UserManagementTab } from './components/user-management-tab';
import { PreferencesTab } from './components/preferences-tab';
import { COMPANY_SETTING_KEYS } from '@/lib/domain/settings-keys';

const LOGO_KEY = COMPANY_SETTING_KEYS.LOGO_URL;

const companySchema = z.object({
  [COMPANY_SETTING_KEYS.NAME]: z.string().min(1, 'Company name is required'),
  [COMPANY_SETTING_KEYS.ADDRESS]: z.string().optional(),
  [COMPANY_SETTING_KEYS.PHONE]: z.string().min(1, 'Phone is required'),
  [COMPANY_SETTING_KEYS.EMAIL]: z.email(),
  [COMPANY_SETTING_KEYS.TAX_ID]: z.string().optional(),
  [COMPANY_SETTING_KEYS.BANK_NAME]: z.string().optional(),
  [COMPANY_SETTING_KEYS.BANK_ACCOUNT_NUMBER]: z.string().optional(),
  [COMPANY_SETTING_KEYS.BANK_ACCOUNT_HOLDER]: z.string().optional(),
});

type CompanyForm = z.infer<typeof companySchema>;

export default function SettingsPage(): React.JSX.Element {
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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      [COMPANY_SETTING_KEYS.NAME]: '',
      [COMPANY_SETTING_KEYS.ADDRESS]: '',
      [COMPANY_SETTING_KEYS.PHONE]: '',
      [COMPANY_SETTING_KEYS.EMAIL]: '',
      [COMPANY_SETTING_KEYS.TAX_ID]: '',
      [COMPANY_SETTING_KEYS.BANK_NAME]: '',
      [COMPANY_SETTING_KEYS.BANK_ACCOUNT_NUMBER]: '',
      [COMPANY_SETTING_KEYS.BANK_ACCOUNT_HOLDER]: '',
    },
  });

  React.useEffect(() => {
    if (!settingsQuery.data) return;
    reset({
      [COMPANY_SETTING_KEYS.NAME]:
        settingsQuery.data[COMPANY_SETTING_KEYS.NAME] ?? '',
      [COMPANY_SETTING_KEYS.ADDRESS]:
        settingsQuery.data[COMPANY_SETTING_KEYS.ADDRESS] ?? '',
      [COMPANY_SETTING_KEYS.PHONE]:
        settingsQuery.data[COMPANY_SETTING_KEYS.PHONE] ?? '',
      [COMPANY_SETTING_KEYS.EMAIL]:
        settingsQuery.data[COMPANY_SETTING_KEYS.EMAIL] ?? '',
      [COMPANY_SETTING_KEYS.TAX_ID]:
        settingsQuery.data[COMPANY_SETTING_KEYS.TAX_ID] ?? '',
      [COMPANY_SETTING_KEYS.BANK_NAME]:
        settingsQuery.data[COMPANY_SETTING_KEYS.BANK_NAME] ?? '',
      [COMPANY_SETTING_KEYS.BANK_ACCOUNT_NUMBER]:
        settingsQuery.data[COMPANY_SETTING_KEYS.BANK_ACCOUNT_NUMBER] ?? '',
      [COMPANY_SETTING_KEYS.BANK_ACCOUNT_HOLDER]:
        settingsQuery.data[COMPANY_SETTING_KEYS.BANK_ACCOUNT_HOLDER] ?? '',
    });
  }, [settingsQuery.data, reset]);

  async function persistLogo(url: string): Promise<void> {
    setLogoSaving(true);
    try {
      const res = await setCompanyLogoUrl({ url });
      if (res.success) {
        toast.success('Company logo synced');
        void settingsQuery.refetch();
      } else {
        toast.error(res.error);
      }
    } finally {
      setLogoSaving(false);
    }
  }

  async function onSubmit(values: CompanyForm): Promise<void> {
    setInfoSaving(true);
    try {
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) payload[k] = v ?? '';
      const res = await updateCompanySettings(payload);
      if (res.success) {
        toast.success('Company info saved successfully');
        void settingsQuery.refetch();
      } else {
        toast.error(res.error);
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
          Settings
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
          Configure brand identity, team access, and default behavior.
        </p>
      </div>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="border-border bg-card mb-8 w-full justify-start border">
          <TabsTrigger value="company">Company Info</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="account">Account & Security</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <section className="border-border bg-card space-y-4 rounded-xl border p-6">
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

            <section className="border-border bg-card space-y-6 rounded-xl border p-6">
              <Label className="text-[11px] font-bold tracking-[0.3em] uppercase">
                Company Profile
              </Label>

              <form
                onSubmit={(e) => {
                  void handleSubmit(onSubmit)(e);
                }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <Label
                    htmlFor={COMPANY_SETTING_KEYS.NAME}
                    className="text-muted-foreground text-xs"
                  >
                    Company Name
                  </Label>
                  <Input
                    id={COMPANY_SETTING_KEYS.NAME}
                    {...register(COMPANY_SETTING_KEYS.NAME)}
                    className="border-border/70 bg-muted/45"
                  />
                  {errors[COMPANY_SETTING_KEYS.NAME] ? (
                    <p className="text-destructive text-xs">
                      {errors[COMPANY_SETTING_KEYS.NAME]?.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor={COMPANY_SETTING_KEYS.ADDRESS}
                    className="text-muted-foreground text-xs"
                  >
                    Address
                  </Label>
                  <Textarea
                    id={COMPANY_SETTING_KEYS.ADDRESS}
                    {...register(COMPANY_SETTING_KEYS.ADDRESS)}
                    className="border-border/70 bg-muted/45"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label
                      htmlFor={COMPANY_SETTING_KEYS.PHONE}
                      className="text-muted-foreground text-xs"
                    >
                      Phone
                    </Label>
                    <Input
                      id={COMPANY_SETTING_KEYS.PHONE}
                      {...register(COMPANY_SETTING_KEYS.PHONE)}
                      className="border-border/70 bg-muted/45"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor={COMPANY_SETTING_KEYS.EMAIL}
                      className="text-muted-foreground text-xs"
                    >
                      Email
                    </Label>
                    <Input
                      id={COMPANY_SETTING_KEYS.EMAIL}
                      {...register(COMPANY_SETTING_KEYS.EMAIL)}
                      className="border-border/70 bg-muted/45"
                    />
                    {errors[COMPANY_SETTING_KEYS.EMAIL] ? (
                      <p className="text-destructive text-xs">
                        {errors[COMPANY_SETTING_KEYS.EMAIL]?.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor={COMPANY_SETTING_KEYS.TAX_ID}
                    className="text-muted-foreground text-xs"
                  >
                    Tax ID / TIN
                  </Label>
                  <Input
                    id={COMPANY_SETTING_KEYS.TAX_ID}
                    {...register(COMPANY_SETTING_KEYS.TAX_ID)}
                    className="border-border/70 bg-muted/45"
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    htmlFor={COMPANY_SETTING_KEYS.BANK_NAME}
                    className="text-muted-foreground text-xs"
                  >
                    Bank Name
                  </Label>
                  <Input
                    id={COMPANY_SETTING_KEYS.BANK_NAME}
                    {...register(COMPANY_SETTING_KEYS.BANK_NAME)}
                    className="border-border/70 bg-muted/45"
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor={COMPANY_SETTING_KEYS.BANK_ACCOUNT_NUMBER}
                    className="text-muted-foreground text-xs"
                  >
                    Bank Account Number
                  </Label>
                  <Input
                    id={COMPANY_SETTING_KEYS.BANK_ACCOUNT_NUMBER}
                    {...register(COMPANY_SETTING_KEYS.BANK_ACCOUNT_NUMBER)}
                    className="border-border/70 bg-muted/45"
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor={COMPANY_SETTING_KEYS.BANK_ACCOUNT_HOLDER}
                    className="text-muted-foreground text-xs"
                  >
                    Bank Account Holder Name
                  </Label>
                  <Input
                    id={COMPANY_SETTING_KEYS.BANK_ACCOUNT_HOLDER}
                    {...register(COMPANY_SETTING_KEYS.BANK_ACCOUNT_HOLDER)}
                    className="border-border/70 bg-muted/45"
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

        <TabsContent value="users">
          <UserManagementTab />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesTab />
        </TabsContent>

        <TabsContent value="account">
          <AccountTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
