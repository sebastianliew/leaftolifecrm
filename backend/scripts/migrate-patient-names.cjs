/**
 * Patient Name Migration Script
 *
 * Fixes patients migrated from legacy system where:
 * - Full name was stored in firstName, lastName set to "Unknown"
 * - Phone defaulted to "00000000"
 *
 * Usage:
 *   DRY RUN (outputs CSV):  node --env-file=.env.local scripts/migrate-patient-names.js
 *   APPLY CHANGES:          node --env-file=.env.local scripts/migrate-patient-names.js --apply
 */

const mongoose = require('mongoose');

// ── Name parsing helpers ──

// Multi-word surname prefixes (case-insensitive matching)
const SURNAME_PREFIXES = new Set([
  'bin', 'binte', 'bte', 'bt',          // Malay
  'van', 'von', 'de', 'del', 'della',   // European
  'al', 'el',                            // Arabic
  'dos', 'das', 'di', 'du',             // Portuguese/Italian/French
  'le', 'la',                            // French
  'ap', 'ab',                            // Welsh/Malay
  's/o', 'd/o',                          // Indian (son of / daughter of)
]);

/**
 * Parse a full name string into { firstName, lastName }.
 *
 * Strategies:
 * 1. Comma-separated: "Surname, GivenName" → firstName=GivenName, lastName=Surname
 * 2. Parenthetical notes: "(OLD) Name..." or "Name (notes)" → strip parens, parse remainder
 * 3. Multi-word surname prefix: "Ahmad Bin Karbi" → firstName=Ahmad, lastName=Bin Karbi
 * 4. Default: last word = lastName, rest = firstName
 */
function parseName(fullName) {
  let name = fullName.trim();

  // Extract and preserve parenthetical notes (e.g. "(OLD)", "(Marta Husband)")
  let note = '';
  const parenMatch = name.match(/\(([^)]+)\)/);
  if (parenMatch) {
    note = parenMatch[0]; // e.g. "(OLD)"
    name = name.replace(/\([^)]+\)/g, '').trim();
  }

  // Remove extra whitespace
  name = name.replace(/\s+/g, ' ').trim();

  if (!name) {
    return { firstName: fullName.trim(), lastName: '', note };
  }

  // Strategy 1: Comma-separated → "Surname, GivenName"
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    const lastName = parts[0];
    const firstName = parts.slice(1).join(' ').trim();
    if (firstName && lastName) {
      return { firstName, lastName, note };
    }
  }

  // Strategy 2 & 3: Word-based splitting
  const words = name.split(' ');

  if (words.length === 1) {
    // Single name — put it in firstName, leave lastName empty
    return { firstName: words[0], lastName: '', note };
  }

  // Check for surname prefix starting from the second-to-last word backwards
  for (let i = words.length - 2; i >= 1; i--) {
    const candidate = words[i].toLowerCase().replace(/[.,]/g, '');
    if (SURNAME_PREFIXES.has(candidate)) {
      const firstName = words.slice(0, i).join(' ');
      const lastName = words.slice(i).join(' ');
      if (firstName) {
        return { firstName, lastName, note };
      }
    }
  }

  // Strategy 4: Default — last word is lastName
  const lastName = words[words.length - 1];
  const firstName = words.slice(0, -1).join(' ');

  return { firstName, lastName, note };
}

/**
 * Build a clean customerName from parsed parts
 */
function buildCustomerName(firstName, lastName, note) {
  let name = [firstName, lastName].filter(Boolean).join(' ');
  if (note) {
    name = `${note} ${name}`;
  }
  return name;
}

// ── Main migration ──

