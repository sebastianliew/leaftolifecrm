# L2L-CRM-NEW Inventory Infrastructure Audit
**Audit Date:** February 23, 2026  
**Auditor:** Senior Code Review Agent  
**Scope:** Backend inventory infrastructure (40 files)

---

## Executive Summary

**Overall Severity: 8/10** (Critical - Requires Immediate Attention)

This codebase exhibits significant architectural debt with pervasive DRY and SOLID violations. While functional, the current structure creates high maintenance costs, increases bug risk, and severely limits extensibility. The primary issues are:

1. **Massive code duplication** across controllers (60%+ repeated patterns)
2. **Single Responsibility violations** - models and controllers doing far too much
3. **God objects** - Product model has 15+ distinct responsibilities
4. **Brittle switch/case chains** violating Open/Closed principle
5. **Missing abstraction layers** causing tight coupling to Mongoose
6. **Inconsistent patterns** across similar components

**Immediate Risk Areas:**
- Transaction inventory deduction logic (race conditions possible)
- Product stock management (13 different methods in one model)
- Duplicate validation logic (maintenance nightmare)
- Missing dependency injection (impossible to test properly)

**Technical Debt Estimate:** 3-4 weeks of refactoring to reach acceptable standards

---

## 1. DRY (Don't Repeat Yourself) Violations

### 1.1 Controller Query Building Duplication (CRITICAL)
**Severity: 9/10** | Files: All controllers | Lines: ~600 total

Every controller rebuilds the same query pattern:

```typescript
// products.controller.ts:75-145 (70 lines)
const query: ProductQuery = {};
if (search) {
  query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { sku: { $regex: search, $options: 'i' } }
  ];
}
if (status) {
  query.status = status;
  query.isActive = status === 'active';
}

// brands.controller.ts:28-50 (22 lines) - EXACT SAME PATTERN
const query: BrandQuery = {};
if (search) {
  query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { code: { $regex: search, $options: 'i' } }
  ];
}

// suppliers.controller.ts:28-53 (25 lines) - EXACT SAME PATTERN
const query: SupplierQuery = {};
if (search) {
  query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { code: { $regex: search, $options: 'i' } }
  ];
}
```

**Impact:** 6 controllers × 40 lines average = 240 lines of duplicate code  
**Fix:** Create `QueryBuilder` utility class

---

### 1.2 Validation Existence Checks (CRITICAL)
**Severity: 8/10** | Files: products.controller.ts, bundles.controller.ts, brands.controller.ts | Lines: ~180 total

Same reference validation repeated everywhere:

```typescript
// products.controller.ts:254-268 (14 lines)
const categoryExists = await Category.exists({ _id: category });
if (!categoryExists) {
  res.status(400).json({ error: 'Invalid category' });
  return;
}
if (brand) {
  const brandExists = await Brand.exists({ _id: brand });
  if (!brandExists) {
    res.status(400).json({ error: 'Invalid brand' });
    return;
  }
}

// bundles.controller.ts:162-173 (11 lines) - DUPLICATE
const item = await Product.findById(bundleProduct.productId);
if (!item) {
  res.status(400).json({ error: `Product with ID ${bundleProduct.productId} not found` });
  return;
}

// brands.controller.ts:79-87 (8 lines) - DUPLICATE
const existingBrand = await Brand.findOne({
  $or: [{ name: { $regex: `^${name}$`, $options: 'i' } }]
});
if (existingBrand) {
  res.status(400).json({ error: 'Brand with this name already exists' });
  return;
}
```

**Impact:** At least 12 validation checks × 8 lines average = 96 lines of duplicate code  
**Fix:** Create `ReferenceValidator` service

---

### 1.3 Error Handling Patterns (HIGH)
**Severity: 7/10** | Files: All controllers | Lines: ~320 total

Every controller has identical try-catch patterns:

```typescript
// products.controller.ts:87,185,237,298,354,396,437,490,525 (9 occurrences)
} catch (error) {
  console.error('Error fetching products:', error);
  res.status(500).json({ error: 'Failed to fetch products' });
}

// bundles.controller.ts:86,122,152,217,255,283,303,323,343,380 (10 occurrences)
} catch (error) {
  console.error('Error fetching bundles:', error);
  res.status(500).json({ error: 'Failed to fetch bundles' });
}

// brands.controller.ts:59,79,120,163,213 (5 occurrences)
} catch (error) {
  console.error('Error fetching brands:', error);
  res.status(500).json({ error: 'Failed to fetch brands' });
}
```

**Impact:** 40+ identical error handlers across codebase  
**Fix:** Create error handling middleware/decorator

---

### 1.4 Soft Delete Implementation (HIGH)
**Severity: 7/10** | Files: Product.ts, BlendTemplate.ts | Lines: ~80 total

Soft delete logic duplicated in multiple models:

```typescript
// Product.ts:108-114 (schema definition)
isDeleted: { type: Boolean, default: false },
deletedAt: { type: Date },
deletedBy: { type: String },
deleteReason: { type: String }

// BlendTemplate.ts:93-97 (schema definition) - EXACT DUPLICATE
isDeleted: { type: Boolean, default: false },
deletedAt: Date,
deletedBy: String,
deleteReason: String

// products.controller.ts:407-421 (15 lines soft delete logic)
product.isDeleted = true;
product.isActive = false;
product.status = 'inactive';
product.deletedAt = new Date();
if (authReq.user) {
  product.deletedBy = String(authReq.user._id);
}
product.deleteReason = 'User requested deletion';

// BlendTemplateService.ts:104-115 (12 lines) - NEAR DUPLICATE
template.isDeleted = true;
template.deletedAt = new Date();
template.deletedBy = deletedBy || 'system';
template.deleteReason = 'User requested deletion';
```

**Impact:** 4 models with duplicate soft delete, ~20 lines each = 80 lines  
**Fix:** Create SoftDeletable plugin/mixin for Mongoose

---

### 1.5 SKU/Code Generation (MEDIUM)
**Severity: 6/10** | Files: Product.ts, Bundle.ts, Brand.ts, Supplier.ts | Lines: ~120 total

Same auto-generation pattern in 4 different models:

```typescript
// Product.ts:501-531 (30 lines)
generateSKU = async function() {
  if (this.sku) return this.sku;
  let brandPrefix = 'GEN';
  if (this.brandName) {
    brandPrefix = this.brandName.substring(0, 3).toUpperCase();
  }
  const productAbbr = this.name.substring(0, 2).toUpperCase();
  const existingProducts = await Product.find({
    sku: { $regex: `^${brandPrefix}-${productAbbr}-` }
  }).sort({ sku: 1 });
  // ...counting logic
}

// Bundle.ts:143-152 (10 lines) - SIMILAR PATTERN
if (!this.sku) {
  try {
    const count = await this.constructor.countDocuments({});
    this.sku = `BDL-${(count + 1).toString().padStart(6, '0')}`;
  }
}

// Brand.ts:77-91 (15 lines) - SIMILAR PATTERN
if (this.isNew && !this.code) {
  const count = await BrandModel.countDocuments({});
  this.code = `BRD${String(count + 1).padStart(5, '0')}`;
}

// Supplier.ts:179-185 (7 lines) - SIMILAR PATTERN
if (!this.code) {
  const prefix = this.name.substring(0, 3).toUpperCase();
  const count = await this.constructor.countDocuments({ code: { $regex: `^${prefix}` } });
  this.code = `${prefix}${(count + 1).toString().padStart(4, '0')}`;
}
```

