import { z } from "zod";
import { COMPANY_SETTING_KEYS } from "@/lib/domain/settings-keys";

export const companySettingsSchema = z.object({
  [COMPANY_SETTING_KEYS.NAME]: z.string().min(1, "Company name is required"),
  [COMPANY_SETTING_KEYS.ADDRESS]: z.string().optional(),
  [COMPANY_SETTING_KEYS.PHONE]: z.string().min(1, "Phone is required"),
  [COMPANY_SETTING_KEYS.EMAIL]: z.email(),
  [COMPANY_SETTING_KEYS.TAX_ID]: z.string().optional(),
  [COMPANY_SETTING_KEYS.BANK_1_NAME]: z.string().optional(),
  [COMPANY_SETTING_KEYS.BANK_1_ACCOUNT_NUMBER]: z.string().optional(),
  [COMPANY_SETTING_KEYS.BANK_1_ACCOUNT_HOLDER]: z.string().optional(),
  [COMPANY_SETTING_KEYS.BANK_2_NAME]: z.string().optional(),
  [COMPANY_SETTING_KEYS.BANK_2_ACCOUNT_NUMBER]: z.string().optional(),
  [COMPANY_SETTING_KEYS.BANK_2_ACCOUNT_HOLDER]: z.string().optional(),
  [COMPANY_SETTING_KEYS.BANK_3_NAME]: z.string().optional(),
  [COMPANY_SETTING_KEYS.BANK_3_ACCOUNT_NUMBER]: z.string().optional(),
  [COMPANY_SETTING_KEYS.BANK_3_ACCOUNT_HOLDER]: z.string().optional(),
  [COMPANY_SETTING_KEYS.QUOTE_TERMS_AND_CONDITIONS]: z.string().optional(),
});

export type CompanySettingsInput = z.input<typeof companySettingsSchema>;
