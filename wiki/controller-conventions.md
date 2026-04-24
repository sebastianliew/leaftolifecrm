# Controller Conventions & Common Gotchas

**TL;DR** — Three subtle failure modes bit multiple controllers in this codebase: (1) delete-guards querying the wrong field name and silently passing, (2) service-layer errors with `statusCode` attached returning 500 because the error handler only read `status`, and (3) `sparse` unique indexes still rejecting multiple explicit nulls. All three were fixed 2026-04-17 — this page explains the patterns so they don't recur.

## 1. Delete-guard field-name drift

A controller's delete endpoint should block deletion when other documents reference the target. The guard is typically:

```ts
const refs = await RefModel.countDocuments({ fooId: id, isDeleted: { $ne: true } });
if (refs > 0) throw new ValidationError(`Cannot delete. ${refs} items reference this.`);
```

**Trap:** if you write `{ foo: id }` instead of `{ fooId: id }`, the query matches zero docs and the guard silently passes. Every delete succeeds, references dangle.

**Seen in:** `suppliers.controller.ts` queried `{ supplier: id }` but `Product.supplierId` is the real field (`models/Product.ts:133`). The supplier guard was dead code from day one.

**Rule:** when wiring a new delete guard, grep the referencing schema for the actual field name — don't infer it from the controller's local vocabulary.

**Related:** categories + suppliers + patients controllers now all filter `isDeleted: { $ne: true }` so soft-deleted references don't block.

## 2. Service errors with `statusCode` silently return 500

Two error-throwing conventions exist in this codebase:

| Shape | Where | Handled by `errorHandler.middleware.ts` |
|---|---|---|
| `throw new AppError(404, 'msg')` or subclasses (`ValidationError`, `NotFoundError`, `ConflictError`) | Inventory / category / supplier controllers | ✅ First branch — maps `err.statusCode` |
| `throw Object.assign(new Error('msg'), { statusCode: 404 })` | `PatientService` and other service-layer modules | ❌ Fell through to 500 until 2026-04-17 |

**Why it fell through:** the handler's fallback read `err.status` (express convention) but the service layer uses `err.statusCode`. The old fallback:

```ts
res.status((err as { status?: number }).status || 500).json({ ... });
```

**Fix** (see `middlewares/errorHandler.middleware.ts:117-124`): read both and emit the intended code if it's 400–599. This repaired 18 silently-broken patient tests in a single commit.

**Rule:** when you add a new service module, prefer the `AppError` subclasses (they're typed and explicit). If you must use the ad-hoc pattern, know that both `status` and `statusCode` now work.

## 3. Sparse unique indexes still reject multiple nulls

```ts
schema.index({ nric: 1 }, { unique: true, sparse: true });   // ❌ wrong for null normalisation
schema.index({ nric: 1 }, {
  unique: true,
  partialFilterExpression: { nric: { $type: 'string' } }     // ✅ excludes null AND missing
});
```

**The trap:** MongoDB's `sparse: true` excludes documents where the field is **missing** from the index. But if your code normalises empty strings to explicit `null` (common for "blank NRIC → null" patterns), those null values **are** indexed and the second insert collides.

**Seen in:** `PatientService.sanitizePatientInput` sets `nric: null` when blank. The old sparse index rejected the second null patient. Fixed in `models/Patient.ts:171-174`.

**Rule:** anywhere you see `blankToNull` + a unique index, the index must use `partialFilterExpression` with `$type: 'string'` (or `$exists: true, $ne: null`), not `sparse: true`.

## Shared helpers to prefer

| Need | Use |
|---|---|
| ObjectId validation + 400 on fail | `requireObjectId(id, label)` from `lib/validations/sanitize.ts` |
| Case-insensitive unique-name check that throws 409 | `validateUnique(Model, field, value, excludeId, label)` from `lib/validations/referenceValidator.ts` |
| Blank string → null | `blankToNull(value)` |
| Regex-safe user search | `safeSearchRegex(term)` |
| Pagination cap | `clampLimit(raw, max=100)` |
| Mass-assignment whitelist | `pickFields(data, allowedSet)` |
| Dot-notation for partial nested `$set` | `toDotNotation(data, nestedKeys)` |

## Error-status-code cheat sheet

| Situation | Throw | HTTP |
|---|---|---|
| Missing required input | `ValidationError('name is required')` | 400 |
| Resource not found | `NotFoundError('Supplier', id)` | 404 |
| Duplicate unique field | `ConflictError('Supplier with this name already exists')` | 409 |
| Cross-model reference conflict (e.g. bundle uses this product) | `ReferenceConflictError(msg, details)` | 409 |
| Permission denied | `ForbiddenError()` | 403 |
| Any other ad-hoc status | `Object.assign(new Error(msg), { statusCode: N })` | N (fallback now reads this) |

## When you touch a CRUD controller

Follow the patterns established in [[categories.controller.ts]] and [[suppliers.controller.ts]] (both landed 2026-04-17):

1. **Sanitize** user strings with `sanitize()` (HTML strip + trim).
2. **Whitelist** fields to block mass-assignment (`pickAllowed()` / `pickFields()`).
3. **Check existence before duplicate checks** on PUT — otherwise a 404 gets surfaced as 409 (see the categories fix).
4. **Sync derived booleans** (e.g. `isActive` from `status`) in one helper, applied in both create and update.
5. **Delete guard**: enumerate all referencing collections (Products, Bundles, BlendTemplates, child categories, child rows) and list the blockers in one message.
6. **Unique-name backstop**: add a case-insensitive unique index via collation `{ locale: 'en', strength: 2 }` so controller-level dedup races are caught by Mongo.
