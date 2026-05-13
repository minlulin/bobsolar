import { z } from 'zod';

/**
 * Type-safe company setting keys
 * Centralized to prevent typos and provide autocomplete
 */

export const COMPANY_SETTING_KEYS = {
  // Logo
  LOGO_URL: 'company_logo_url',

  // Company identity
  NAME: 'company_name',
  ADDRESS: 'company_address',
  PHONE: 'company_phone',
  EMAIL: 'company_email',
  TAX_ID: 'company_tax_id',

  // Banking details - stored as individual fields for structured data
  BANK_NAME: 'company_bank_name',
  BANK_ACCOUNT_NUMBER: 'company_bank_account_number',
  BANK_ACCOUNT_HOLDER: 'company_bank_account_holder',
} as const;

/** Union type of all valid company setting keys */
export type CompanySettingKey =
  (typeof COMPANY_SETTING_KEYS)[keyof typeof COMPANY_SETTING_KEYS];

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
  const bankName = settings[COMPANY_SETTING_KEYS.BANK_NAME];
  const accountNumber = settings[COMPANY_SETTING_KEYS.BANK_ACCOUNT_NUMBER];
  const accountHolder = settings[COMPANY_SETTING_KEYS.BANK_ACCOUNT_HOLDER];

  if (!bankName && !accountNumber && !accountHolder) {
    return '';
  }

  return `${bankName || 'Bank'} | A/C: ${accountNumber || '-'} | Name: ${accountHolder || '-'}`;
}

/** Default values for company settings */
export const COMPANY_SETTING_DEFAULTS: Record<CompanySettingKey, string> = {
  [COMPANY_SETTING_KEYS.LOGO_URL]: '',
  [COMPANY_SETTING_KEYS.NAME]: 'BOB Solar',
  [COMPANY_SETTING_KEYS.ADDRESS]: '',
  [COMPANY_SETTING_KEYS.PHONE]: '',
  [COMPANY_SETTING_KEYS.EMAIL]: '',
  [COMPANY_SETTING_KEYS.TAX_ID]: '',
  [COMPANY_SETTING_KEYS.BANK_NAME]: '',
  [COMPANY_SETTING_KEYS.BANK_ACCOUNT_NUMBER]: '',
  [COMPANY_SETTING_KEYS.BANK_ACCOUNT_HOLDER]: '',
};

/** Get default value for a company setting key */
export function getCompanySettingDefault(key: CompanySettingKey): string {
  return COMPANY_SETTING_DEFAULTS[key];
}