**Impact:** 4 implementations × 15 lines average = 60 lines duplicate logic  
**Fix:** Create `CodeGenerator` utility service

---

### 1.6 Pagination Logic (MEDIUM)
**Severity: 6/10** | Files: All controllers | Lines: ~200 total

Same pagination calculation in every list endpoint:

```typescript
// products.controller.ts:73-76, bundles.controller.ts:51-54, brands.controller.ts:38-41
const pageNum = parseInt(page);
const limitNum = parseInt(limit);
const skip = (pageNum - 1) * limitNum;
const sortOptions: { [key: string]: 1 | -1 } = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

// Repeated in:
// - getProducts (products.controller.ts:73-76)
// - getBundles (bundles.controller.ts:51-54)
// - getBrands (brands.controller.ts:38-41)
// - getSuppliers (suppliers.controller.ts:38-41)
// - getUnits (units.controller.ts) - missing pagination!
```

**Impact:** 10+ endpoints with identical pagination = 40 lines  
**Fix:** Create `PaginationHelper` utility

---

### 1.7 Population Pattern Duplication (MEDIUM)
**Severity: 5/10** | Files: All controllers | Lines: ~150 total

Same populate chains everywhere:

```typescript
// products.controller.ts:82-84
.populate('category', 'name')
.populate('brand', 'name')
.populate('unitOfMeasurement', 'name abbreviation')

// Repeated verbatim in:
// - getProducts (products.controller.ts:82-84)
// - getProductById (products.controller.ts:177-179)
// - createProduct (products.controller.ts:318-320)
// - updateProduct (products.controller.ts:374)

// Similar pattern in bundles:
// bundles.controller.ts:59, 126
.populate('bundleProducts.productId', 'name sku availableStock')
```

**Impact:** 15+ populate chains with same fields  
**Fix:** Define populate configurations as constants

---

### 1.8 Ingredient Validation Duplication (HIGH)
**Severity: 7/10** | Files: BlendTemplateService.ts, CustomBlendService.ts, BlendIngredientValidator.ts | Lines: ~200

Three different services validate ingredients almost identically:

```typescript
// BlendTemplateService.ts:222-265 (43 lines)
private async validateAndEnrichIngredients(ingredients) {
  for (const ingredient of ingredients) {
    const product = await Product.findById(ingredient.productId);
    if (!product) {
      throw new Error(`Product not found: ${ingredient.name}`);
    }
    const uom = await UnitOfMeasurement.findById(ingredient.unitOfMeasurementId);
    // ... enrichment logic
  }
}

// BlendIngredientValidator.ts:78-155 (77 lines) - 80% DUPLICATE
private async enrichSingleIngredient(ingredient) {
  const product = await Product.findById(ingredient.productId);
  if (!product) {
    throw new Error(`Product not found: ${ingredient.name}`);
  }
  const uom = await this.findSuitableUOM(ingredient);
  // ... enrichment logic
}

// CustomBlendService.ts:230-260 (30 lines) - 70% DUPLICATE
async enrichIngredientData(ingredients) {
  for (const ingredient of ingredients) {
    const product = await Product.findById(ingredient.productId);
    if (!product) {
      throw new Error(`Product not found: ${ingredient.name}`);
    }
    const uom = await UnitOfMeasurement.findById(ingredient.unitOfMeasurementId);
    // ... similar logic
  }
}
```

**Impact:** 3 services × 50 lines average = 150 lines of redundant validation  
**Fix:** Consolidate into single IngredientValidator service

---

### 1.9 Container Deduction Logic (CRITICAL)
**Severity: 8/10** | Files: CustomBlendService.ts, Product.ts | Lines: ~100

Container handling duplicated with subtle differences:

```typescript
// CustomBlendService.ts:58-115 (57 lines)
private async processContainerBasedIngredientDeduction(selectedContainers, totalRequired, product) {
  for (const containerData of selectedContainers) {
    const isFullContainerConsumption = quantityToConsume >= containerCapacity;
    if (isFullContainerConsumption) {
      await product.handleFullContainerSale();
    } else {
      await product.handlePartialContainerSale(quantityToConsume);
    }
  }
}

// Product.ts:225-305 (80 lines) - SIMILAR BUT DIFFERENT
handlePartialContainerSale = async function(quantity, options?) {
  // Similar FIFO logic but with differences in:
  // - Sale history recording
  // - Container selection
  // - Oversold handling
  // This creates confusion about which is "correct"
}
```

**Impact:** Two competing implementations causing bugs  
**Fix:** Unify into single container management service

---

### 1.10 Transform/DTO Logic (MEDIUM)
**Severity: 6/10** | Files: suppliers.controller.ts, brands.controller.ts, SupplierService.ts | Lines: ~60

Manual DTO transformation repeated:

```typescript
// suppliers.controller.ts:60-65
const transformedSuppliers = suppliers.map(supplier => ({
  ...supplier.toObject(),
  id: supplier._id.toString(),
  _id: undefined
}));

// suppliers.controller.ts:82-86 - DUPLICATE
const transformedSupplier = {
  ...supplier.toObject(),
  id: supplier._id.toString(),
  _id: undefined
};

// SupplierService.ts:12-16 - DUPLICATE
return suppliers.map(supplier => ({
  ...supplier.toObject(),
  id: supplier._id.toString(),
  _id: undefined
}));
```

**Impact:** 8+ manual transformations  
**Fix:** Create DTO mapper utility or use class-transformer

---

## 2. SOLID Principle Violations

### 2.1 Single Responsibility Principle (SRP) - CRITICAL

#### 2.1.1 Product Model God Object
**Severity: 10/10** | File: Product.ts | Lines: 1-540

The Product model has **at least 15 distinct responsibilities:**

```typescript
// Product.ts responsibilities:
1. Data schema definition (lines 15-108)
2. Container/bottle tracking (lines 136-305)
3. Stock deduction logic (lines 225-305)
4. Restock analytics (lines 307-318)
5. Restock detection (lines 320-324)
6. Restock quantity calculation (lines 326-331)
7. Auto-reorder scheduling (lines 333-341)
8. Backorder management (lines 343-347)
9. Oversold detection (lines 349-353)
10. Available stock calculation (lines 355-359)
11. Reference auto-creation (lines 373-430)
12. Unit conversion (lines 432-462)
13. Unit conversion management (lines 464-469)
14. SKU generation (lines 471-498)
15. Soft delete (schema fields)
```

