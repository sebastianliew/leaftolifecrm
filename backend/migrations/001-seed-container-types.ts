/**
 * Migration: Seed container types from existing categories
 *
 * This script copies existing categories (which are actually container types like
 * "Bottle", "Box", etc.) into the new `containertypes` collection, preserving
 * their `allowedUomTypes`. It then sets `containerType` on existing products
 * based on their current `category` value.
 *
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   npx tsx backend/migrations/001-seed-container-types.ts
 *
 * Requires MONGODB_URI in environment or backend/.env.local
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Check backend/.env.local');
  process.exit(1);
}

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);
  const db = mongoose.connection.db!;

  const categoriesCol = db.collection('categories');
  const containerTypesCol = db.collection('containertypes');
  const productsCol = db.collection('products');

  // Step 1: Copy categories → containertypes (skip if already seeded)
  const categories = await categoriesCol.find({}).toArray();
  console.log(`Found ${categories.length} categories to migrate`);

  let created = 0;
  let skipped = 0;

  for (const cat of categories) {
    const existing = await containerTypesCol.findOne({ name: cat.name });
    if (existing) {
      skipped++;
      continue;
    }

    await containerTypesCol.insertOne({
      _id: new mongoose.Types.ObjectId(),
      name: cat.name,
      description: cat.description || '',
      allowedUomTypes: cat.allowedUomTypes && cat.allowedUomTypes.length > 0
        ? cat.allowedUomTypes
        : inferUomTypes(cat.name),
      isActive: cat.isActive !== false,
      createdAt: cat.createdAt || new Date(),
      updatedAt: new Date(),
    });
    created++;
  }

  console.log(`Container types: ${created} created, ${skipped} already existed`);

  // Step 2: Set containerType on products based on their category
  const containerTypes = await containerTypesCol.find({}).toArray();
  const nameToCtId = new Map(containerTypes.map(ct => [ct.name, ct._id]));

  let updated = 0;
  let noMatch = 0;

  // Find products that don't have containerType set yet
  const products = await productsCol.find({ containerType: { $exists: false } }).toArray();
  console.log(`Found ${products.length} products without containerType`);

  for (const product of products) {
    if (!product.category) continue;

    // Look up the category to get its name
    const cat = await categoriesCol.findOne({ _id: product.category });
    if (!cat) {
      noMatch++;
      continue;
    }

    const ctId = nameToCtId.get(cat.name);
    if (!ctId) {
      noMatch++;
      continue;
    }

    await productsCol.updateOne(
      { _id: product._id },
      { $set: { containerType: ctId } }
    );
    updated++;
  }

  console.log(`Products: ${updated} updated, ${noMatch} had no matching container type`);
  console.log('Migration complete!');

  await mongoose.disconnect();
}

/**
 * Infer sensible UOM types from the container name if allowedUomTypes was empty.
 */
function inferUomTypes(name: string): string[] {
  const lower = name.toLowerCase();

  if (['bottle', 'vial', 'dropper', 'spray', 'pump'].some(k => lower.includes(k))) {
    return ['volume'];
  }
  if (['box', 'blister', 'strip', 'pack', 'packet', 'sachet'].some(k => lower.includes(k))) {
    return ['count'];
  }
  if (['jar', 'tub', 'pot', 'tin'].some(k => lower.includes(k))) {
    return ['volume', 'weight'];
  }
  if (['tube', 'cream', 'ointment'].some(k => lower.includes(k))) {
    return ['weight', 'volume'];
  }
  if (['bag', 'pouch'].some(k => lower.includes(k))) {
    return ['weight', 'count'];
  }
  if (['roll', 'tape'].some(k => lower.includes(k))) {
    return ['length'];
  }

  // Default: allow count and weight (safe fallback)
  return ['count', 'weight'];
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
