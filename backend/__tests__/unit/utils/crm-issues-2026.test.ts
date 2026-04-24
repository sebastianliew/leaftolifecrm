/**
 * Stress test for the CRM-ISSUES-2026 implementation pass (2026-04-24).
 *
 * These are source-level / static assertions that guard the intent of each
 * fix. They're cheap to run and catch regressions if someone later reverts
 * one of the small-but-important pieces.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Tests run from the backend/ directory (jest rootDir).
const root = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf-8');
}

describe('CRM Issues 2026 — regression guards', () => {
  // ─── Issue #14: invoice branding ─────────────────────────────────────
  describe('#14 invoice branding says "Leaf to Life Pte Ltd"', () => {
    it('backend PDF generator no longer names Sebastian Liew Centre on the header subline', () => {
      const src = read('services/invoiceGenerator.ts');
      // The "by …" line under the Leaf to Life ® wordmark.
      expect(src).not.toMatch(/'by Sebastian Liew Centre Pte Ltd'/);
      expect(src).toContain("'by Leaf to Life Pte Ltd'");
    });
  });

  // ─── Issue #15: DOB optional on patient schema ───────────────────────
  describe('#15 Patient.dateOfBirth is optional', () => {
    it('schema does not mark dateOfBirth as required', () => {
      const src = read('models/Patient.ts');
      // Look for the dateOfBirth schema line and confirm no `required: true`
      // on the same line. (The `dateOfBirth: { type: Date }` form is what
      // we expect; the old `required: true` would stop create/update.)
      const match = src.match(/dateOfBirth:\s*\{[^}]*\}/);
      expect(match).toBeTruthy();
      expect(match?.[0]).not.toMatch(/required:\s*true/);
    });
  });

  // ─── Issue #17: CORS allowlist covers both .com and .com.sg ───────────
  describe('#17 CORS allowlist covers .com and .com.sg during transition', () => {
    it('server.ts includes both domain variants', () => {
      const src = read('server.ts');
      expect(src).toContain("'https://leaftolife.com.sg'");
      expect(src).toContain("'https://leaftolife.com'");
      expect(src).toContain("'https://crm.leaftolife.com'");
    });
  });

  // ─── Issue #20 & #21: Category defaultUom + defaultCanSellLoose ──────
  describe('#20/#21 Category has defaultUom + defaultCanSellLoose', () => {
    it('Category schema declares both fields', () => {
      const src = read('models/Category.ts');
      expect(src).toContain('defaultUom');
      expect(src).toContain('defaultCanSellLoose');
      expect(src).toMatch(/defaultUom\?:\s*Schema\.Types\.ObjectId/);
    });

    it('categories.controller persists both fields on create', () => {
      const src = read('controllers/categories.controller.ts');
      expect(src).toContain('defaultUom');
      expect(src).toContain('defaultCanSellLoose');
    });
  });

  // ─── Issue #21 migration script regex coverage ───────────────────────
  describe('#21 loose-friendly category regex matches expected dosage forms', () => {
    const LOOSE_FRIENDLY_PATTERNS = [
      /tablet/i,
      /capsule/i,
      /caplet/i,
      /softgel/i,
      /liquid/i,
      /syrup/i,
      /drops?/i,
      /solution/i,
      /tincture/i,
      /oil/i,
    ];

    const matches = (name: string) =>
      LOOSE_FRIENDLY_PATTERNS.some((re) => re.test(name));

    it.each([
      ['Tablets', true],
      ['Capsules', true],
      ['Capsule (500mg)', true],
      ['Liquid Extracts', true],
      ['Syrup', true],
      ['Drop', true],
      ['Eye Drops', true],
      ['Essential Oils', true],
      ['Softgels', true],
      ['Tincture 50ml', true],
      ['Powder', false],
      ['Topical Cream', false],
      ['Herbal Tea', false],
      ['Consultation', false],
    ])('"%s" → canSellLoose default = %s', (name, expected) => {
      expect(matches(name)).toBe(expected);
    });
  });

  // ─── Issue #23: customerId filter on getTransactions ─────────────────
  describe('#23 getTransactions honours customerId filter', () => {
    it('transactions.controller.ts reads customerId from req.query', () => {
      const src = read('controllers/transactions.controller.ts');
      // The destructure should include customerId …
      expect(src).toMatch(/customerId\s*\}\s*=\s*req\.query/s);
      // … and the filter should be applied when set.
      expect(src).toMatch(/filter\.customerId\s*=\s*customerId/);
    });
  });

  // ─── Issue #26: soft-delete flag + default exclusion ─────────────────
  describe('#26 Transaction soft-delete', () => {
    it('Transaction schema declares isDeleted / deletedAt / deletedBy / deleteReason', () => {
      const src = read('models/Transaction.ts');
      expect(src).toContain('isDeleted');
      expect(src).toContain('deletedAt');
      expect(src).toContain('deletedBy');
      expect(src).toContain('deleteReason');
    });

    it('getTransactions defaults to excluding soft-deleted rows', () => {
      const src = read('controllers/transactions.controller.ts');
      expect(src).toMatch(/filter\.isDeleted\s*=\s*\{\s*\$ne:\s*true\s*\}/);
      expect(src).toContain("req.query.includeDeleted !== 'true'");
    });

    it('delete endpoint soft-deletes non-draft transactions', () => {
      const src = read('controllers/transactions.controller.ts');
      // Still blocks completed/refunded outright
      expect(src).toMatch(/Cannot delete a completed or refunded transaction/);
      // Drafts still hard-delete
      expect(src).toMatch(/transaction\.status === 'draft'/);
      expect(src).toContain('findByIdAndDelete');
      // Everything else gets archived
      expect(src).toMatch(/Transaction\.findByIdAndUpdate\(\s*id,\s*\{[^}]*isDeleted:\s*true/s);
      expect(src).toContain('Transaction archived');
    });
  });
});