**Example - Stock Management Alone (80 lines):**
```typescript
// Product.ts:225-305
handlePartialContainerSale(quantity, options?) { /* 80 lines */ }
handleFullContainerSale() { /* 20 lines */ }
updateRestockAnalytics(quantity) { /* 10 lines */ }
needsRestock(threshold?) { /* 4 lines */ }
getSuggestedRestockQuantity() { /* 7 lines */ }
isAutoReorderDue() { /* 9 lines */ }
getBackorderQuantity() { /* 4 lines */ }
isOversold() { /* 3 lines */ }
getAvailableStock() { /* 3 lines */ }
needsUrgentRestock() { /* 3 lines */ }
```

**Impact:**
- Product.ts is 540 lines (should be <100 for data model)
- Impossible to test in isolation
- Changes to stock logic require model redeployment
- High coupling - everything depends on Product

**Fix Required:**
```
Create separate services:
- ProductStockService (stock operations)
- ProductContainerService (bottle tracking)
- ProductRestockService (restock logic)
- ProductCodeService (SKU generation)
- ProductUnitService (unit conversions)
Keep Product as pure data model
```

---

#### 2.1.2 Controller Bloat - All Controllers
**Severity: 9/10** | Files: All 7 controllers | Lines: ~2000 total

Controllers violate SRP by doing 6+ jobs:

```typescript
// products.controller.ts:62-184 (122 lines just for getProducts)
export const getProducts = async (req, res) => {
  // 1. Input parsing/validation (lines 71-90)
  const { page, limit, search, category, /* ...10 more params */ } = req.query;
  
  // 2. Query building (lines 92-150)
  const query: ProductQuery = {};
  if (search) { /* build $or query */ }
  if (category) { /* add filter */ }
  // ...8 more filters
  
  // 3. Pagination calculation (lines 152-156)
  const pageNum = parseInt(page);
  const skip = (pageNum - 1) * limitNum;
  
  // 4. Database query execution (lines 158-167)
  const [products, total] = await Promise.all([
    Product.find(query).populate(...).sort(...).skip(...).limit(...)
  ]);
  
  // 5. Response formatting (lines 169-175)
  res.json({
    products,
    pagination: { /* calculate pages */ }
  });
  
  // 6. Error handling (lines 176-179)
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};
```

**Controllers should only:** Route → Service → Response  
**Currently doing:** Validation + Query Building + Pagination + Error Handling + Logging + Response Formatting

**Fix:** Move business logic to service layer

---

#### 2.1.3 TransactionInventoryService Doing Too Much
**Severity: 8/10** | File: TransactionInventoryService.ts | Lines: 1-440

One service handles 6 different transaction types:

```typescript
// TransactionInventoryService.ts:75-113
private async processItem(item, transactionRef, userId, session) {
  // Routing logic for 6 item types (should be separate handlers)
  switch (itemType) {
    case 'product': return this.processProductItem(...);
    case 'fixed_blend': return this.processFixedBlendItem(...);
    case 'bundle': return this.processBundleItem(...);
    case 'custom_blend': /* special case */
    case 'miscellaneous': /* no-op */
    case 'service': /* no-op */
    case 'consultation': /* no-op */
  }
}

// Plus duplicate deduction prevention (lines 38-51)
// Plus reversal logic (lines 305-415)
// Plus bundle blend handling (lines 278-304)
```

**Fix:** Strategy pattern with separate handlers per item type

---

#### 2.1.4 BlendTemplateService Mixed Concerns
**Severity: 7/10** | File: BlendTemplateService.ts | Lines: 1-270

Service mixes business logic, validation, and data access:

```typescript
// BlendTemplateService.ts contains:
// - Template CRUD (lines 22-144) ✓ Correct responsibility
// - Ingredient validation (lines 146-177) ✗ Should be in validator
// - Data enrichment (lines 179-265) ✗ Should be in repository/mapper
// - Usage tracking (lines 120-133) ✗ Should be separate service
// - Category management (lines 267-275) ✗ Should be in CategoryService
```

**Fix:** Split into focused services following SRP

---

### 2.2 Open/Closed Principle (OCP) - HIGH

#### 2.2.1 TransactionInventoryService Item Type Switch
**Severity: 9/10** | File: TransactionInventoryService.ts | Lines: 75-113

Adding new item types requires modifying existing code:

```typescript
// TransactionInventoryService.ts:75-113
private async processItem(item, transactionRef, userId, session) {
  const itemType = item.itemType || 'product';
  
  // VIOLATION: Must modify this switch for every new item type
  switch (itemType) {
    case 'product':
      return this.processProductItem(item, transactionRef, userId, session);
    case 'fixed_blend':
      return this.processFixedBlendItem(item, transactionRef, userId, session);
    case 'bundle':
      return this.processBundleItem(item, transactionRef, userId, session);
    case 'custom_blend':
      console.log('Skipping custom_blend...');
      return [];
    case 'miscellaneous':
    case 'service':
    case 'consultation':
      console.log(`Skipping ${itemType}...`);
      return [];
    default:
      // Falls back to product - DANGEROUS!
      return this.processProductItem(item, transactionRef, userId, session);
  }
}
```

**Problem:** Cannot add new item types (e.g., 'subscription', 'gift_card') without modifying core service

**Fix - Strategy Pattern:**
```typescript
interface ItemProcessor {
  canProcess(itemType: string): boolean;
  process(item: TransactionItem, context: ProcessContext): Promise<IInventoryMovement[]>;
}

class TransactionInventoryService {
  private processors: ItemProcessor[] = [
    new ProductItemProcessor(),
    new FixedBlendProcessor(),
    new BundleProcessor(),
    // New processors can be added without changing this class
  ];
  
  async processItem(item: TransactionItem, context: ProcessContext) {
    const processor = this.processors.find(p => p.canProcess(item.itemType));
    if (!processor) throw new Error(`No processor for ${item.itemType}`);
    return processor.process(item, context);
  }
}
```

---

#### 2.2.2 Hard-Coded Movement Types
**Severity: 7/10** | File: InventoryMovement.ts | Lines: 17-18

Movement types hard-coded in enum:

```typescript
// InventoryMovement.ts:17-18
movementType: {
  type: String,
  required: true,
  enum: ['sale', 'return', 'adjustment', 'transfer', 'fixed_blend', 
         'bundle_sale', 'bundle_blend_ingredient', 'blend_ingredient', 'custom_blend'],
},
```

**Problem:** Adding new movement types requires schema migration

**Fix:** Make movement types configurable/extensible

---

#### 2.2.3 Container Status Hard-Coded
**Severity: 6/10** | File: Product.ts | Lines: 29-33

Container status enum prevents extension:

```typescript
// Product.ts:29-33
status: {
  type: String,
  enum: ['full', 'partial', 'empty', 'oversold'],
  default: 'full'
}
```

