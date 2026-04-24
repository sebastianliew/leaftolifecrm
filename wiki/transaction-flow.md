# Transaction Flow

**TL;DR** — A transaction is the core commercial event (a patient pays for products/services). It starts in a React form, routes through an Express controller, fans out to pricing + inventory services in parallel, persists to MongoDB, and optionally triggers an emailed PDF invoice. The non-obvious part: inventory deduction and pricing are *not* the same pipeline.

## The path, in order

1. **UI form** — [[SimpleProductSelector]] / transaction page collects items, discounts, patient, payment method. State lives in [[useTransactionForm]] and draft storage ([[DraftStorage]]) so half-filled POS sessions survive refresh.
2. **Preview call** — before submit, the UI calls `POST /api/transactions/calculate` → [[calculateTransactionPreview]]. This is pure pricing — no DB writes, no inventory lock. Uses [[TransactionCalculationService]] and [[DiscountValidationService]].
3. **Submit** — `POST /api/transactions` → [[createTransaction]] controller. This is where the real work happens.
4. **Pricing branch** — [[TransactionCalculationService]] normalizes every line (bundle, blend, plain product) into a consistent price structure. Runs on the submitted items.
5. **Inventory branch** — [[TransactionInventoryService]] handles the item-by-item deduction. Separate code path. Three item types are handled differently:
   - plain product → `.processProduct()`
   - bundle → `.processBundle()` (recursively deducts bundle components)
   - fixed blend → `.processFixedBlend()` (deducts ingredient quantities per [[BlendTemplate.ts]])
   - custom blend → `.deductBlendIngredients()` with per-ingredient [[UnitConversionService]] conversion
6. **Persist** — [[Transaction.ts]] document is written. Each inventory change also creates an [[InventoryMovement]] audit row.
7. **Invoice (optional, async)** — [[generateInvoiceAsync]] fires [[InvoiceGenerator]] to produce a PDF under `backend/invoices/` and optionally [[sendInvoiceEmail]] via [[EmailService]].

## The split that matters

`TransactionCalculationService` and `TransactionInventoryService` are separate. They look like they should be one class, but:

- Pricing must work **without** inventory (for previews, drafts, quotes).
- Inventory deduction must run **inside a transaction** with rollback semantics. Pricing never does.

Mixing them would force preview calls to lock rows they don't need. Keep them separate.

## Drafts

Unsubmitted transactions persist to [[DraftStorage]] — an in-memory map keyed by user. They expire (`cleanupExpiredDrafts()`). They do **not** reserve inventory. This means two staff saving the same patient at the same time can both draft the last unit in stock; only the first to submit gets it.

## Refunds are a separate flow

A [[Refund]] is not an undo on a transaction — it's a new document that references the original. [[RefundService]] re-creates compensating inventory movements; it does not mutate the original [[Transaction.ts]]. See the [[Refund Workflow|refund-workflow.md]] article (TODO: write).

## Gotchas / open questions

- **Stale drafts + stock races** — no reservation during draft lifetime (see above). If this becomes a support issue, the fix probably lives in [[DraftStorage]] and [[TransactionInventoryService.processProduct]].
- **PDF path resolution** — there was a recent fix to resolve the PayNow QR from cwd (commit `63a2272`) so production builds could find it. If invoice generation ever breaks in prod, check the asset path resolution first.
- **Two JWT modules** — [[backend/auth/jwt.ts]] and [[backend/lib/auth/jwt.ts]] both exist, and one calls into the other (`isTokenExpired → decodeToken`). This is a refactor leftover, not intentional. Don't add new code in both places.

## Where to start reading

- The 50-line version: [[transactions.controller.ts]] — controller wires the whole flow.
- The business rules: [[TransactionCalculationService]].
- The stock consequences: [[TransactionInventoryService]].
