---
source: CRMISSUES2026.docx (client feedback, 31/12/2025)
audited: 2026-04-24
implemented: 2026-04-24
---

# CRM Issues 2026 — audit & fix log

Client feedback delivered in `/Users/macbookm2pro16inch/Downloads/CRMISSUES2026.docx`. This
file captures the audit findings, what changed in code, and what still needs a
repro from the client. Annotated companion doc:
`/Users/macbookm2pro16inch/Downloads/CRMISSUES2026_STATUS.docx`.

## Monitoring snapshot

| Bucket | Count | Issues |
|---|---|---|
| ✅ Fixed in this pass | 13 | #4, #9, #10, #14, #15, #16, #17, #20, #21, #23, #26 (plus #3 ops helper, #25 verified) |
| ✅ Already in place | 9 | #1, #2, #6, #7, #11, #13, #18, #19, #22 |
| ⏳ Ops follow-up (no more code) | 1 | #3 (run verify-bundle-migration.ts, mongorestore if gap) |
| ❓ Needs client repro | 4 | #5, #8, #12, #24 |

## What we changed (by area)

### Invoice / branding
- Unified "Leaf to Life Pte Ltd" across every invoice surface: backend PDF
  (`backend/services/invoiceGenerator.ts`), frontend HTML
  (`frontend/src/utils/invoice-html-template.ts`), frontend PDF
  (`frontend/src/utils/invoice-generator.ts`), email template
  (`frontend/src/utils/invoice-email-templates.ts`).
- Website URL flipped to `www.leaftolife.com` on all customer-facing docs.
  Emails (`customerservice@leaftolife.com.sg`) stay on `.com.sg` — that's the
  active mailbox.
- CORS allowlist extended in `backend/server.ts` with `leaftolife.com`,
  `www.leaftolife.com`, `crm.leaftolife.com` while keeping the `.sg` entries.
- `frontend/src/config/branding.ts` (new) — single source of truth for logo
  path, company name, website, email, UEN. All overridable by
  `NEXT_PUBLIC_LOGO_PATH` etc. so the client can swap a logo via env var.

### Patient
- `Patient.dateOfBirth` relaxed to optional on backend schema, frontend Zod
  schema, and the patient form. `PatientTableRow` and the `Patient` type
  accept missing DOB gracefully (renders as `—`).
- `Patient` detail page gets a new **Invoices** tab (`PatientInvoicesTab`)
  that hits `GET /transactions?customerId=<id>&includeCancelled=true` so
  Mary Kang-style "missing invoices" are now visible in one place, with
  a toggle to include cancelled/draft/soft-deleted records.

### Transactions
- `getTransactions` (backend) now supports `?customerId` and defaults to
  excluding soft-deleted records. `?includeDeleted=true` retrieves archives.
- Soft-delete on `Transaction`: `isDeleted`, `deletedAt`, `deletedBy`,
  `deleteReason`. Completed/refunded transactions still can't be deleted at
  all (must cancel first). Cancelled/pending are soft-deleted. Drafts are
  still truly purged.
- Transaction detail page (`frontend/src/app/transactions/[id]/page.tsx`)
  renders custom blend **ingredients** + bundle **contents** inline with
  badges, and exposes an **Edit transaction (modify blends)** button that
  deep-links to `/transactions?edit=<id>`.
- `TransactionList` now opens the edit dialog automatically when the URL
  has `?edit=<id>`.

### Inventory / reports
- Main Inventory report (`frontend/src/app/reports/inventory/page.tsx`) now
  shows **Brand** and **Supplier** columns; backend aggregation populates
  them from `Product.brandName` / `supplierName`.
- Inventory Cost report got three new dropdown filters: supplier, brand,
  category — options derived from the returned data.

### Category model + product defaults
- `Category.defaultUom` (ref to UnitOfMeasurement) and
  `Category.defaultCanSellLoose` added to the schema, exposed through
  `categories.controller.ts` create/update endpoints.
- Product form auto-populates UOM from the chosen category and pre-checks
  "sell loose" when the category is flagged. User can override.
- `backend/scripts/enable-loose-sale-for-dosage-forms.ts` — idempotent,
  dry-run-by-default migration that sets `canSellLoose=true` on existing
  products whose category matches `/tablet|capsule|caplet|softgel|liquid|
  syrup|drops|solution|tincture|oil/` and flips
  `defaultCanSellLoose=true` on those categories. Run with `--commit`.

### Bundle migration
- `backend/scripts/verify-bundle-migration.ts` — read-only helper that
  compares `Bundle.countDocuments()` against the legacy bson dump
  (`migrations/inventory-sync/dump/l2l/bundles.bson`) and prints the exact
  `mongorestore --nsInclude "l2l.bundles"` command if there's a gap.

## Open items — need client input

Ask the client for:

- **#5 slow loading** — which specific page; how long it feels vs. "old";
  roughly when of day.
- **#8 cost mismatch (Ann Kui Tee)** — specific product name/SKU, what they
  keyed in, what's displayed.
- **#12 UNKNOWN items in invoices** — a specific invoice number where the
  item shows as UNKNOWN. Likely orphaned `productId` on historical data.
- **#24 intermittent update-after-draft** — steps to reproduce (create
  draft → … → modify item). Time-of-day, which browser.

## How to verify the fixes

End-to-end smoke test:

1. Open a patient → verify **Invoices** tab lists transactions; toggle
   "Include cancelled/draft" off/on.
2. Open any transaction with a custom blend → ingredients render with 🧪
   badge → click "Edit transaction (modify blends)" → edit dialog opens.
3. Open a transaction and try to delete a completed one → 409. Cancel
   first, then delete → soft-deleted (re-fetch without
   `?includeDeleted=true` → gone from list).
4. Create a new patient leaving DOB blank → saves OK.
5. Open Inventory Cost report → filter by supplier, brand, category →
   data narrows.
6. Open Main Inventory report → confirm Brand + Supplier columns render.
7. Create a new product under a "Tablets" category after running
   `enable-loose-sale-for-dosage-forms.ts --commit` → "sell loose" is
   pre-checked.
8. Generate an invoice → verify "Leaf to Life Pte Ltd" appears instead of
   "Sebastian Liew Centre Pte Ltd." on header and footer.

## Pointers to graph

When working on these areas, consult:
- [[transaction-flow|Transaction Flow]]
- [[deduction-surfaces|Deduction & Mutation Surfaces]]
- [[blend-infrastructure|Blend Infrastructure]]