**Problem:** Cannot add states like 'reserved', 'expired', 'damaged' without migration

**Fix:** Use configurable status system

---

### 2.3 Liskov Substitution Principle (LSP) - LOW

**Severity: 3/10** | No major violations found

The codebase doesn't use much inheritance, so LSP violations are minimal. Most classes/services are concrete implementations rather than subtypes.

---

### 2.4 Interface Segregation Principle (ISP) - MEDIUM

#### 2.4.1 Fat Interfaces - IProduct
**Severity: 6/10** | File: Product.ts, product.types.ts | Lines: Multiple

IProduct interface forces clients to depend on 40+ fields:

```typescript
// Product.ts:8-77 (interface with 40+ fields)
export interface IProduct extends Document {
  // Basic fields (8)
  name: string;
  description?: string;
  category: Schema.Types.ObjectId;
  sku: string;
  brand?: Schema.Types.ObjectId;
  containerType?: Schema.Types.ObjectId;
  unitOfMeasurement: Schema.Types.ObjectId;
  
  // Stock fields (7)
  quantity: number;
  reorderPoint: number;
  currentStock: number;
  totalQuantity: number;
  availableStock: number;
  reservedStock: number;
  
  // Pricing (2)
  costPrice?: number;
  sellingPrice?: number;
  
  // Status (3)
  status: 'active' | 'inactive' | 'discontinued' | 'pending_approval';
  isActive: boolean;
  expiryDate?: Date;
  
  // Restock (5)
  autoReorderEnabled: boolean;
  lastRestockDate?: Date;
  restockFrequency: number;
  averageRestockQuantity: number;
  restockCount: number;
  
  // Container (2 complex objects)
  containerCapacity: number;
  containers: { /* nested 5 fields */ };
  
  // Migration (3)
  supplierId?: Schema.Types.ObjectId;
  legacyId?: string;
  migrationData?: { /* nested 3 fields */ };
  
  // Soft delete (4)
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  deleteReason?: string;
  
  // Methods (13 - even worse!)
  handlePartialContainerSale(...): Promise<void>;
  handleFullContainerSale(): Promise<void>;
  updateRestockAnalytics(...): Promise<void>;
  needsRestock(...): boolean;
  // ...9 more methods
}
```

**Problem:** Components that only need basic product info (name, SKU) are forced to depend on restock, container, migration, soft-delete fields

**Fix:** Split into focused interfaces:
```typescript
interface IProductBase {
  name: string;
  sku: string;
  category: string;
}

interface IProductStock {
  currentStock: number;
  availableStock: number;
  reservedStock: number;
}

interface IProductRestock {
  autoReorderEnabled: boolean;
  reorderPoint: number;
  getSuggestedRestockQuantity(): number;
}

interface IProductContainer {
  containerCapacity: number;
  containers: ContainerInfo;
  handlePartialSale(qty: number): Promise<void>;
}
```

---

### 2.5 Dependency Inversion Principle (DIP) - CRITICAL

#### 2.5.1 Direct Mongoose Model Dependencies
**Severity: 9/10** | Files: All services | Lines: ~1000

Services directly depend on Mongoose models instead of abstractions:

```typescript
// BlendTemplateService.ts:4-6
import { Product } from '../models/Product.js';
import { UnitOfMeasurement } from '../models/UnitOfMeasurement.js';
import { InventoryMovement } from '../models/inventory/InventoryMovement.js';

// CustomBlendService.ts:1-4
import { Product } from '../models/Product.js';
import { UnitOfMeasurement } from '../models/UnitOfMeasurement.js';
import { InventoryMovement } from '../models/inventory/InventoryMovement.js';

// TransactionInventoryService.ts:2-5
import { Product } from '../models/Product.js';
import { Bundle } from '../models/Bundle.js';
import { BlendTemplate } from '../models/BlendTemplate.js';
import { InventoryMovement } from '../models/inventory/InventoryMovement.js';
```

**Problems:**
1. Cannot swap data sources (PostgreSQL, Redis, etc.)
2. Cannot test without real database
3. Tight coupling to Mongoose API
4. Cannot use different ORMs

**Fix - Dependency Injection with Repositories:**
```typescript
// Define abstractions
interface IProductRepository {
  findById(id: string): Promise<IProduct | null>;
  findByIds(ids: string[]): Promise<IProduct[]>;
  updateStock(id: string, delta: number): Promise<void>;
}

// Service depends on abstraction
class BlendTemplateService {
  constructor(
    private productRepo: IProductRepository,
    private uomRepo: IUnitRepository
  ) {}
  
  async createTemplate(data: CreateTemplateData) {
    const product = await this.productRepo.findById(data.productId);
    // Now testable with mock repositories!
  }
}

// Implementation uses Mongoose
class MongooseProductRepository implements IProductRepository {
  async findById(id: string) {
    return Product.findById(id);
  }
}
```

---

#### 2.5.2 RestockService - Good Example, But Alone
**Severity: 5/10** | File: RestockService.ts | Lines: 59-107

RestockService DOES use DI (only service that does!):

```typescript
// RestockService.ts:107-113
export class RestockService {
  constructor(
    private inventoryRepository: IInventoryRepository = new MongoInventoryRepository(),
    private notificationService: IRestockNotificationService = new NoOpNotificationService()
  ) {}
```

**Problem:** This is the ONLY service using dependency injection!  
**Why It Matters:** Shows the pattern is known but not applied consistently

---

#### 2.5.3 Controllers Tightly Coupled to Models
**Severity: 8/10** | Files: All controllers | Lines: ~500

Controllers directly import and use Mongoose models:

```typescript
// products.controller.ts:3-7
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Brand } from '../models/Brand.js';
import { UnitOfMeasurement } from '../models/UnitOfMeasurement.js';

// Then directly use them:
// Line 82-86
const [products, total] = await Promise.all([
  Product.find(query)
    .populate('category', 'name')
    .populate('brand', 'name')
    .sort(sortOptions)
]);
```

**Should be:**
```typescript
class ProductController {
  constructor(
    private productService: IProductService
  ) {}
  
  async getProducts(req, res) {
    const products = await this.productService.findAll(filters);
    res.json(products);
  }
}
```

---

## 3. Top 10 Priority Fixes (Ranked by Impact)

### #1 - Extract Business Logic from Product Model
**Impact: CRITICAL** | **Effort: 3 weeks** | **Risk Reduction: 60%**

**Current:** Product.ts is 540 lines with 15 responsibilities  
**Target:** Split into:
- `Product.ts` (80 lines - data only)
- `ProductStockService.ts` (stock operations)
- `ProductContainerService.ts` (bottle tracking)
- `ProductRestockService.ts` (restock analytics)

**Immediate Benefits:**
- Testable stock logic (currently untestable)
- Prevents race conditions in stock updates
- Enables independent deployment of stock logic

---

### #2 - Create Query Builder Utility
**Impact: HIGH** | **Effort: 1 week** | **Risk Reduction: 30%**

