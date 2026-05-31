import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { type UseFormRegister, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  getCompanySettings,
  setCompanyLogoUrl,
  updateCompanySettings,
} from "@/actions/settings-actions";
import { FileUpload } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COMPANY_SETTING_KEYS } from "@/lib/domain/settings-keys";
import { settingsKeys } from "@/lib/query-keys";
import { type CompanySettingsInput, companySettingsSchema } from "@/lib/validators/settings";
import { AccountTab } from "./components/account-tab";
import { BackupTab } from "./components/backup-tab";
import { PreferencesTab } from "./components/preferences-tab";
import { UserManagementTab } from "./components/user-management-tab";

const LOGO_KEY = COMPANY_SETTING_KEYS.LOGO_URL;

type SettingsTab = "company" | "users" | "preferences" | "account" | "backup";

type CompanyForm = CompanySettingsInput;

export default function SettingsPage(): React.JSX.Element {
  const settingsQuery = useQuery({
    queryKey: settingsKeys.company(),
    queryFn: async () => {
      const response = await getCompanySettings();
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [logoSaving, setLogoSaving] = React.useState(false);
  const [infoSaving, setInfoSaving] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("company");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CompanyForm>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      [COMPANY_SETTING_KEYS.NAME]: "",
      [COMPANY_SETTING_KEYS.ADDRESS]: "",
      [COMPANY_SETTING_KEYS.PHONE]: "",
      [COMPANY_SETTING_KEYS.EMAIL]: "",
      [COMPANY_SETTING_KEYS.TAX_ID]: "",
      [COMPANY_SETTING_KEYS.BANK_1_NAME]: "",
      [COMPANY_SETTING_KEYS.BANK_1_ACCOUNT_NUMBER]: "",
      [COMPANY_SETTING_KEYS.BANK_1_ACCOUNT_HOLDER]: "",
      [COMPANY_SETTING_KEYS.BANK_2_NAME]: "",
      [COMPANY_SETTING_KEYS.BANK_2_ACCOUNT_NUMBER]: "",
      [COMPANY_SETTING_KEYS.BANK_2_ACCOUNT_HOLDER]: "",
      [COMPANY_SETTING_KEYS.BANK_3_NAME]: "",
      [COMPANY_SETTING_KEYS.BANK_3_ACCOUNT_NUMBER]: "",
      [COMPANY_SETTING_KEYS.BANK_3_ACCOUNT_HOLDER]: "",
      [COMPANY_SETTING_KEYS.QUOTE_TERMS_AND_CONDITIONS]: "",
    },
  });

  React.useEffect(() => {
    if (!settingsQuery.data) return;
    reset({
      [COMPANY_SETTING_KEYS.NAME]: settingsQuery.data[COMPANY_SETTING_KEYS.NAME] ?? "",
      [COMPANY_SETTING_KEYS.ADDRESS]: settingsQuery.data[COMPANY_SETTING_KEYS.ADDRESS] ?? "",
      [COMPANY_SETTING_KEYS.PHONE]: settingsQuery.data[COMPANY_SETTING_KEYS.PHONE] ?? "",
      [COMPANY_SETTING_KEYS.EMAIL]: settingsQuery.data[COMPANY_SETTING_KEYS.EMAIL] ?? "",
      [COMPANY_SETTING_KEYS.TAX_ID]: settingsQuery.data[COMPANY_SETTING_KEYS.TAX_ID] ?? "",
      [COMPANY_SETTING_KEYS.BANK_1_NAME]:
        settingsQuery.data[COMPANY_SETTING_KEYS.BANK_1_NAME] ?? "",
      [COMPANY_SETTING_KEYS.BANK_1_ACCOUNT_NUMBER]:
        settingsQuery.data[COMPANY_SETTING_KEYS.BANK_1_ACCOUNT_NUMBER] ?? "",
      [COMPANY_SETTING_KEYS.BANK_1_ACCOUNT_HOLDER]:
        settingsQuery.data[COMPANY_SETTING_KEYS.BANK_1_ACCOUNT_HOLDER] ?? "",
      [COMPANY_SETTING_KEYS.BANK_2_NAME]:
        settingsQuery.data[COMPANY_SETTING_KEYS.BANK_2_NAME] ?? "",
      [COMPANY_SETTING_KEYS.BANK_2_ACCOUNT_NUMBER]:
        settingsQuery.data[COMPANY_SETTING_KEYS.BANK_2_ACCOUNT_NUMBER] ?? "",
      [COMPANY_SETTING_KEYS.BANK_2_ACCOUNT_HOLDER]:
        settingsQuery.data[COMPANY_SETTING_KEYS.BANK_2_ACCOUNT_HOLDER] ?? "",
      [COMPANY_SETTING_KEYS.BANK_3_NAME]:
        settingsQuery.data[COMPANY_SETTING_KEYS.BANK_3_NAME] ?? "",
      [COMPANY_SETTING_KEYS.BANK_3_ACCOUNT_NUMBER]:
        settingsQuery.data[COMPANY_SETTING_KEYS.BANK_3_ACCOUNT_NUMBER] ?? "",
      [COMPANY_SETTING_KEYS.BANK_3_ACCOUNT_HOLDER]:
        settingsQuery.data[COMPANY_SETTING_KEYS.BANK_3_ACCOUNT_HOLDER] ?? "",
      [COMPANY_SETTING_KEYS.QUOTE_TERMS_AND_CONDITIONS]:
        settingsQuery.data[COMPANY_SETTING_KEYS.QUOTE_TERMS_AND_CONDITIONS] ?? "",
    });
  }, [settingsQuery.data, reset]);

  async function persistLogo(url: string): Promise<void> {
    setLogoSaving(true);
    try {
      const res = await setCompanyLogoUrl({ url });
      if (res.success) {
        toast.success("Company logo synced");
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
      for (const [k, v] of Object.entries(values)) payload[k] = v ?? "";
      const res = await updateCompanySettings(payload);
      if (res.success) {
        toast.success("Company info saved successfully");
        void settingsQuery.refetch();
      } else {
        toast.error(res.error);
      }
    } finally {
      setInfoSaving(false);
    }
  }

  const logoUrl =
    typeof settingsQuery.data?.[LOGO_KEY] === "string" ? settingsQuery.data[LOGO_KEY] : "";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-24">
      <section className="border-border bg-card rounded-xl border px-6 py-5">
        <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">Configuration</p>
        <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight text-[#0F172A]">
          Settings
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          Configure brand identity, team access, and default behavior.
        </p>
      </section>

      <section className="border-border bg-card rounded-xl border p-2">
        <div className="flex flex-wrap gap-2">
          <SettingsTabButton
            label="Company Info"
            active={activeTab === "company"}
            onClick={() => {
              setActiveTab("company");
            }}
          />
          <SettingsTabButton
            label="User Management"
            active={activeTab === "users"}
            onClick={() => {
              setActiveTab("users");
            }}
          />
          <SettingsTabButton
            label="Preferences"
            active={activeTab === "preferences"}
            onClick={() => {
              setActiveTab("preferences");
            }}
          />
          <SettingsTabButton
            label="Account & Security"
            active={activeTab === "account"}
            onClick={() => {
              setActiveTab("account");
            }}
          />
          <SettingsTabButton
            label="Backup & Recovery"
            active={activeTab === "backup"}
            onClick={() => {
              setActiveTab("backup");
            }}
          />
        </div>
      </section>

      {activeTab === "company" ? (
        <section className="grid w-full grid-cols-1 gap-2 xl:grid-cols-2">
          <div className="border-border bg-card min-w-0 space-y-4 rounded-xl border p-6">
            <Label className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#0F172A]">
              Brand Logo
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
                JPG · PNG · Webp — 5 MB max per upload
              </p>
            )}
          </div>

          <div className="border-border bg-card min-w-0 space-y-6 rounded-xl border p-6">
            <Label className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#0F172A]">
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

              <BankAccountFields
                title="Bank Account 1"
                nameKey={COMPANY_SETTING_KEYS.BANK_1_NAME}
                accountNumberKey={COMPANY_SETTING_KEYS.BANK_1_ACCOUNT_NUMBER}
                accountHolderKey={COMPANY_SETTING_KEYS.BANK_1_ACCOUNT_HOLDER}
                register={register}
              />
              <BankAccountFields
                title="Bank Account 2"
                nameKey={COMPANY_SETTING_KEYS.BANK_2_NAME}
                accountNumberKey={COMPANY_SETTING_KEYS.BANK_2_ACCOUNT_NUMBER}
                accountHolderKey={COMPANY_SETTING_KEYS.BANK_2_ACCOUNT_HOLDER}
                register={register}
              />
              <BankAccountFields
                title="Bank Account 3"
                nameKey={COMPANY_SETTING_KEYS.BANK_3_NAME}
                accountNumberKey={COMPANY_SETTING_KEYS.BANK_3_ACCOUNT_NUMBER}
                accountHolderKey={COMPANY_SETTING_KEYS.BANK_3_ACCOUNT_HOLDER}
                register={register}
              />

              <div className="space-y-3 rounded-lg border border-dashed p-3">
                <p className="text-muted-foreground text-xs font-semibold">Documents & Terms</p>
                <div className="space-y-1">
                  <Label
                    htmlFor={COMPANY_SETTING_KEYS.QUOTE_TERMS_AND_CONDITIONS}
                    className="text-muted-foreground text-xs"
                  >
                    Default Quotation Terms & Conditions
                  </Label>
                  <Textarea
                    id={COMPANY_SETTING_KEYS.QUOTE_TERMS_AND_CONDITIONS}
                    {...register(COMPANY_SETTING_KEYS.QUOTE_TERMS_AND_CONDITIONS)}
                    className="min-h-[120px] border-border/70 bg-muted/45"
                    placeholder="Enter default terms..."
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={infoSaving || settingsQuery.isFetching}
                className="mt-2 w-full sm:w-auto"
              >
                {infoSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Company Info
              </Button>
            </form>
          </div>
        </section>
      ) : null}

      {activeTab === "users" ? <UserManagementTab /> : null}
      {activeTab === "preferences" ? <PreferencesTab /> : null}
      {activeTab === "account" ? <AccountTab /> : null}
      {activeTab === "backup" ? <BackupTab /> : null}
    </div>
  );
}

function SettingsTabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg border px-4 py-2 text-xs font-medium transition",
        active
          ? "border-[#D97706] bg-amber-50 text-[#0F172A]"
          : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function BankAccountFields({
  title,
  nameKey,
  accountNumberKey,
  accountHolderKey,
  register,
}: {
  title: string;
  nameKey: keyof CompanyForm;
  accountNumberKey: keyof CompanyForm;
  accountHolderKey: keyof CompanyForm;
  register: UseFormRegister<CompanyForm>;
}): React.JSX.Element {
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3">
      <p className="text-muted-foreground text-xs font-semibold">{title}</p>
      <div className="space-y-1">
        <Label htmlFor={String(nameKey)} className="text-muted-foreground text-xs">
          Bank Name
        </Label>
        <Input
          id={String(nameKey)}
          {...register(nameKey)}
          className="border-border/70 bg-muted/45"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={String(accountNumberKey)} className="text-muted-foreground text-xs">
          Bank Account Number
        </Label>
        <Input
          id={String(accountNumberKey)}
          {...register(accountNumberKey)}
          className="border-border/70 bg-muted/45"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={String(accountHolderKey)} className="text-muted-foreground text-xs">
          Bank Account Holder Name
        </Label>
        <Input
          id={String(accountHolderKey)}
          {...register(accountHolderKey)}
          className="border-border/70 bg-muted/45"
        />
      </div>
    </div>
  );
}