async function main() {
  const applyMode = process.argv.includes('--apply');

  console.log(`\n=== Patient Name Migration ${applyMode ? '(APPLY MODE)' : '(DRY RUN)'} ===\n`);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const db = mongoose.connection.db;
  const patients = db.collection('patients');
  const transactions = db.collection('transactions');

  // ── Step 1: Find affected patients ──
  const affectedPatients = await patients.find({
    lastName: { $regex: /^unknown$/i }
  }).toArray();

  console.log(`Found ${affectedPatients.length} patients with lastName="Unknown"\n`);

  // ── Step 2: Parse names and build update plan ──
  const updates = [];
  const singleNamePatients = [];

  for (const patient of affectedPatients) {
    const { firstName, lastName, note } = parseName(patient.firstName);
    const newCustomerName = buildCustomerName(firstName, lastName, note);

    if (!lastName) {
      singleNamePatients.push({
        _id: patient._id,
        original: patient.firstName,
        parsed: firstName,
        note,
      });
    }

    updates.push({
      _id: patient._id,
      legacyCustomerNo: patient.legacyCustomerNo || '',
      originalFirstName: patient.firstName,
      originalLastName: patient.lastName,
      newFirstName: firstName,
      newLastName: lastName || patient.lastName, // Keep "Unknown" if we can't determine
      newCustomerName,
      note,
      phone: patient.phone,
      isPlaceholderPhone: patient.phone === '00000000',
    });
  }

  // ── Step 3: Output results ──

  // Summary stats
  const resolved = updates.filter(u => u.newLastName !== 'Unknown' && u.newLastName !== '');
  const unresolved = updates.filter(u => u.newLastName === 'Unknown' || u.newLastName === '');
  const placeholderPhones = updates.filter(u => u.isPlaceholderPhone);

  console.log('=== SUMMARY ===');
  console.log(`Total affected:        ${updates.length}`);
  console.log(`Names resolved:        ${resolved.length}`);
  console.log(`Names unresolved:      ${unresolved.length} (single-word names, kept "Unknown")`);
  console.log(`Placeholder phones:    ${placeholderPhones.length}`);
  console.log('');

  // Show samples
  console.log('=== SAMPLE RESOLVED NAMES (first 20) ===');
  console.log('ORIGINAL → FIRST | LAST');
  resolved.slice(0, 20).forEach(u => {
    console.log(`  "${u.originalFirstName}" → "${u.newFirstName}" | "${u.newLastName}"`);
  });
  console.log('');

  if (singleNamePatients.length > 0) {
    console.log(`=== UNRESOLVED SINGLE NAMES (${singleNamePatients.length}) ===`);
    singleNamePatients.slice(0, 10).forEach(p => {
      console.log(`  "${p.original}" — kept lastName as "Unknown"`);
    });
    console.log('');
  }

  // CSV output for review
  if (!applyMode) {
    const csv = ['legacyCustomerNo,originalFirstName,originalLastName,newFirstName,newLastName,newCustomerName,placeholderPhone'];
    for (const u of updates) {
      const esc = (s) => `"${(s || '').replace(/"/g, '""')}"`;
      csv.push([
        esc(u.legacyCustomerNo),
        esc(u.originalFirstName),
        esc(u.originalLastName),
        esc(u.newFirstName),
        esc(u.newLastName),
        esc(u.newCustomerName),
        u.isPlaceholderPhone ? 'YES' : 'NO',
      ].join(','));
    }

    const fs = require('fs');
    const csvPath = require('path').join(__dirname, 'migration-name-review.csv');
    fs.writeFileSync(csvPath, csv.join('\n'), 'utf-8');
    console.log(`CSV written to: ${csvPath}`);
    console.log('Review the CSV, then run with --apply to execute.\n');

    await mongoose.disconnect();
    return;
  }

  // ── Step 4: Apply changes ──
  console.log('Applying changes...\n');

  let patientUpdated = 0;
  let transactionUpdated = 0;
  let dataQualityUpdated = 0;

  for (const u of updates) {
    // Update patient document
    const patientUpdate = {
      $set: {
        firstName: u.newFirstName,
        lastName: u.newLastName,
      }
    };

    // Flag placeholder phone records
    if (u.isPlaceholderPhone) {
      patientUpdate.$set['migrationInfo.dataQuality'] = 'minimal';
    } else if (u.newLastName !== 'Unknown') {
      patientUpdate.$set['migrationInfo.dataQuality'] = 'partial';
    }

    await patients.updateOne({ _id: u._id }, patientUpdate);
    patientUpdated++;

    // Update related transactions — replace old customerName containing "Unknown"
    const oldNamePattern = `${u.originalFirstName} Unknown`;
    const result = await transactions.updateMany(
      {
        $or: [
          { customerName: oldNamePattern },
          { customerName: `${u.note} ${u.originalFirstName} Unknown`.trim() },
        ]
      },
      { $set: { customerName: u.newCustomerName } }
    );
    transactionUpdated += result.modifiedCount;

    if (u.isPlaceholderPhone) dataQualityUpdated++;

    // Progress every 200
    if (patientUpdated % 200 === 0) {
      console.log(`  Progress: ${patientUpdated}/${updates.length} patients...`);
    }
  }

  console.log(`\n=== MIGRATION COMPLETE ===`);
  console.log(`Patients updated:      ${patientUpdated}`);
  console.log(`Transactions updated:  ${transactionUpdated}`);
  console.log(`Flagged minimal data:  ${dataQualityUpdated}`);
  console.log('');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB\n');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
