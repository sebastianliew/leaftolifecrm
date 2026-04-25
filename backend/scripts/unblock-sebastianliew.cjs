/**
 * Unblock user "sebastianliew" on l2l_prod.
 *
 * Usage (from backend/):
 *   npm run build
 *   MONGODB_URI="mongodb+srv://..." node scripts/unblock-sebastianliew.cjs
 *
 * This targets the l2l_prod database regardless of the db name embedded
 * in MONGODB_URI (uses the dbName connection option).
 */
const mongoose = require('mongoose');
const path = require('path');

// Load env from backend/.env or backend/.env.local if MONGODB_URI not already set.
if (!process.env.MONGODB_URI) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
  } catch (_) {}
  if (!process.env.MONGODB_URI) {
    try {
      require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    } catch (_) {}
  }
}

const { User } = require('../dist/models/User.js');

const TARGET_DB = 'l2l_prod';
const MATCH = /sebastianliew/i;

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Export it or place it in backend/.env.');
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: TARGET_DB });
  console.log(`Connected to database: ${TARGET_DB}`);

  const user = await User.findOne({
    $or: [{ username: MATCH }, { email: MATCH }, { name: MATCH }],
  });

  if (!user) {
    console.log('No user matching "sebastianliew" found.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('Current state:');
  console.log('  _id:      ', user._id.toString());
  console.log('  username: ', user.username);
  console.log('  email:    ', user.email);
  console.log('  role:     ', user.role);
  console.log('  isActive: ', user.isActive);
  console.log('  failedLoginAttempts:', user.failedLoginAttempts || 0);
  console.log('  lastFailedLogin:    ', user.lastFailedLogin || 'never');

  if (user.isActive && (user.failedLoginAttempts || 0) === 0) {
    console.log('\nUser is already active with 0 failed attempts — nothing to do.');
    await mongoose.disconnect();
    return;
  }

  const result = await User.updateOne(
    { _id: user._id },
    {
      $set: { isActive: true, failedLoginAttempts: 0 },
      $unset: { lastFailedLogin: 1 },
    }
  );

  console.log(`\nUpdated ${result.modifiedCount} record(s).`);
  console.log('User can now log in again.');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Error:', err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
