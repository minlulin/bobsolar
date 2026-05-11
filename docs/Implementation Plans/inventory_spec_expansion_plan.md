# Inventory Spec Expansion + Data Loading Reliability Plan

## Objective

- Expand Inventory item technical details for stronger quotation accuracy.
- Fix cross-page/tab data visibility issue (data appears only after `F5`).

---

## Progress Checklist

## Phase A — Requirements Freeze

- [x] Capture category-specific inventory detail requirements.
- [x] Define non-functional requirements (strict validation, backward compatibility).
- [ ] Confirm final field formats with owner (text vs numeric+unit split).
- [ ] Confirm category mapping for “Protection Accessories” (`accessory` vs new enum).

## Phase B — Data Model Decision

- [x] Evaluate fixed columns vs JSON `specifications`.
- [x] Recommend JSON/JSONB `specifications` approach.
- [ ] Final approval on schema strategy.
- [ ] Confirm migration strategy for main/test DB branches.

## Phase C — Inventory Spec Implementation

- [ ] Add `specifications` field to `inventory_items` schema + migration.
- [ ] Add category-discriminated Zod schemas for create/update.
- [ ] Update Inventory actions to validate and persist specs.
- [ ] Keep read-path compatibility for legacy items without specs.

## Phase D — Inventory UI/UX

- [ ] Add category-driven dynamic spec fields in Inventory add/edit dialog.
- [ ] Add required field states + validation messages for each category.
- [ ] Add compact spec summary in inventory list/card.
- [ ] Add spec summary in quotation inventory search rows.

## Phase E — Quotation Behavior

- [ ] Keep duplicate-combine rule strictly by `itemId` (not by name).
- [ ] Ensure live preview always renders all selected items.
- [ ] Validate same-name/different-category items remain separate lines.

## Phase F — Data Loading Reliability (New Issue)

- [ ] Reproduce issue: data missing after tab/page switch, appears only after reload.
- [ ] Audit TanStack Query cache keys and `enabled` conditions on affected pages.
- [ ] Audit route transitions and client components for stale store/query hydration.
- [ ] Verify server actions and `revalidatePath` usage where mutations occur.
- [ ] Implement fix (likely query invalidation/refetch policy update).
- [ ] Add regression checks for navigation (no `F5` required).

## Phase G — Verification and Gate

- [ ] Run `pnpm green:code`.
- [ ] Run `pnpm test:db`.
- [ ] Run `pnpm green`.
- [ ] Manual UX smoke test on desktop + mobile viewport.

---

## Approved Requirement Details (Captured)

### Panel

- `brandModel` (text)
- `cellType` (`n_type` / `p_type`)
- `wattageW` (number)
- `warranty` (text)

### Inverter

- `brandModel` (text)
- `systemType` (`hybrid` / `off_grid` / `on_grid`)
- `ratedPower` (text or structured number+unit)
- `phase` (`single_phase` / `three_phase`)
- `maxPvInput` (text)
- `warranty` (text)

### Battery

- `brandModel` (text)
- `chemistryType` (`lifepo4` / `gel` / `lead_acid`)
- `voltageV` (number)
- `capacityAh` (number)
- `warranty` (text)

### Mounting Structure

- `type` (text)

### Cable

- `cableType` (`dc_cable` / `ac_cable` / `earth_wire`)
- `sizeCrossSection` (text)
- `unitOfMeasurement` (text)

### Protection Accessories

- `type` (text)
- `ratingAmpere` (number or text)
- `voltageRating` (text)

---

## Design Recommendation (Pending Approval)

- Use JSON/JSONB `specifications` field for category-specific data.
- Keep existing category enums for now (map “Protection Accessories” to current `accessory` unless explicitly expanded).
- Validate aggressively in app layer with category-discriminated Zod schemas.
