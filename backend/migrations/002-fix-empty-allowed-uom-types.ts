/**
 * Migration: Fix container types with empty allowedUomTypes
 *
 * Applies smart inference to container types that have empty allowedUomTypes arrays.
 *
 * Usage:
 *   npx tsx backend/migrations/002-fix-empty-allowed-uom-types.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

function inferUomTypes(name: string): string[] {
  const lower = name.toLowerCase();

  if (['bottle', 'vial', 'dropper', 'spray', 'pump', 'liquid', 'tincture', 'hydrosol', 'oil'].some(k => lower.includes(k))) {
    return ['volume'];
  }
  if (['box', 'blister', 'strip', 'tablet', 'capsule', 'supplement', 'livton'].some(k => lower.includes(k))) {
    return ['count'];
  }
  if (['jar', 'tub', 'pot', 'tin', 'container'].some(k => lower.includes(k))) {
    return ['volume', 'weight'];
  }
  if (['tube', 'cream', 'ointment'].some(k => lower.includes(k))) {
    return ['weight', 'volume'];
  }
  if (['sachet', 'pack', 'bag', 'pouch'].some(k => lower.includes(k))) {
    return ['count', 'weight'];
  }
  if (['piece', 'book', 'crystal', 'mineral'].some(k => lower.includes(k))) {
    return ['count'];
  }
  if (['herb', 'powder', 'clay', 'food', 'tea'].some(k => lower.includes(k))) {
    return ['weight', 'count'];
  }
  if (['roll', 'tape'].some(k => lower.includes(k))) {
    return ['length'];
  }
  if (lower === 'g' || lower === 'ml') {
    // These look like unit names accidentally created as categories
    return lower === 'ml' ? ['volume'] : ['weight'];
  }

  // Default
  return ['count', 'weight'];
}

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);
  const db = mongoose.connection.db!;

  const containerTypesCol = db.collection('containertypes');

  // Find all container types with empty allowedUomTypes
  const empty = await containerTypesCol.find({
    $or: [
      { allowedUomTypes: { $size: 0 } },
      { allowedUomTypes: { $exists: false } }
    ]
  }).toArray();

  console.log(`Found ${empty.length} container types with empty allowedUomTypes`);

  let updated = 0;
  for (const ct of empty) {
    const inferred = inferUomTypes(ct.name);
    console.log(`  ${ct.name} → [${inferred.join(', ')}]`);
    await containerTypesCol.updateOne(
      { _id: ct._id },
      { $set: { allowedUomTypes: inferred, updatedAt: new Date() } }
    );
    updated++;
  }

  console.log(`Updated ${updated} container types`);
  await mongoose.disconnect();
}

migrate().catch(err => { console.error(err); process.exit(1); });