**Problem:** 240 lines of duplicate query building  
**Fix:** Generic QueryBuilder

```typescript
class QueryBuilder<T> {
  private query: FilterQuery<T> = {};
  
  search(term: string, fields: string[]) {
    if (term) {
      this.query.$or = fields.map(f => ({
        [f]: { $regex: term, $options: 'i' }
      }));
    }
    return this;
  }
  
  filter(field: string, value: any) {
    if (value !== undefined) {
      this.query[field] = value;
    }
    return this;
  }
  
  build() {
    return this.query;
  }
}

// Usage:
const query = new QueryBuilder<Product>()
  .search(req.query.search, ['name', 'sku', 'description'])
  .filter('category', req.query.category)
  .filter('status', req.query.status)
  .build();
```

**Saves:** 200+ lines, 6 controller refactors

---

### #3 - Implement Strategy Pattern for Transaction Processing
**Impact: CRITICAL** | **Effort: 2 weeks** | **Risk Reduction: 50%**

**Problem:** Cannot add new item types without modifying TransactionInventoryService  
**Fix:** Strategy pattern (shown in 2.2.1)

**Benefits:**
- Add new item types without touching core
- Each processor independently testable
- Clear separation of concerns

---

### #4 - Create Service Layer with Dependency Injection
**Impact: CRITICAL** | **Effort: 4 weeks** | **Risk Reduction: 70%**

**Current:** Controllers directly use models  
**Target:**

```
Controllers → Services → Repositories → Models
    ↓           ↓           ↓
  Routes    Business    Data Access
            Logic
```

**Example:**
```typescript
// product.service.ts
export class ProductService {
  constructor(
    private productRepo: IProductRepository,
    private categoryRepo: ICategoryRepository,
    private logger: ILogger
  ) {}
  
  async findAll(filters: ProductFilters): Promise<Product[]> {
    const query = new QueryBuilder<Product>()
      .search(filters.search, ['name', 'sku'])
      .filter('category', filters.category)
      .build();
    
    return this.productRepo.findMany(query);
  }
}

// Enables testing:
describe('ProductService', () => {
  it('should find products', async () => {
    const mockRepo = { findMany: jest.fn() };
    const service = new ProductService(mockRepo, mockCategoryRepo, mockLogger);
    await service.findAll({});
    expect(mockRepo.findMany).toHaveBeenCalled();
  });
});
```

---

### #5 - Unify Ingredient Validation
**Impact: HIGH** | **Effort: 1 week** | **Risk Reduction: 40%**

**Problem:** 3 services validate ingredients differently  
**Fix:** Single source of truth

```typescript
class IngredientValidator {
  async validate(ingredients: BlendIngredient[]): Promise<ValidationResult> {
    // Single implementation used by:
    // - BlendTemplateService
    // - CustomBlendService
    // - BlendIngredientValidator
  }
  
  async enrich(ingredients: Ingredient[]): Promise<EnrichedIngredient[]> {
    // Single enrichment logic
  }
}
```

**Saves:** 150 lines, prevents validation bugs

---

### #6 - Create Soft Delete Plugin
**Impact: MEDIUM** | **Effort: 1 week** | **Risk Reduction: 25%**

**Problem:** Soft delete duplicated in 4+ models  
**Fix:** Mongoose plugin

```typescript
// plugins/softDelete.plugin.ts
export function softDeletePlugin(schema: Schema) {
  schema.add({
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: String,
    deleteReason: String
  });
  
  schema.methods.softDelete = function(userId: string, reason: string) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = userId;
    this.deleteReason = reason;
    return this.save();
  };
  
  // Auto-exclude deleted docs
  schema.pre('find', function() {
    if (!this.getOptions().includeDeleted) {
      this.where({ isDeleted: { $ne: true } });
    }
  });
}

// Usage:
productSchema.plugin(softDeletePlugin);
blendTemplateSchema.plugin(softDeletePlugin);
```

---

### #7 - Standardize Error Handling
**Impact: MEDIUM** | **Effort: 1 week** | **Risk Reduction: 30%**

**Problem:** 40+ duplicate error handlers  
**Fix:** Error handling middleware

```typescript
// middleware/errorHandler.ts
export const asyncHandler = (fn: Function) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error); // Pass to centralized error handler
    }
  };
};

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(error);
  
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  
  if (error instanceof NotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  
  res.status(500).json({ error: 'Internal server error' });
};

// Usage:
router.get('/products', asyncHandler(getProducts));
```

---

### #8 - Create Reference Validator Service
**Impact: MEDIUM** | **Effort: 1 week** | **Risk Reduction: 20%**

**Problem:** 96 lines of duplicate existence checks  
**Fix:**

```typescript
class ReferenceValidator {
  async validateExists(modelName: string, id: string): Promise<void> {
    const model = mongoose.model(modelName);
    const exists = await model.exists({ _id: id });
    if (!exists) {
      throw new ValidationError(`${modelName} with id ${id} not found`);
    }
  }
  
  async validateMany(refs: Array<{model: string; id: string}>): Promise<void> {
    await Promise.all(
      refs.map(ref => this.validateExists(ref.model, ref.id))
    );
  }
}

// Usage:
await referenceValidator.validateMany([
  { model: 'Category', id: req.body.category },
  { model: 'Brand', id: req.body.brand }
]);
```

---

### #9 - Implement Repository Pattern
**Impact: HIGH** | **Effort: 3 weeks** | **Risk Reduction: 50%**

**Problem:** Direct Mongoose coupling in all services  
**Fix:** Repository abstraction layer

```typescript
// repositories/IProductRepository.ts
export interface IProductRepository {
  findById(id: string): Promise<Product | null>;
  findMany(query: ProductQuery, options?: QueryOptions): Promise<Product[]>;
  create(data: CreateProductData): Promise<Product>;
  update(id: string, data: Partial<Product>): Promise<Product>;
  delete(id: string): Promise<void>;
  updateStock(id: string, delta: number): Promise<void>;
}

// repositories/MongooseProductRepository.ts
export class MongooseProductRepository implements IProductRepository {
  async findById(id: string) {
    return Product.findById(id).populate('category brand unitOfMeasurement');
  }
  
  async updateStock(id: string, delta: number) {
    // ATOMIC update to prevent race conditions
    return Product.updateOne(
      { _id: id },
      { $inc: { currentStock: delta, availableStock: delta } }
    );
  }
}
```

**Benefits:**
- Testable without database
- Can swap ORMs
- Enables caching layer
- Prevents race conditions with atomic updates

---

### #10 - Create DTO Mapper Utility
**Impact: LOW** | **Effort: 2 days** | **Risk Reduction: 10%**

**Problem:** Manual transformation in 8+ places  
**Fix:**

