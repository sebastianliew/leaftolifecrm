---
title: Blend Infrastructure
tags:
  - blends
  - inventory
  - pricing
  - audit
  - stress-test
status: fixed
date: 2026-04-23
audience: engineering
---

# Blend Infrastructure

Audit + stress test of the three blend code paths: **fixed blends** (reusable templates), **custom blends** (ad-hoc recipes attached to a single sale), and the shared validator/pricing core that underpins both.

> [!success] Status (2026-04-23)
> All three criticals plus MAJOR-4, MAJOR-5, MAJOR-6, MINOR-7, and MINOR-9 are fixed. MINOR-8 (UOM fallback) was left intact — it's load-bearing for legacy templates that reference deleted UOMs; changing it risks breaking enrichment at runtime. Stress test is now 10 cases, 10/10 passing; full suite 283/283. The findings below are kept as the audit record.

## 1. Architecture map

### Backend

| Concern | File | Role |
|---|---|---|
| Fixed-blend recipe | `backend/models/BlendTemplate.ts` | Mongoose model — recipe, batchSize, sellingPrice, virtuals for `totalCost`/`profit` |
| Custom-blend history | `backend/models/CustomBlendHistory.ts` | Mongoose model — per-sale recipe snapshot with signatureHash for de-dupe |
| Inventory movements | `backend/models/inventory/InventoryMovement.ts` | Append-only ledger; `updateProductStock()` uses atomic `updateOne` pipelines |
| Fixed-blend service | `backend/services/BlendTemplateService.ts` | CRUD + stats, 322 lines (god-class; flagged low-cohesion in graphify) |
| Custom-blend service | `backend/services/CustomBlendService.ts` | Cost calc, ingredient enrichment, **stock deduction (never called from controllers)** |
| Shared validator | `backend/services/blend/BlendIngredientValidator.ts` | Single source of truth for enrichment + availability checks |
| Transaction dispatcher | `backend/services/TransactionInventoryService.ts` | Strategy-pattern registry: `product → fixed_blend → bundle`. **Custom blend is explicitly skipped.** |
| Pricing utility | `backend/utils/pricingUtils.ts` | Branded `PerContainerPrice` / `PerUnitPrice` types; `perUnitCost(product) = costPrice / containerCapacity` |
| Routes | `backend/routes/blend-templates.routes.ts` | REST for fixed blends; custom blends have no standalone routes — they ride on `/api/transactions` |

### Frontend

| Surface | File |
|---|---|
| Template CRUD page | `frontend/src/app/blend-templates/page.tsx` |
| Template form | `frontend/src/components/blend-templates/TemplateForm.tsx` + form subfolder |
| Custom-blend creator | `frontend/src/components/transactions/CustomBlendCreator.tsx` |
| Quick custom blend | `frontend/src/components/blends/QuickBlendCreator.tsx` |
| Wizard flow | `frontend/src/components/blends/BlendWizard.tsx` |
| Fixed-blend selector (POS) | `frontend/src/components/transactions/FixedBlendSelector.tsx` |
| History selector (POS) | `frontend/src/components/transactions/BlendHistorySelector.tsx` |
| Analytics | `frontend/src/components/blends/BlendAnalyticsDashboard.tsx` |
| Cost helpers | `frontend/src/utils/blend-calculations.ts`, `frontend/src/lib/pricing.ts` |
| React-query hooks | `useBlendTemplates.ts`, `useBlendTemplatesOptimized.ts`, `useCustomBlendHistory.ts` |

### Transaction-time flow

```
POST /api/transactions
 ├─ create-transaction controller
 │   ├─ price verify products & fixed_blends (uses perUnitCost)
 │   ├─ price verify CUSTOM BLENDS ...............  ❌ uses sellingPrice, not costPrice
 │   ├─ stock validate (warn only; don't block)
 │   └─ open mongoose session
 │        ├─ transaction.save({ session })
 │        └─ TransactionInventoryService.processTransactionInventory
 │             ├─ idempotency guard: existing movements skip
 │             ├─ for each item:
 │             │    ├─ product  → processProduct        (pool: loose|sealed)
 │             │    ├─ fixed_blend → processFixedBlend  (pool: 'any' ⚠︎)
 │             │    ├─ bundle  → processBundle
 │             │    └─ custom_blend → continue ❌  (never dispatched)
 │             └─ commitTransaction
 └─ async invoice generation (fire-and-forget)
```

## 2. Findings

