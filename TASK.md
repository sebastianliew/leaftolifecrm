# L2L-CRM-NEW — Full Audit Fix Task

Fix ALL items below. Build must pass after all changes (`cd frontend && pnpm build`).

## Part A: Frontend Bugs (fix these first)

### A1. Duplicate useEffect in CustomBlendCreator.tsx
- Lines ~78 and ~215 both have `useEffect(() => {...}, [open, editingBlend, products])` doing the SAME thing
- DELETE the second one (lines ~215-255). Keep only the first one (which has the hasInitializedRef logic).

### A2. Debug console.logs in CustomBlendCreator.tsx
- Remove ALL `console.log('🔍 ...')` debug statements (lines 90-92, 143, 152-154)
- Keep `console.error` for actual errors

### A3. `mixedBy` hardcoded to `'current_user'`
- In `CustomBlendCreator.tsx`, `mixedBy` is hardcoded to `'current_user'`
- The component already has `const { user } = usePermissions();`
- Change to use `user?.name || user?.email || 'unknown'`

### A4. Hardcoded fallback port 5001 in 22+ files
- Search all `.ts` and `.tsx` files in `frontend/src/` for `localhost:5001`
- Change ALL fallbacks from `5001` to `5002`
- These are in: hooks/, app/api/, providers/, components/, lib/

### A5. QuickBlendCreator.tsx — duplicated containerType logic
- The `containerType` → unit determination logic is copy-pasted 5 times
- Extract into a single helper function at the top of the file:
  ```ts
  function getContentUnit(containerType?: string | { name?: string } | null): string {
    const ct = (typeof containerType === 'string' ? containerType : containerType?.name || '').toLowerCase();
    if (ct.includes('jar')) return 'g';
    return 'ml'; // default for bottles, tubes, and everything else
  }
  ```
- Replace all 5 duplicated blocks with calls to this helper

### A6. Remove frontend transaction number fallback
- In `src/utils/batchNumber.ts`, the `generateTransactionNumber()` function uses `Math.random()`
- This should never be used. Add a deprecation comment and throw an error instead:
  ```ts
  export function generateTransactionNumber(): string {
    throw new Error('Transaction numbers must be generated server-side. Do not use this function.');
  }
  ```
- Check if anything imports/calls it. If so, remove those calls (the backend handles TXN number generation).

### A7. RestockService stubs — add TODO warnings
- In `backend/services/inventory/RestockService.ts`, the TODO stubs at lines 252 and 394 should throw `NotImplementedError` instead of silently doing nothing
- Add: `throw new Error('RestockBatch not implemented');`

### A8. eslint-disable comments — fix underlying issues where possible
- Review the 13 `eslint-disable` / `@ts-ignore` usages in frontend
- For `react-hooks/exhaustive-deps`: add missing deps or restructure to remove the suppression where safe
- Don't break existing behavior — if adding deps would cause infinite loops, leave the suppress but add a comment explaining WHY

### A9. Purchase history TODO cleanup
- In `SimpleTransactionForm.tsx`, there are 4 TODO comments about `/api/customers/:id/purchase-history`
- Leave the TODOs but consolidate: remove duplicate TODO comments, keep ONE clear TODO at the top of the file

## Part B: Move Business Logic to Backend

### B1. Backend: Add price recalculation to transaction creation
In `backend/controllers/transactions.controller.ts` `createTransaction`:

After the existing discount validation block, ADD a price verification block:

```ts
// ========================================================================
// SERVER-SIDE PRICE VERIFICATION
// Recalculate all prices from product data — never trust frontend prices
// ========================================================================
{
  const productIds = transactionData.items
    .filter((item: any) => item.productId && /^[a-fA-F0-9]{24}$/.test(item.productId) && item.itemType !== 'custom_blend')
    .map((item: any) => item.productId);
  
  if (productIds.length > 0) {
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(products.map(p => [p._id.toString(), p]));
    
    for (const item of transactionData.items) {
      if (item.itemType === 'custom_blend') continue; // handled separately
      
      const product = productMap.get(item.productId);
      if (!product) continue;
      
      // Recalculate unit price from server-side product data
      if (item.saleType === 'volume' && product.containerCapacity) {
        item.unitPrice = product.sellingPrice / product.containerCapacity;
      } else {
        item.unitPrice = product.sellingPrice;
      }
      
      // Recalculate total
      item.totalPrice = item.unitPrice * item.quantity - (item.discountAmount || 0);
    }
  }
}
```

