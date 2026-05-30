import { z } from "zod";

/**
 * Type-safe company setting keys
 * Centralized to prevent typos and provide autocomplete
 */

export const COMPANY_SETTING_KEYS = {
  // Logo
  LOGO_URL: "company_logo_url",

  // Company identity
  NAME: "company_name",
  ADDRESS: "company_address",
  PHONE: "company_phone",
  EMAIL: "company_email",
  TAX_ID: "company_tax_id",

  // Banking details - support up to 3 bank accounts
  // Keep slot 1 on legacy key names for backward compatibility with existing data.
  BANK_1_NAME: "company_bank_name",
  BANK_1_ACCOUNT_NUMBER: "company_bank_account_number",
  BANK_1_ACCOUNT_HOLDER: "company_bank_account_holder",
  BANK_2_NAME: "company_bank_2_name",
  BANK_2_ACCOUNT_NUMBER: "company_bank_2_account_number",
  BANK_2_ACCOUNT_HOLDER: "company_bank_2_account_holder",
  BANK_3_NAME: "company_bank_3_name",
  BANK_3_ACCOUNT_NUMBER: "company_bank_3_account_number",
  BANK_3_ACCOUNT_HOLDER: "company_bank_3_account_holder",

  // Quotation Defaults
  QUOTE_TERMS_AND_CONDITIONS: "quote_terms_and_conditions",
} as const;

/** Union type of all valid company setting keys */
export type CompanySettingKey = (typeof COMPANY_SETTING_KEYS)[keyof typeof COMPANY_SETTING_KEYS];

/** Array of all company setting key values */
export const COMPANY_SETTING_KEY_VALUES = Object.values(COMPANY_SETTING_KEYS);

/** Zod schema for validating company setting keys */
export const companySettingKeySchema = z.enum(COMPANY_SETTING_KEY_VALUES);

/** Type guard to check if a string is a valid company setting key */
export function isCompanySettingKey(key: string): key is CompanySettingKey {
  return (COMPANY_SETTING_KEY_VALUES as readonly string[]).includes(key);
}

/** Helper function to format bank details from individual fields */
export function formatBankDetails(settings: Record<string, string>): string {
  const lines = [
    {
      bankName: settings[COMPANY_SETTING_KEYS.BANK_1_NAME],
      accountNumber: settings[COMPANY_SETTING_KEYS.BANK_1_ACCOUNT_NUMBER],
      accountHolder: settings[COMPANY_SETTING_KEYS.BANK_1_ACCOUNT_HOLDER],
    },
    {
      bankName: settings[COMPANY_SETTING_KEYS.BANK_2_NAME],
      accountNumber: settings[COMPANY_SETTING_KEYS.BANK_2_ACCOUNT_NUMBER],
      accountHolder: settings[COMPANY_SETTING_KEYS.BANK_2_ACCOUNT_HOLDER],
    },
    {
      bankName: settings[COMPANY_SETTING_KEYS.BANK_3_NAME],
      accountNumber: settings[COMPANY_SETTING_KEYS.BANK_3_ACCOUNT_NUMBER],
      accountHolder: settings[COMPANY_SETTING_KEYS.BANK_3_ACCOUNT_HOLDER],
    },
  ]
    .filter((b) => b.bankName || b.accountNumber || b.accountHolder)
    .map(
      (b) =>
        `${b.bankName || "Bank"} | A/C: ${b.accountNumber || "-"} | Name: ${b.accountHolder || "-"}`,
    );

  return lines.join("\n");
}

/** Default values for company settings */
export const COMPANY_SETTING_DEFAULTS: Record<CompanySettingKey, string> = {
  [COMPANY_SETTING_KEYS.LOGO_URL]: "",
  [COMPANY_SETTING_KEYS.NAME]: "BOB Solar",
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
  [COMPANY_SETTING_KEYS.QUOTE_TERMS_AND_CONDITIONS]:
    "1. All prices are in MMK.\n2. 50% deposit required upon confirmation.\n3. Balance 50% due upon project completion.\n4. Quotation valid for 14 days.",
};

/** Get default value for a company setting key */
export function getCompanySettingDefault(key: CompanySettingKey): string {
  return COMPANY_SETTING_DEFAULTS[key];
}
