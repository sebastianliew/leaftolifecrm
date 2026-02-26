/**
 * Auto-create referenced entities (Category, Brand, UnitOfMeasurement)
 * from name strings. Used during product creation/import.
 */
import { Category } from '../../models/Category.js';
import { Brand } from '../../models/Brand.js';
import { UnitOfMeasurement } from '../../models/UnitOfMeasurement.js';

interface ProductRefs {
  category?: unknown;
  brand?: unknown;
  unitOfMeasurement?: unknown;
  categoryName?: string;
  brandName?: string;
  unitName?: string;
}

function guessUnitType(name: string): string {
  const lower = name.toLowerCase();
  if (['g', 'gram', 'grams', 'kg', 'kilogram'].includes(lower)) return 'weight';
  if (['ml', 'milliliter', 'l', 'liter', 'drops'].includes(lower)) return 'volume';
  return 'count';
}

/**
 * Resolve name-based references to ObjectIds, creating entities as needed.
 * Mutates the product object in place and returns it.
 */
export async function populateReferences<T extends ProductRefs>(product: T): Promise<T> {
  if (product.categoryName && !product.category) {
    let cat = await Category.findOne({ name: product.categoryName });
    if (!cat) cat = await new Category({ name: product.categoryName, isActive: true }).save();
    product.category = cat._id;
  }

  if (product.brandName && !product.brand) {
    let brand = await Brand.findOne({ name: product.brandName });
    if (!brand) brand = await new Brand({ name: product.brandName, isActive: true }).save();
    product.brand = brand._id;
  }

  if (product.unitName && !product.unitOfMeasurement) {
    let unit = await UnitOfMeasurement.findOne({
      $or: [{ name: product.unitName }, { abbreviation: product.unitName }]
    });
    if (!unit) {
      unit = await new UnitOfMeasurement({
        name: product.unitName, abbreviation: product.unitName,
        type: guessUnitType(product.unitName), isActive: true
      }).save();
    }
    product.unitOfMeasurement = unit._id;
  }

  return product;
}