> [!check] CRITICAL-1 — FIXED: custom-blend ingredients are now deducted inside the transaction session
> **Where:** `TransactionInventoryService.ts:193-196` skips `custom_blend` with the comment *"Handled separately by CustomBlendService during transaction creation"*. No such handler exists in `transactions.controller.ts` or anywhere else.
> **Proof:** Exhaustive grep — `processCustomBlendSale`, `processBlendInventoryDeduction`, and `deductCustomBlendIngredients` are only called **from within `CustomBlendService` itself**. `TransactionInventoryService` even instantiates `private customBlendService = new CustomBlendService();` (line 154) but never reads it — dead field.
> **Impact:** Every custom-blend sale in production leaves ingredient stock untouched. Inventory drifts low over time; the discrepancy grows with usage.
> **Stress-test evidence:** `blend-stress.test.ts` → *"REGRESSION: custom_blend items in a transaction do NOT deduct ingredient stock"* passes, asserting 0 movements and unchanged stock.

> [!check] CRITICAL-2 — FIXED: controller now uses `perUnitCost(product)` for ingredient costing
> **Where:** `backend/controllers/transactions.controller.ts:582-585`
> ```ts
> const ingSellingPrice = (product as { sellingPrice?: number }).sellingPrice ?? 0;
> ing.costPerUnit = ingSellingPrice;
> totalIngredientCost += ing.quantity * ingSellingPrice;
> ```
> **What's wrong:** (a) uses `sellingPrice` where every other blend path uses `perUnitCost(product) = costPrice / containerCapacity`; (b) doesn't divide by `containerCapacity`, so for a $220 × 1000 ml bottle, 10 ml gets priced at $2,200 instead of $0.80.
> **Contradicts:** `BlendIngredientValidator.checkIngredientConsistency` explicitly flags this pattern as a bug; `pricingUtils.perUnitCost` docstring says *"Does NOT fall back to sellingPrice."*
> **Impact:** Transaction line `costPrice` (used by margin reports and customer value analytics) is wildly inflated for custom blends.

> [!check] CRITICAL-3 — FIXED: `TransactionInventoryService.processCustomBlend` writes a `CustomBlendHistory` per sale
> **Where:** Model defined in `backend/models/CustomBlendHistory.ts`; exhaustive grep for `CustomBlendHistory` finds zero `.create()`/`new CustomBlendHistory()`/`.save()` call sites outside the model file itself.
> **Impact:** Frontend `useCustomBlendHistory` and `BlendHistorySelector.tsx` query an always-empty collection. The "reorder previous blend" UX is effectively dead.

> [!warning] MAJOR-4 — `processFixedBlend` increments `usageCount` without atomic `$inc`
> **Where:** `TransactionInventoryService.ts:95-99`
> ```ts
> template.usageCount = (template.usageCount || 0) + item.quantity;
> await saveDoc(template, session);
> ```
> **Impact:** Under concurrent fixed-blend sales for the same template, reads race and lose updates. Should use `BlendTemplate.updateOne({ _id }, { $inc: { usageCount: n }, $set: { lastUsed } })`. Harmless for billing, but "popular templates" ranking understates reality.

> [!warning] MAJOR-5 — Fixed-blend ingredient deductions use `pool: 'any'`, not `'loose'`
> **Where:** `TransactionInventoryService.ts:58-66`
> **Why it's wrong:** In reality, blend ingredients are dispensed from open (loose) bottles. The `'any'` branch in `InventoryMovement.updateProductStock` decrements `currentStock` + `availableStock`, but only *clamps* `looseStock` to `min(looseStock, currentStock)`. So if a product has `looseStock=50` and a blend deducts 10 from `currentStock`, `looseStock` stays at 50 as long as 50 ≤ new `currentStock`.
> **Impact:** After many blend sales, the loose-vs-sealed split drifts. A downstream `saleType: 'volume'` validation then passes based on a stale looseStock that should have been drawn down.

> [!warning] MAJOR-6 — `deductCustomBlendIngredients` cleanup is not session-aware
> **Where:** `CustomBlendService.ts:186-194` — on partial failure, iterates and `InventoryMovement.findByIdAndDelete(movement._id)` *without* a session. Latent trap once CRITICAL-1 is fixed and this runs inside the outer transaction: the delete bypasses the transaction and may target a not-yet-committed `_id`.

> [!info] MINOR-7 — Dev-mode schema thrash in `BlendTemplate.ts`
> Lines 312-316 `delete mongoose.models.BlendTemplate` every time the module loads under `NODE_ENV=development`. Interacts badly with `tsx watch` and with in-memory Mongo across tests if the env leaks.

> [!info] MINOR-8 — `findSuitableUOM` fallback may pick an unrelated unit
> `BlendIngredientValidator.ts:324-358` — when the referenced UOM isn't found, it picks the first UOM matching `gram|milliliter|^ml$|^g$` or type=`weight|volume`. If the DB has only exotic UOMs (e.g. `drops`), it silently picks something wrong rather than failing loudly.

> [!info] MINOR-9 — No unique index on active `BlendTemplate.name`
> `backend/models/BlendTemplate.ts:149-160` — `{ name: 1 }` is indexed but not unique. Users can create two active templates with the same name (distinguished only by `_id`), confusing the POS dropdown.

## 3. Stress test

### File

