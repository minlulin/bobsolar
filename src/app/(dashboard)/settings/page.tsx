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

const LOGO_KEY = 'company_logo_url';

const companySchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  company_address: z.string().optional(),
  company_phone: z.string().min(1, 'Phone is required'),
  company_email: z.string().email('Invalid email'),
  company_tax_id: z.string().optional(),
  company_bank_name: z.string().optional(),
  company_bank_account_number: z.string().optional(),
  company_bank_account_holder: z.string().optional(),
});

type CompanyForm = z.infer<typeof companySchema>;

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

  const usersQuery = useQuery({
    queryKey: ['settings', 'users-role'],
    queryFn: async () => {
      const mod = await import('@/actions/settings-actions');
      const res = await mod.getSettingsUsers();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 60 * 1000,
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
      company_name: '',
      company_address: '',
      company_phone: '',
      company_email: '',
      company_tax_id: '',
      company_bank_name: '',
      company_bank_account_number: '',
      company_bank_account_holder: '',
    },
  });

  React.useEffect(() => {
    if (!settingsQuery.data) return;
    reset({
      company_name: settingsQuery.data['company_name'] ?? '',
      company_address: settingsQuery.data['company_address'] ?? '',
      company_phone: settingsQuery.data['company_phone'] ?? '',
      company_email: settingsQuery.data['company_email'] ?? '',
      company_tax_id: settingsQuery.data['company_tax_id'] ?? '',
      company_bank_name: settingsQuery.data['company_bank_name'] ?? '',
      company_bank_account_number:
        settingsQuery.data['company_bank_account_number'] ?? '',
      company_bank_account_holder:
        settingsQuery.data['company_bank_account_holder'] ?? '',
    });
  }, [settingsQuery.data, reset]);

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

  async function onSubmit(values: CompanyForm) {
    setInfoSaving(true);
    try {
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) payload[k] = v ?? '';
      const res = await updateCompanySettings(payload);
      if (res.success) {
        toast.success('Company info saved successfully');
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
  void usersQuery.data?.isAdmin;

  return (
    <div className="mx-auto space-y-10 pb-36">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tighter">
          Studio settings
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
          Configure brand identity, team access, and default behavior.
        </p>
      </div>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="mb-8 border border-white/5 bg-black/55">
          <TabsTrigger value="company">Company Info</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
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

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="company_name" className="text-muted-foreground text-xs">
                    Company Name
                  </Label>
                  <Input id="company_name" {...register('company_name')} className="border-white/10 bg-white/5" />
                  {errors.company_name ? <p className="text-destructive text-xs">{errors.company_name.message}</p> : null}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="company_address" className="text-muted-foreground text-xs">
                    Address
                  </Label>
                  <Textarea id="company_address" {...register('company_address')} className="border-white/10 bg-white/5" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="company_phone" className="text-muted-foreground text-xs">
                      Phone
                    </Label>
                    <Input id="company_phone" {...register('company_phone')} className="border-white/10 bg-white/5" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="company_email" className="text-muted-foreground text-xs">
                      Email
                    </Label>
                    <Input id="company_email" {...register('company_email')} className="border-white/10 bg-white/5" />
                    {errors.company_email ? <p className="text-destructive text-xs">{errors.company_email.message}</p> : null}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="company_tax_id" className="text-muted-foreground text-xs">
                    Tax ID / TIN
                  </Label>
                  <Input id="company_tax_id" {...register('company_tax_id')} className="border-white/10 bg-white/5" />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="company_bank_name" className="text-muted-foreground text-xs">
                    Bank Name
                  </Label>
                  <Input id="company_bank_name" {...register('company_bank_name')} className="border-white/10 bg-white/5" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="company_bank_account_number" className="text-muted-foreground text-xs">
                    Bank Account Number
                  </Label>
                  <Input id="company_bank_account_number" {...register('company_bank_account_number')} className="border-white/10 bg-white/5" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="company_bank_account_holder" className="text-muted-foreground text-xs">
                    Bank Account Holder Name
                  </Label>
                  <Input id="company_bank_account_holder" {...register('company_bank_account_holder')} className="border-white/10 bg-white/5" />
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
