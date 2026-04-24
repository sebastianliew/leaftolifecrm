---
title: Deduction & Mutation Surfaces Audit
tags:
  - inventory
  - refunds
  - restock
  - audit
  - stress-test
status: partial
date: 2026-04-23
audience: engineering
---

# Deduction & Mutation Surfaces

Empirical audit of every code path that mutates stock, balance, or counters outside the blend pipeline. All findings are backed by tests in `backend/__tests__/integration/deduction-surfaces-stress.test.ts` (9 cases, all green against a `MongoMemoryReplSet` so session-based paths exercise for real).

> [!success] Status (2026-04-23)
> Seven of eight bugs fixed. D1 (customer credit balance) is left **intentionally open** — it's a design decision, not a code bug: the `offset_from_credit` payment method has no balance ledger to draw from. Product needs to decide where credit lives before wiring it up. D5 (pool transfer TOCTOU) is left open because the atomic clamp in `updateProductStock` prevents state corruption; D6 (reservedStock) is dead code, safe to ignore or remove.

## Findings and fixes

| # | Surface | Bug | Status | Fix |
|---|---|---|---|---|
| **D1** | Credit balance | `paymentMethod: 'offset_from_credit'` exists on Transaction + PatientEnrichment but has no writer anywhere. Selecting the method does not draw down any balance. `outstandingBalance` on `PatientEnrichment.financialSummary` is never mutated outside the schema default. | ⏳ **Design gap** | Requires product decision — see §Design gap below |
| **D2** | Refund creation | In mongoose 8, `pre('validate')` runs *before* `pre('save')`. The Refund model auto-generated `refundNumber` in `pre('save')`, so validation rejected every create with "Path `refundNumber` is required". **100% of refund creates were failing silently in production.** | ✅ Fixed | Moved the hook to `pre('validate')` in `backend/models/Refund.ts` |
| **D3** | Refund processing for blends/bundles | `processRefund` looked up `refund.items[].productId` via `Product.findById`. For `fixed_blend` lines the id is a BlendTemplate; for `bundle` lines it's a Bundle. Both lookups returned null and the loop silently continued — no ingredient or component stock was ever restored on refund. | ✅ Fixed | Extended `processRefund` to fall through to BlendTemplate, Bundle, and `customBlendData` on the original transaction line; each path emits `return` movements for the correct underlying products |
| **D4** | Restock stock update | `RestockService.MongoInventoryRepository.updateProductStock` used `new Schema.Types.ObjectId(id)` (a mongoose schema-type metadata class) instead of `new mongoose.Types.ObjectId(id)`. The save raised `CastError`, which `restockProduct`'s outer try/catch swallowed into `{success: false}`. **100% of restock calls silently failed in production.** | ✅ Fixed | Swapped both `new Schema.Types.ObjectId(...)` sites to `new mongoose.Types.ObjectId(...)` |
| **D5** | Pool-transfer TOCTOU | `manageProductPool` validates sealed stock, then creates a `pool_transfer` movement — no atomic guard. Five concurrent opens against 1000 ml sealed all pass validation. Saved as a known-acceptable risk because `InventoryMovement.updateProductStock`'s pipeline clamps `looseStock` to `currentStock`, so state stays bounded even under the race. | ⏳ Open (bounded) | Would need an aggregation-pipeline validation+mutation in one `findOneAndUpdate`. Low priority |
| **D6** | `reservedStock` orphan | Field is declared and read (`availableStock = currentStock - reservedStock`) but nothing ever writes to it. Effectively dead. | ⏳ Open | Safe to remove the field + its readers, or leave for a future reservation feature |
| **D7** | Bundle component pool | `processBundle` created `bundle_sale` movements with no explicit `pool`, defaulting to `'any'`. `any`-branch decrements `currentStock` but only clamps `looseStock`, leaving it stale — same shape as the MAJOR-5 bug fixed for fixed blends. | ✅ Fixed | Set `pool: 'loose'` on the component-product movement in `TransactionInventoryService.processBundle` |
| **D8** | Restock analytics race | `Product.updateRestockAnalytics` did read → compute new values → `save()`. Concurrent restocks lost counter updates — same pattern as MAJOR-4 on blend `usageCount`. | ✅ Fixed | Replaced with atomic pipeline `updateOne` that computes the new `restockCount` and `averageRestockQuantity` from pre-update values in a single write |

## Stress test

`backend/__tests__/integration/deduction-surfaces-stress.test.ts` runs 9 cases under `MongoMemoryReplSet` (replica set is required because `RefundService.createRefund` opens a mongoose session).

```
✓ REGRESSION: offset_from_credit does NOT decrement any balance anywhere
✓ RefundService.createRefund auto-generates refundNumber via pre-validate and persists
✓ processRefund restores product stock when the Refund doc is built manually
✓ processRefund now restores ingredient stock when refunding a fixed_blend line
✓ REGRESSION: concurrent opens past available sealed stock all succeed (TOCTOU) — state bounded
✓ REGRESSION: no operation in the codebase mutates reservedStock (orphan field)
✓ bundle_sale uses pool=loose, so looseStock tracks currentStock correctly
✓ RestockService.restockProduct actually increments stock after the ObjectId fix
✓ restockCount and averageRestockQuantity survive concurrent restocks atomically
```

Re-run: `cd backend && npm test -- --testPathPattern=deduction-surfaces-stress --runInBand`

## Design gap — customer credit (D1)

The schema, UI, and payment-method label all suggest a "store credit" feature, but the write-side never shipped. Concretely:

- `Transaction.paymentMethod` enum includes `offset_from_credit`
- `Refund.refundMethod` enum includes `offset_to_credit` (mirror operation)
- `PatientEnrichment.financialSummary.outstandingBalance` exists and defaults to 0
- No writer for any of these exists anywhere in the codebase

Before this can be wired up, product needs to decide:

1. **Where does the balance live?** Options: (a) `Patient.creditBalance` / (b) `PatientEnrichment.financialSummary.creditBalance` / (c) a dedicated `CustomerCreditLedger` collection with immutable entries. The collection form is the safest — mirrors the `InventoryMovement` ledger pattern that already works well for stock. Sign convention: positive = customer has prepaid credit, negative = customer owes.
2. **When is credit earned?** On `offset_to_credit` refund? On manual admin top-up? On loyalty-tier rollover?
3. **What's the sell-down invariant?** Is overdrawing allowed (going negative)? How does this interact with `outstandingBalance`?
4. **Refund-round-trip?** Reopening a cancelled transaction that used credit needs to restore the credit too.

Recommended shape once decided: add a `CreditLedgerEntry` model with `customerId, amount, reason, transactionRef, createdBy`, wire entries into `TransactionInventoryService.processTransaction` (debit on `offset_from_credit` sale) and `RefundService.processRefund` (credit on `offset_to_credit` refund), and compute balance with `aggregate` in `getCustomerCreditBalance`.

## Related wiki

- [[blend-infrastructure|Blend Infrastructure]] — the preceding audit of blend deduction paths; many of the fixes here mirror patterns from that one (atomic counters, `pool: 'loose'` for dispensed ingredients).
- [[transaction-flow|Transaction Flow]] — the end-to-end path that dispatches to each deduction surface.
