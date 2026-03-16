import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback to .env

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error("MONGODB_URI not set"); process.exit(1); }

  await mongoose.connect(uri);
  const products = mongoose.connection.db!.collection("products");

  console.log("Running pool defaults migration...");

  const r1 = await products.updateMany(
    { $or: [{ containerCapacity: { $lte: 0 } }, { containerCapacity: { $exists: false } }] },
    { $set: { containerCapacity: 1 } }
  );
  console.log(`Fixed containerCapacity: ${r1.modifiedCount}`);

  const r2 = await products.updateMany(
    { canSellLoose: { $in: [null, undefined] } },
    { $set: { canSellLoose: false } }
  );
  console.log(`Fixed canSellLoose: ${r2.modifiedCount}`);

  const r3 = await products.updateMany(
    { looseStock: { $exists: false } },
    { $set: { looseStock: 0 } }
  );
  console.log(`Set looseStock defaults: ${r3.modifiedCount}`);

  await mongoose.disconnect();
  console.log("Done.");
}

migrate().catch(console.error);