### B2. Backend: Add blend price verification
In the same `createTransaction`, add after B1:

```ts
// ========================================================================
// CUSTOM BLEND PRICE VERIFICATION  
// Recalculate blend prices from ingredient costs + margin
// ========================================================================
{
  for (const item of transactionData.items) {
    if (item.itemType !== 'custom_blend' || !item.customBlendData) continue;
    
    const ingredientProductIds = item.customBlendData.ingredients
      .map((ing: any) => ing.productId)
      .filter((id: string) => /^[a-fA-F0-9]{24}$/.test(id));
    
    if (ingredientProductIds.length > 0) {
      const ingredientProducts = await Product.find({ _id: { $in: ingredientProductIds } }).lean();
      const ingredientMap = new Map(ingredientProducts.map(p => [p._id.toString(), p]));
      
      let totalIngredientCost = 0;
      for (const ing of item.customBlendData.ingredients) {
        const product = ingredientMap.get(ing.productId);
        if (product) {
          ing.costPerUnit = product.sellingPrice;
          totalIngredientCost += ing.quantity * product.sellingPrice;
        }
      }
      
      item.customBlendData.totalIngredientCost = totalIngredientCost;
      
      // Verify selling price is at least ingredient cost (prevent below-cost sales)
      if (item.unitPrice < totalIngredientCost) {
        // Allow it but log warning — staff may intentionally discount
        console.warn(`[Transaction] Custom blend "${item.name}" priced below ingredient cost: $${item.unitPrice} < $${totalIngredientCost}`);
      }
    }
  }
}
```

### B3. Backend: Server-side discount recalculation
In `createTransaction`, add after B2:

```ts
// ========================================================================
// SERVER-SIDE DISCOUNT RECALCULATION
// Look up customer tier and recalculate membership discounts
// ========================================================================
{
  if (transactionData.customerId) {
    const Patient = mongoose.model('Patient');
    const customer = await Patient.findById(transactionData.customerId).lean();
    
    if (customer?.memberBenefits?.discountPercentage) {
      const serverDiscountRate = customer.memberBenefits.discountPercentage;
      
      for (const item of transactionData.items) {
        // Only apply to eligible item types
        if (item.itemType !== 'product' && item.itemType !== 'fixed_blend') continue;
        
        // Check product discount flags
        if (item.productId) {
          const product = await Product.findById(item.productId).select('discountFlags').lean();
          if (product?.discountFlags?.discountableForMembers === false) continue;
        }
        
        const itemSubtotal = item.unitPrice * item.quantity;
        const serverDiscount = itemSubtotal * (serverDiscountRate / 100);
        
        // Use server-calculated discount (override frontend)
        item.discountAmount = Math.round(serverDiscount * 100) / 100;
        item.totalPrice = itemSubtotal - item.discountAmount;
      }
    }
  }
}
```

### B4. Backend: Recalculate transaction totals
In `createTransaction`, add after B3 (right before the MongoDB session/save block):

```ts
// ========================================================================
// RECALCULATE TRANSACTION TOTALS FROM ITEMS
// Never trust frontend-supplied subtotal/totalAmount
// ========================================================================
{
  const recalcSubtotal = transactionData.items.reduce(
    (sum: number, item: any) => sum + ((item.unitPrice ?? 0) * (item.quantity ?? 0)), 0
  );
  const recalcItemDiscounts = transactionData.items.reduce(
    (sum: number, item: any) => sum + (item.discountAmount ?? 0), 0
  );
  const recalcTotal = recalcSubtotal - recalcItemDiscounts - (transactionData.discountAmount ?? 0);
  
  transactionData.subtotal = Math.round(recalcSubtotal * 100) / 100;
  transactionData.totalAmount = Math.round(recalcTotal * 100) / 100;
}
```

### B5. Backend: Add ingredient stock validation for custom blends
In `createTransaction`, within the inventory deduction block, add validation that custom blend ingredients exist and have sufficient stock (or log warnings for negative stock).

## Important Notes:
- Run `cd frontend && pnpm build` after all changes to verify no type errors
- Run `cd backend && npx tsc --noEmit` to verify backend compiles
- Do NOT change any API contracts/response shapes
- Do NOT modify the Transaction mongoose schema
- Keep all changes backward compatible
- The Patient model is already imported via mongoose.model('Patient') pattern

When completely finished, run this command to notify me:
openclaw system event --text "Done: All L2L-CRM audit fixes complete — frontend bugs + backend business logic migration" --mode now