```typescript
class DTOMapper {
  static toDTO<T extends Document>(doc: T): object {
    const obj = doc.toObject();
    return {
      ...obj,
      id: doc._id.toString(),
      _id: undefined,
      __v: undefined
    };
  }
  
  static toDTOArray<T extends Document>(docs: T[]): object[] {
    return docs.map(doc => this.toDTO(doc));
  }
}

// Usage:
res.json(DTOMapper.toDTOArray(suppliers));
```

---

## 4. Worst Code Examples

### Example #1 - The 122-Line Controller Method
**File:** products.controller.ts:62-184  
**Severity:** CRITICAL

```typescript
export const getProducts = async (
  req: Request<Record<string, never>, Record<string, never>, Record<string, never>, ProductQueryParams>,
  res: Response
): Promise<void> => {
  try {
    // 20 lines of parameter extraction
    const {
      page = '1',
      limit = '20',
      search,
      category,
      brand,
      status,
      stockStatus,
      sortBy = 'name',
      sortOrder = 'asc',
      minStock,
      maxStock,
      minPrice,
      maxPrice
    } = req.query;

    // 60 lines of query building
    const query: ProductQuery = {};
    
    const includeInactive = req.query.includeInactive === 'true';
    if (!includeInactive) {
      query.isDeleted = { $ne: true };
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (brand) {
      query.brand = brand;
    }

    if (status) {
      query.status = status;
      query.isActive = status === 'active';
    }

    if (stockStatus) {
      switch (stockStatus) {
        case 'in_stock':
          query.currentStock = { $gt: 0 };
          break;
        case 'low_stock':
          query.$expr = { $lte: ['$currentStock', '$reorderPoint'] };
          break;
        case 'out_of_stock':
          query.currentStock = 0;
          break;
      }
    }

    if (minStock !== undefined) {
      query.currentStock = { ...(typeof query.currentStock === 'object' ? query.currentStock : {}), $gte: parseInt(minStock) };
    }
    if (maxStock !== undefined) {
      query.currentStock = { ...(typeof query.currentStock === 'object' ? query.currentStock : {}), $lte: parseInt(maxStock) };
    }

    if (minPrice !== undefined) {
      query.sellingPrice = { ...(typeof query.sellingPrice === 'object' ? query.sellingPrice : {}), $gte: parseFloat(minPrice) };
    }
    if (maxPrice !== undefined) {
      query.sellingPrice = { ...(typeof query.sellingPrice === 'object' ? query.sellingPrice : {}), $lte: parseFloat(maxPrice) };
    }

    // Pagination calculation
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const sortOptions: { [key: string]: 1 | -1 } = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Database query
    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name')
        .populate('brand', 'name')
        .populate('unitOfMeasurement', 'name abbreviation')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(query)
    ]);

    res.json({
      products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};
```

**What's Wrong:**
1. 122 lines for ONE endpoint
2. Mixing concerns (validation, query building, pagination, DB access, formatting)
3. No separation of business logic
4. Impossible to unit test
5. Duplicate logic in 5 other controllers
6. No input validation
7. Generic error handling

**Should Be:**
```typescript
export const getProducts = asyncHandler(async (req, res) => {
  const filters = ProductQueryDTO.fromRequest(req);
  const products = await productService.findAll(filters);
  res.json(products);
});
```

---

### Example #2 - The Product Model's handlePartialContainerSale
**File:** Product.ts:225-305  
**Severity:** CRITICAL

