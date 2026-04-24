# CRM Issues 2026 — monitoring board

TL;DR: `CRMISSUES2026.docx` (client, 31/12/2025) logged 26 issues. As of
2026-04-24, 22 are closed in code, 1 has an ops follow-up with a helper
script, and 4 remain open awaiting a client repro. This article is the
canonical status board — if a client re-raises any of these, look here
first to see if the fix has already shipped.

Full audit log (what changed, where, why): [[crm-issues-2026-audit]] in
`raw/`.

## Buckets

### ✅ Closed (22)

Fixed in this pass, or already in place:

- **#1 100% margin bug** — cost captured at point of sale, 3-tier fallback,
  regression test (`backend/controllers/reports/salesTrendsController.ts`).
- **#2 Cost price on View Products** — admin-gated, table column present
  (`frontend/src/app/inventory/page.tsx`, `products.controller.ts`).
- **#4 Custom blend visibility + edit** — ingredients now render on the
  transaction detail page with 🧪 badge; "Edit transaction" button
  deep-links to the edit dialog via `?edit=<id>`. See
  [[transactions-page-tsx|/transactions/[id]/page.tsx]].
- **#6 Inventory-cost report supplier/brand + numerical qty** — shipped.
- **#7 Duplicate draft save prevention** — client lock + atomic upsert +
  partial unique index. See [[transaction-flow|Transaction Flow]].
- **#9 Main Inventory report Brand column** — added Brand + Supplier to
  both UI and backend aggregation.
- **#10 Flexible report filters** — supplier / brand / category dropdowns
  on the Inventory Cost report.
- **#11 Sell loose capsules** — already in place (`Product.canSellLoose`).
  See [[deduction-surfaces|Pool-based deduction]].
- **#13 Duplicate invoice** — unique constraint + atomic counter +
  generation lock.
- **#14 Invoice branding → Leaf to Life Pte Ltd** — unified across
  backend PDF, frontend HTML/PDF, email, transaction page.
- **#15 NRIC / DOB optional** — both relaxed on schema + form + types.
- **#16 Logo configurability** — lifted to `frontend/src/config/branding.ts`;
  override with `NEXT_PUBLIC_LOGO_PATH`.
- **#17 Domain → .com** — customer-facing URLs switched; CORS allowlist
  extended with `.com` variants.
- **#18 Loose/container setting** — already in place.
- **#19 Blend template admin-only** — permission-gated on all four verbs.
  See [[blend-infrastructure|Blend Infrastructure]].
- **#20 Category default UOM** — added `Category.defaultUom`,
  auto-populates on product form.
- **#21 Auto sell-loose for tablets/capsules/liquids** — added
  `Category.defaultCanSellLoose` + migration script
  `backend/scripts/enable-loose-sale-for-dosage-forms.ts`.
- **#22 Loose stock capture** — dual-pool tracking, atomic deduction.
- **#23 Missing customer invoices** — Patient detail page gets an
  **Invoices** tab filtered by `customerId`, with a "include cancelled /
  draft" toggle on by default.
- **#25 Can't save after draft** — draft finalisation is already
  session-wrapped with invoice-generation lock.
- **#26 No invoice loss** — soft-delete flag added; completed/refunded
  never hard-deleted; cancelled/pending archived via `isDeleted`; drafts
  still purge.

### ⏳ Ops follow-up (1)

- **#3 Bundles not transferred from old** — code works end-to-end; data
  migration needs verification. Run:
  ```
  cd backend && npx tsx scripts/verify-bundle-migration.ts
  ```
  If the script reports a gap, `mongorestore --nsInclude "l2l.bundles" …`.

### ❓ Needs client repro (4)

Open until we get a specific example from the client:

| # | Issue | What to ask |
|---|---|---|
| 5 | Loading is slow | Which page? How long (sec)? What time of day? |
| 8 | Cost shown ≠ what was keyed (Ann Kui Tee) | Which product? What value keyed vs displayed? |
| 12 | Items show as UNKNOWN | Specific invoice number(s)? |
| 24 | Can't update item after 1st draft save | Repro steps? Browser? Transaction id? |

## How this monitoring stays fresh

- When a client re-raises a listed issue, update this file's bucket or
  paste a new note into `raw/crm-issues-2026-audit.md`.
- When the 4 open items get reproductions, open a follow-up note in
  `raw/` and cross-link here.
- When shipping a fix that closes a row, move it from ❓ to ✅ and add the
  commit reference.

## Gotchas captured during the audit

- `Sebastian Liew Centre Pte Ltd` was the old legal entity; brand is now
  `Leaf to Life Pte Ltd` (same UEN 202527780C). Don't reintroduce the
  old name on customer-facing surfaces.
- CORS intentionally carries both `.com` and `.com.sg` allowlists during
  the transition — don't prune.
- `Transaction.isDeleted` is a soft-delete guard; `Transaction` queries
  should filter `isDeleted: { $ne: true }` by default. Admin list UIs
  can pass `?includeDeleted=true`.
- Category defaults (`defaultUom`, `defaultCanSellLoose`) only affect
  new-product forms; existing products are migrated separately via
  `enable-loose-sale-for-dosage-forms.ts` (dry-run-by-default).