`backend/__tests__/integration/blend-stress.test.ts` — 6 tests, ~5.3 s end-to-end against `mongodb-memory-server`.

### What it covers

| Scenario | Assertion |
|---|---|
| 30 concurrent fixed-blend sales, 3 shared ingredients | Σ movements == Σ stock delta per product; `currentStock ≥ 0` |
| Replay same transactionNumber | Second call short-circuits; no double-deduction |
| `custom_blend` item via standard pipeline | **0 movements, stock unchanged** (guards CRITICAL-1 regression) |
| `CustomBlendService.deductCustomBlendIngredients` called directly | Movements created, stock decrements correctly — proves service works, wiring is missing |
| 20-ingredient cost calc with mixed container capacities | Total matches Σ `(qty × costPrice / containerCapacity)`, finite, positive |
| 5-ingredient availability check with 2 scarce products | `valid: false`, 2 errors, 0 warnings |

### Results

```
PASS __tests__/integration/blend-stress.test.ts (5.303 s)
  ✓ deducts ingredients correctly across 30 concurrent fixed-blend sales (1116 ms)
  ✓ is idempotent: replaying the same transaction does not double-deduct (94 ms)
  ✓ REGRESSION: custom_blend items do NOT deduct ingredient stock via TransactionInventoryService (26 ms)
  ✓ CustomBlendService.deductCustomBlendIngredients does work when called directly (38 ms)
  ✓ calculateBlendCost sums per-unit costs correctly for a 20-ingredient blend (114 ms)
  ✓ validateIngredientAvailability flags insufficient stock correctly across many ingredients (33 ms)

Tests: 6 passed, 6 total
```

### How to re-run

```bash
cd backend
npm test -- --testPathPattern=blend-stress --runInBand
```

## 4. Remediation status

| Issue | Status | Where |
|---|---|---|
| CRITICAL-1 wiring | ✅ Fixed | `TransactionInventoryService.ts` — new `processCustomBlend` private method dispatches inside the outer session |
| CRITICAL-2 pricing | ✅ Fixed | `transactions.controller.ts:579-594` — now uses `perUnitCost(product)` with rounding to cents |
| CRITICAL-3 history | ✅ Fixed | `TransactionInventoryService.processCustomBlend` saves `CustomBlendHistory` with the same session (per-sale snapshot; dedup can be a reporting-layer concern) |
| MAJOR-4 atomic `usageCount` | ✅ Fixed | `processFixedBlend` now uses `BlendTemplate.updateOne(..., { $inc: { usageCount }, $set: { lastUsed } })` — guarded by stress test at N=30 concurrent sales |
| MAJOR-5 pool semantics on fixed blends | ✅ Fixed | `deductBlendIngredients` sets `pool: 'loose'` so looseStock decrements alongside currentStock — guarded by stress test |
| MAJOR-6 session-aware cleanup | ✅ Fixed | `CustomBlendService.deductCustomBlendIngredients` skips manual cleanup when running in a session (lets the outer transaction abort handle it) |
| MINOR-7 dev-mode schema thrash | ✅ Fixed | Removed the `delete mongoose.models.BlendTemplate` block from `BlendTemplate.ts` |
| MINOR-8 UOM fallback may pick wrong unit | ⏳ Open (intentional) | `BlendIngredientValidator.findSuitableUOM` — left as-is to avoid breaking legacy templates that point at removed UOMs |
| MINOR-9 non-unique active template name | ✅ Fixed | Added partial unique index `{ name: 1 }` filtered on `{ isActive: true, isDeleted: false }` — note: partial-filter syntax forbids `$ne`, so legacy rows with `isDeleted` unset fall outside the index |

## 5. Invariants to preserve

Any future change to this area must keep these true (the stress test guards most of them):

1. **Conservation**: Σ `convertedQuantity` over all `fixed_blend` + `custom_blend` movements for a product == initial stock − current stock (absent other movement types).
2. **Idempotency**: second call to `processTransactionInventory` for the same `transactionNumber` creates 0 new movements.
3. **Pricing monotonicity**: for a product with `costPrice > 0`, `perUnitCost(product) > 0` and never equals `sellingPrice / containerCapacity`.
4. **Validator contract**: `validateIngredientAvailability` returns `valid: false` whenever any ingredient has `availableQuantity < requiredQuantity × batchQuantity`.
5. **Signature determinism**: `CustomBlendHistory.calculateSignature` is stable under ingredient reorderings (already true — sorted join).

## 6. Related

- Wiki: [[transaction-flow]] — how transactions dispatch to inventory.
- Wiki: [[controller-conventions]] — response-shape rules this controller doesn't fully follow.
- Graphify community: `BlendTemplateService.ts` (42 nodes, cohesion 0.07 — flagged for split) — see `graphify-out/obsidian/_COMMUNITY_BlendTemplateService_ts.md`.
- Existing tests: `backend/__tests__/unit/services/blendCost.test.ts` — pins the per-unit cost invariant.
