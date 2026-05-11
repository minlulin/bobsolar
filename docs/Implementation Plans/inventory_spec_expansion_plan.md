# Inventory Add Item Spec Expansion Plan

## Objective

Improve Inventory Add/Edit item details so quotation item selection and preview can later distinguish same-name items with different technical specs.

This plan focuses only on Inventory item specification capture. Quotation preview behavior and cross-page data loading reliability will be handled separately.

## Decisions

- Use a JSON/JSONB `specifications` field for category-specific inventory details.
- Keep existing inventory categories.
- Map Protection Accessories to the existing `accessory` category.
- Use structured fields by default:
  - numbers for clear numeric values
  - enums for known option sets
  - text for free-form technical labels

## Category Specifications

### Panel

- `brandModel` text
- `cellType` enum: `n_type`, `p_type`
- `wattageW` number
- `warranty` text

### Inverter

- `brandModel` text
- `systemType` enum: `hybrid`, `off_grid`, `on_grid`
- `ratedPower` text
- `phase` enum: `single_phase`, `three_phase`
- `maxPvInput` text
- `warranty` text

### Battery

- `brandModel` text
- `chemistryType` enum: `lifepo4`, `gel`, `lead_acid`
- `voltageV` number
- `capacityAh` number
- `warranty` text

### Mounting Structure

- `type` text

### Cable

- `cableType` enum: `dc_cable`, `ac_cable`, `earth_wire`
- `sizeCrossSection` text
- `unitOfMeasurement` text

### Protection Accessories

Uses existing category: `accessory`.

- `type` text
- `ratingAmpere` number
- `voltageRating` text

## Implementation Checklist

### Phase A - Data Model

- [ ] Add `specifications` field to `inventory_items`.
- [ ] Store category-specific specs as JSON/JSONB.
- [ ] Keep existing rows valid when `specifications` is missing or null.
- [ ] Add migration for main/test databases.

### Phase B - Validation

- [ ] Add category-discriminated Zod schemas for inventory specifications.
- [ ] Validate create inventory input using selected category.
- [ ] Validate update inventory input using selected category.
- [ ] Reject stale or incompatible spec fields after category changes.
- [ ] Avoid `any`; use `unknown`, typed schemas, and inferred types.

### Phase C - Server Actions

- [ ] Update inventory create action to persist specifications.
- [ ] Update inventory edit action to persist specifications.
- [ ] Keep read paths compatible with legacy items.
- [ ] Return specifications in inventory list/detail responses.

### Phase D - Inventory UI

- [ ] Add dynamic spec fields in Inventory Add/Edit dialog.
- [ ] Show spec fields only after category selection.
- [ ] Reset incompatible spec fields when category changes.
- [ ] Show inline validation for required spec fields.
- [ ] Add compact spec summary to inventory cards/list rows.

Example summaries:

- Panel: `450W - N-Type - Brand Model`
- Battery: `51.2V - 100Ah - LiFePO4`
- Accessory: `Breaker - 63A - 500V`

## Out Of Scope

- Quotation live-preview duplicate rendering fix.
- Same-name/different-category quotation line behavior.
- Cross-page or tab data visibility issue where data appears only after `F5`.

These should be handled as separate follow-up plans after Inventory specs are stable.

## Test Plan

- [ ] Add validation tests for each category specification shape.
- [ ] Add create inventory tests with valid specs.
- [ ] Add create inventory tests with invalid/missing specs.
- [ ] Add update inventory tests for category changes.
- [ ] Add regression test for legacy inventory rows without specs.
- [ ] Manual smoke test Inventory Add/Edit on desktop and mobile.
- [ ] Run `pnpm green:code`.
- [ ] Run `pnpm test:db`.
- [ ] Run `pnpm green`.

## Acceptance Criteria

- Inventory Add Item captures meaningful technical details per category.
- Inventory Edit Item can view and update those details.
- Existing inventory data continues to work.
- Inventory list/card displays enough detail to distinguish similar items.
- The implementation remains strict TypeScript compliant with no `any`.
