# Finance SSoT Drift Checklist

Purpose: after wiring the full finance module, this checklist is the baseline to detect project drift from the agreed SSoT.

## 1) Payment SSoT

- Allowed collection statuses only:
  - `advance`
  - `partial`
  - `fully_paid`
- Allowed payment methods only:
  - `cash`
  - `kbz_pay`
  - `wave_pay`
  - `aya_pay`
  - `bank_transfer`

## 2) Transaction Classification

- Income transaction types:
  - `income`
- Expense transaction types:
  - `expense`
- Ongoing project expense types:
  - `material`
  - `labor`
  - `transport`
  - `misc`
  - `general`

## 3) Ledger SSoT

- Account types only:
  - `asset`, `liability`, `equity`, `income`, `expense`
- Baseline account codes:
  - `cash_on_hand`
  - `kbz_wallet`
  - `wave_wallet`
  - `aya_wallet`
  - `bank_account`
  - `accounts_receivable`
  - `accounts_payable`
  - `owner_equity`
  - `solar_installation_revenue`
  - `other_income`
  - `material_expense`
  - `labor_expense`
  - `transport_expense`
  - `misc_expense`
  - `general_expense`

## 4) Double-Entry Invariants

- Every journal entry must satisfy:
  - `sum(debit) = sum(credit)`
- No journal line can set both debit and credit > 0.
- Journal lines must reference valid account codes from SSoT.

## 5) Source Type Governance

- Journal source types only:
  - `project_payment`
  - `project_expense`
  - `manual_adjustment`
  - `opening_balance`
  - `backfill`

## 6) Drift Triggers

Treat as drift when any of the following happens:

- A new payment method/status/type is introduced in UI/API/DB but not added to SSoT.
- Ledger account code exists in DB but not in SSoT.
- Journal entry can be inserted without balancing.
- Income/expense reports bypass journal and rely on ad-hoc aggregation only.