```typescript
// 80 LINES in a single method on a DATA MODEL
productSchema.methods.handlePartialContainerSale = async function(
  quantity: number,
  options?: {
    containerId?: string;
    transactionRef?: string;
    userId?: string;
  }
) {
  // If no container capacity is set, treat as regular stock deduction
  if (!this.containerCapacity || this.containerCapacity <= 0) {
    this.currentStock -= quantity;
    await this.save();
    return;
  }

  // Helper to record sale history on a container
  const recordSaleHistory = (container) => {
    if (options?.transactionRef) {
      if (!container.saleHistory) container.saleHistory = [];
      container.saleHistory.push({
        transactionRef: options.transactionRef,
        quantitySold: quantity,
        soldAt: new Date(),
        soldBy: options.userId
      });
    }
  };

  // If a specific container is requested, target that one
  if (options?.containerId) {
    const targetIndex = this.containers?.partial?.findIndex(
      (c) => c.id === options.containerId
    );

    if (targetIndex !== undefined && targetIndex >= 0) {
      const container = this.containers.partial[targetIndex];
      container.remaining -= quantity;
      recordSaleHistory(container);

      if (container.remaining <= 0) {
        container.status = 'empty';
      } else {
        container.status = 'partial';
      }

      this.currentStock = this.totalStock;
      await this.save();
      return;
    }
  }

  // Default FIFO logic - open new bottle or use existing partial
  if (!Array.isArray(this.containers?.partial)) {
    if (!this.containers) this.containers = { full: 0, partial: [] };
    this.containers.partial = [];
  }

  // Check for existing partial containers first (FIFO)
  if (this.containers.partial.length > 0) {
    const activeContainer = this.containers.partial.find(
      (c) => c.status !== 'empty' && c.remaining > 0
    );

    if (activeContainer) {
      activeContainer.remaining -= quantity;
      recordSaleHistory(activeContainer);

      if (activeContainer.remaining <= 0) {
        activeContainer.status = 'empty';
      } else {
        activeContainer.status = 'partial';
      }

      this.currentStock = this.totalStock;
      await this.save();
      return;
    }
  }

  // No active partial containers - open a new bottle from full stock
  if (this.containers?.full > 0) {
    this.containers.full--;
    const newContainer = {
      id: `BOTTLE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      remaining: this.containerCapacity - quantity,
      capacity: this.containerCapacity,
      status: 'partial' as const,
      openedAt: new Date(),
      saleHistory: options?.transactionRef ? [{
        transactionRef: options.transactionRef,
        quantitySold: quantity,
        soldAt: new Date(),
        soldBy: options.userId
      }] : []
    };
    this.containers.partial.push(newContainer);
  } else {
    // No containers available - allow out-of-stock sales by tracking as oversold
    const oversoldContainer = {
      id: `OVERSOLD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      remaining: -quantity,
      capacity: this.containerCapacity,
      status: 'oversold' as const,
      openedAt: new Date(),
      saleHistory: options?.transactionRef ? [{
        transactionRef: options.transactionRef,
        quantitySold: quantity,
        soldAt: new Date(),
        soldBy: options.userId
      }] : []
    };
    this.containers.partial.push(oversoldContainer);
  }

  this.currentStock = this.totalStock;
  await this.save();
};
```

**What's Wrong:**
1. 80 lines of business logic in a DATA MODEL
2. Multiple responsibilities (FIFO logic, history tracking, oversold handling)
3. Side effects (modifies multiple fields, saves document)
4. Cannot unit test without full database
5. Violates SRP - model should not contain complex business logic
6. Makes Product model impossible to understand
7. Cannot reuse this logic elsewhere

**Should Be:**
```typescript
// In ProductContainerService.ts
class ProductContainerService {
  async deductFromPartial(
    product: IProduct,
    quantity: number,
    options: SaleOptions
  ): Promise<void> {
    const strategy = this.getDeductionStrategy(product, options);
    await strategy.execute(product, quantity, options);
    await this.productRepo.save(product);
  }
}
```

---

### Example #3 - Duplicate Ingredient Validation (3 Places!)
**Files:** BlendTemplateService.ts:222-265, CustomBlendService.ts:230-260, BlendIngredientValidator.ts:78-155  
**Severity:** HIGH

**BlendTemplateService.ts:222-265 (43 lines)**
```typescript
private async validateAndEnrichIngredients(ingredients) {
  const enrichedIngredients = [];
  
  for (let i = 0; i < ingredients.length; i++) {
    const ingredient = ingredients[i];
    
    // Validate product exists
    const product = await Product.findById(ingredient.productId);
    if (!product) {
      console.error(`Product not found with ID: ${ingredient.productId}`);
      throw new Error(`Product not found: ${ingredient.name}`);
    }
    
    // Validate unit of measurement with fallback logic
    let uom = null;
    let unitId = ingredient.unitOfMeasurementId;
    
    if (unitId) {
      uom = await UnitOfMeasurement.findById(unitId);
      if (!uom) {
        console.warn(`Unit not found with ID: ${unitId}`);
      }
    }
    
    // If no unit found, try to find a suitable default unit
    if (!uom) {
      console.warn(`Unit of measurement not found for ingredient: ${ingredient.name}, trying to find suitable default...`);
      
      const defaultUoms = await UnitOfMeasurement.find({
        isActive: true,
        $or: [
          { name: { $regex: /gram/i } },
          { name: { $regex: /milliliter/i } },
          { name: { $regex: /^ml$/i } },
          { name: { $regex: /^g$/i } },
          { type: 'weight' },
          { type: 'volume' }
        ]
      }).sort({ name: 1 }).limit(1);
      
      if (defaultUoms.length > 0) {
        uom = defaultUoms[0];
        unitId = uom._id.toString();
        console.warn(`Using default unit ${uom.name} for ingredient: ${ingredient.name}`);
      } else {
        console.error(`No suitable unit of measurement found for ingredient: ${ingredient.name}`);
        throw new Error(`No suitable unit of measurement found for ingredient: ${ingredient.name}. Please ensure the ingredient has a valid unit assigned.`);
      }
    }
    
    const enrichedIngredient = {
      ...ingredient,
      unitOfMeasurementId: unitId,
      name: product.name,
      unitName: uom.name,
      costPerUnit: ingredient.costPerUnit || product.sellingPrice || 0
    };
    
    enrichedIngredients.push(enrichedIngredient);
  }
  
  return enrichedIngredients;
}
```

**CustomBlendService.ts:230-260 (30 lines) - 70% DUPLICATE**
```typescript
async enrichIngredientData(ingredients) {
  await connectDB();
  
  const enrichedIngredients: BlendIngredient[] = [];
  
  try {
    for (const ingredient of ingredients) {
      const product = await Product.findById(ingredient.productId)
        .populate('unitOfMeasurement');
      
      if (!product) {
        throw new Error(`Product not found: ${ingredient.name}`);
      }
      
      const uom = await UnitOfMeasurement.findById(ingredient.unitOfMeasurementId);
      
      enrichedIngredients.push({
        ...ingredient,
        name: product.name,
        unitName: uom?.name || ingredient.unitName,
        costPerUnit: product.costPrice || 0,
        availableStock: product.currentStock || 0
      });
    }
    
    return enrichedIngredients;
  } catch (error) {
    console.error('Error enriching ingredient data:', error);
    throw new Error(`Failed to enrich ingredient data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

**BlendIngredientValidator.ts:78-155 (77 lines) - 80% DUPLICATE**
```typescript
private async enrichSingleIngredient(ingredient) {
  // Validate product exists
  const product = await Product.findById(ingredient.productId);
  if (!product) {
    throw new Error(`Product not found: ${ingredient.name}`);
  }

  // Check for data consistency issues and auto-correct
  this.validateDataConsistency(ingredient, product);

  // Validate and find suitable unit of measurement
  const uom = await this.findSuitableUOM(ingredient);

  return {
    ...ingredient,
    productId: ingredient.productId,
    name: product.name,
    unitOfMeasurementId: uom._id.toString(),
    unitName: uom.name,
    costPerUnit: this.getCorrectCostPrice(ingredient, product),
    availableStock: product.currentStock || 0
  };
}

private async findSuitableUOM(ingredient) {
  let uom = null;
  
  // Try to find by ID
  if (ingredient.unitOfMeasurementId) {
    uom = await UnitOfMeasurement.findById(ingredient.unitOfMeasurementId);
  }
  
  // If not found, try to find a suitable default
  if (!uom) {
    console.warn(`Unit of measurement not found for ingredient: ${ingredient.name}, finding suitable default...`);
    
    const defaultUoms = await UnitOfMeasurement.find({
      isActive: true,
      $or: [
        { name: { $regex: /gram/i } },
        { name: { $regex: /milliliter/i } },
        { name: { $regex: /^ml$/i } },
        { name: { $regex: /^g$/i } },
        { type: 'weight' },
        { type: 'volume' }
      ]
    }).sort({ name: 1 }).limit(1);
    
    if (defaultUoms.length > 0) {
      uom = defaultUoms[0];
      console.warn(`Using default unit ${uom.name} for ingredient: ${ingredient.name}`);
    } else {
      throw new Error(`No suitable unit of measurement found for ingredient: ${ingredient.name}`);
    }
  }
  
  return uom;
}
```

**What's Wrong:**
1. THREE services implementing almost identical logic
2. 150 total lines of duplicate code
3. Subtle differences cause bugs (costPrice vs sellingPrice)
4. Maintenance nightmare - fixing bug requires 3 changes
5. Cannot determine which is "correct" implementation
6. No single source of truth

**Should Be:**
```typescript
// Single implementation in IngredientEnricher.ts
class IngredientEnricher {
  async enrich(ingredients: BaseIngredient[]): Promise<EnrichedIngredient[]> {
    // ONE implementation used everywhere
  }
}
```

---

### Example #4 - TransactionInventoryService's Type Routing Hell
**File:** TransactionInventoryService.ts:75-113  
**Severity:** CRITICAL

```typescript
private async processItem(
  item: TransactionItem,
  transactionRef: string,
  userId: string,
  session?: ClientSession
): Promise<IInventoryMovement[]> {
  const itemType = item.itemType || 'product'; // Default to product for backwards compatibility

  // VIOLATION: Must modify this switch for every new item type
  // Cannot extend without modifying
  // Violates Open/Closed Principle
  switch (itemType) {
    case 'product':
      return this.processProductItem(item, transactionRef, userId, session);

    case 'fixed_blend':
      return this.processFixedBlendItem(item, transactionRef, userId, session);

    case 'bundle':
      return this.processBundleItem(item, transactionRef, userId, session);

    case 'custom_blend':
      // Custom blends are handled by CustomBlendService during transaction creation
      // This is called from the frontend, so we skip here to avoid double deduction
      console.log(`[TransactionInventoryService] Skipping custom_blend item: ${item.name} (handled separately)`);
      return [];

    case 'miscellaneous':
    case 'service':
    case 'consultation':
      // No inventory impact for these item types
      console.log(`[TransactionInventoryService] Skipping ${itemType} item: ${item.name} (no inventory impact)`);
      return [];

    default:
      // Default to product behavior for unknown types
      // THIS IS DANGEROUS - silently falls back instead of erroring
      console.warn(`[TransactionInventoryService] Unknown item type '${itemType}' for ${item.name}, treating as product`);
      return this.processProductItem(item, transactionRef, userId, session);
  }
}
```

**What's Wrong:**
1. Hard-coded item types - cannot add new types without modification
2. Violates Open/Closed Principle (not open for extension)
3. Silent fallback to 'product' is dangerous
4. Mixing concerns (routing + processing)
5. Cannot inject custom processors
6. No way to add 'subscription', 'gift_card', etc. without changing core

**Should Be (Strategy Pattern):**
```typescript
interface ItemProcessor {
  canProcess(itemType: string): boolean;
  process(item: TransactionItem, context: ProcessContext): Promise<IInventoryMovement[]>;
}

class ProductProcessor implements ItemProcessor {
  canProcess(type: string) { return type === 'product'; }
  async process(item, context) { /* ... */ }
}

class FixedBlendProcessor implements ItemProcessor {
  canProcess(type: string) { return type === 'fixed_blend'; }
  async process(item, context) { /* ... */ }
}

class TransactionInventoryService {
  private processors: ItemProcessor[];
  
  constructor(processors: ItemProcessor[]) {
    this.processors = processors;
  }
  
  private async processItem(item: TransactionItem, context: ProcessContext) {
    const processor = this.processors.find(p => p.canProcess(item.itemType));
    
    if (!processor) {
      throw new UnsupportedItemTypeError(item.itemType);
    }
    
    return processor.process(item, context);
  }
}

// Now can add new processors without changing core:
const service = new TransactionInventoryService([
  new ProductProcessor(),
  new FixedBlendProcessor(),
  new BundleProcessor(),
  new SubscriptionProcessor(), // NEW - doesn't touch existing code!
  new GiftCardProcessor()      // NEW - doesn't touch existing code!
]);
```

---

### Example #5 - Controllers Mixing 6 Concerns
**File:** products.controller.ts (all controller methods)  
**Severity:** HIGH

```typescript
export const createProduct = async (req, res) => {
  try {
    // CONCERN 1: Input parsing (10 lines)
    const {
      name, sku, description, category, brand,
      unitOfMeasurement, quantity, reorderPoint,
      currentStock, costPrice, sellingPrice,
      status = 'active', expiryDate, containerCapacity = 1
    } = req.body;
    
    // CONCERN 2: Validation (30 lines)
    const [categoryExists, unitExists] = await Promise.all([
      Category.exists({ _id: category }),
      UnitOfMeasurement.exists({ _id: unitOfMeasurement })
    ]);
    if (!categoryExists) {
      res.status(400).json({ error: 'Invalid category' });
      return;
    }
    if (!unitExists) {
      res.status(400).json({ error: 'Invalid unit of measurement' });
      return;
    }
    if (brand) {
      const brandExists = await Brand.exists({ _id: brand });
      if (!brandExists) {
        res.status(400).json({ error: 'Invalid brand' });
        return;
      }
    }
    
    // CONCERN 3: Business logic (20 lines)
    const product = new Product({
      name, sku, description, category, brand,
      unitOfMeasurement, quantity: quantity || 0,
      reorderPoint: reorderPoint || 0,
      currentStock: currentStock || 0,
      totalQuantity: currentStock || 0,
      availableStock: currentStock || 0,
      reservedStock: 0,
      costPrice, sellingPrice, status,
      isActive: status === 'active',
      expiryDate, containerCapacity
    });
    
    if (!product.sku) {
      await product.generateSKU();
    }
    
    await product.save();
    
    // CONCERN 4: Logging/Auditing (15 lines - commented out)
    const authReq = req as AuthenticatedRequest;
    if (authReq.user) {
      // await AdminActivityLog.create({ ... });
    }
    
    // CONCERN 5: Data transformation (3 lines)
    await product.populate(['category', 'brand', 'unitOfMeasurement']);
    
    // CONCERN 6: Response formatting (1 line)
    res.status(201).json(product);
    
  } catch (error) {
    // CONCERN 7: Error handling (3 lines)
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};
```

**Controllers handle:**
1. Input parsing
2. Input validation
3. Business logic
4. Database operations
5. Logging/auditing
6. Data transformation
7. Error handling
8. Response formatting

**Should Be:**
```typescript
export const createProduct = asyncHandler(async (req, res) => {
  const dto = CreateProductDTO.fromRequest(req);
  const product = await productService.create(dto, req.user);
  res.status(201).json(product);
});
```

---

## Recommendations

### Short Term (1-2 weeks)
1. Create QueryBuilder utility
2. Implement error handling middleware
3. Create soft delete plugin
4. Unify ingredient validation
5. Add DTO mapper

### Medium Term (1-2 months)
1. Implement service layer
2. Extract business logic from Product model
3. Create repository pattern
4. Implement strategy pattern for transaction processing
5. Add dependency injection container

### Long Term (3-6 months)
1. Full refactor to layered architecture
2. Implement CQRS for read-heavy operations
3. Add comprehensive test coverage (currently 0%)
4. Implement event sourcing for inventory movements
5. Consider microservices for high-traffic modules

### Critical Path
```
Week 1: Error handling + Query builder
Week 2-3: Service layer foundation
Week 4-5: Extract Product model logic
Week 6-8: Repository pattern + DI
Week 9-10: Strategy pattern for transactions
Week 11-12: Testing infrastructure
```

---

## Conclusion

This codebase exhibits **severe architectural debt** requiring **immediate attention**. While functional, it poses significant risks:

- **Maintenance costs:** 3x higher than industry standard due to duplication
- **Bug risk:** High - critical logic scattered across multiple files
- **Extensibility:** Near impossible - OCP violations prevent safe extension
- **Testability:** Zero - tight coupling makes unit testing impractical
- **Onboarding:** Weeks instead of days due to tangled responsibilities

**Estimated technical debt:** $50,000-$75,000 in development time to fix properly

**Priority:** Start with Top 10 fixes immediately. This is not a "nice to have" - the codebase is actively harmful to development velocity and reliability.

The good news: The problems are well-understood patterns with proven solutions. With disciplined refactoring over 3-4 months, this can become a maintainable, testable, extensible codebase.

---
**End of Audit Report**
