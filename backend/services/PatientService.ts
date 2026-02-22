import { Patient } from '../models/Patient.js';
import type { PatientFormData, Patient as PatientType } from '../types/patient.js';
import {
  requireObjectId,
  safeSearchRegex,
  blankToNull,
  clampLimit,
  pickFields,
  toDotNotation,
  isPastOrToday
} from '../lib/validations/sanitize.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Fields that may be written via create / update (mass-assignment protection). */
const ALLOWED_FIELDS = new Set([
  'firstName', 'middleName', 'lastName', 'nric', 'dateOfBirth', 'gender',
  'bloodType', 'maritalStatus', 'occupation',
  'email', 'phone', 'altPhone', 'fax', 'address', 'city', 'state', 'postalCode', 'country',
  'status', 'hasConsent',
  'medicalHistory', 'consentHistory',
  'memberBenefits', 'marketingPreferences', 'enhancedMedicalData',
  'salutation', 'company'
]);

/** Nested subdocuments that use dot-notation for partial $set updates. */
const NESTED_KEYS = ['memberBenefits', 'marketingPreferences', 'financialSummary', 'enrichmentInfo'] as const;

/** Only these fields may appear in the `sortBy` query param. */
const SORTABLE_FIELDS = new Set(['createdAt', 'updatedAt', 'firstName', 'lastName', 'email', 'status']);

/** Select projection for list / selector views (omit heavy medical data). */
const LIST_PROJECTION = '-medicalHistory -enhancedMedicalData -consentHistory -migrationInfo';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitizePatientInput(data: Record<string, unknown>): Record<string, unknown> {
  const clean = pickFields(data, ALLOWED_FIELDS) as Record<string, unknown>;

  // Normalise email
  if (typeof clean.email === 'string') {
    clean.email = clean.email.trim().toLowerCase() || undefined;
  }

  // Normalise NRIC: blank → null (sparse unique index)
  if ('nric' in clean) {
    const nric = blankToNull(clean.nric as string);
    clean.nric = nric ? nric.toUpperCase() : null;
  }

  // Validate date of birth is not in the future
  if (clean.dateOfBirth) {
    const dob = new Date(clean.dateOfBirth as string);
    if (isNaN(dob.getTime()) || !isPastOrToday(dob)) {
      throw Object.assign(new Error('Date of birth cannot be in the future'), { statusCode: 400 });
    }
  }

  return clean;
}

async function assertNricUnique(nric: string | null, excludeId?: string): Promise<void> {
  if (!nric) return;
  const query: Record<string, unknown> = { nric };
  if (excludeId) query._id = { $ne: excludeId };
  const existing = await Patient.findOne(query).select('_id').lean();
  if (existing) {
    throw Object.assign(new Error('Patient with this NRIC already exists'), { statusCode: 409 });
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class PatientService {

  /** List patients with search, filters, and pagination. */
  async getAllPatients(
    searchTerm?: string,
    page = 1,
    limit = 25,
    sortBy = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
    statusFilter?: string,
    tierFilter?: string
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: Record<string, any>[] = [];

    if (searchTerm && searchTerm.trim().length >= 2) {
      const regex = safeSearchRegex(searchTerm);
      conditions.push({
        $or: [
          { firstName: regex }, { lastName: regex }, { email: regex },
          { phone: regex }, { nric: regex }, { legacyCustomerNo: regex }
        ]
      });
    }

    if (statusFilter && statusFilter !== 'all') conditions.push({ status: statusFilter });
    if (tierFilter && tierFilter !== 'all') conditions.push({ 'memberBenefits.membershipTier': tierFilter });

    const query = conditions.length > 0 ? { $and: conditions } : {};
    const safeSortBy = SORTABLE_FIELDS.has(sortBy) ? sortBy : 'createdAt';
    const safeLimit = clampLimit(limit);
    const skip = (page - 1) * safeLimit;

    const [totalCount, patients] = await Promise.all([
      Patient.countDocuments(query),
      Patient.find(query)
        .select(LIST_PROJECTION)
        .sort({ [safeSortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean()
    ]);

    const totalPages = Math.ceil(totalCount / safeLimit);
    return {
      patients,
      pagination: {
        currentPage: page, totalPages, totalCount, limit: safeLimit,
        hasNextPage: page < totalPages, hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null
      }
    };
  }

  /** Get full patient document by ID (including medical data). */
  async getPatientById(id: string) {
    requireObjectId(id, 'patient ID');
    const patient = await Patient.findById(id).lean();
    if (!patient) throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
    return patient;
  }

  /** Lightweight fetch for selectors — only fields needed for transactions. */
  async getPatientSummary(id: string) {
    requireObjectId(id, 'patient ID');
    const patient = await Patient.findById(id)
      .select('firstName lastName email phone status memberBenefits legacyCustomerNo')
      .lean();
    if (!patient) throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
    return patient;
  }

  /** Create new patient. */
  async createPatient(patientData: PatientFormData) {
    const clean = sanitizePatientInput(patientData as unknown as Record<string, unknown>);
    await assertNricUnique(clean.nric as string | null);

    const patient = new Patient(clean);
    const saved = await patient.save();
    return saved.toJSON();
  }

  /** Partial update of patient. Nested objects use dot notation. */
  async updatePatient(id: string, updateData: Partial<PatientFormData>) {
    requireObjectId(id, 'patient ID');
    const clean = sanitizePatientInput(updateData as unknown as Record<string, unknown>);

    // NRIC uniqueness only if value is actually changing
    if (clean.nric !== undefined) {
      const current = await Patient.findById(id).select('nric').lean() as PatientType | null;
      if (!current) throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
      const currentNric = current.nric?.trim().toUpperCase() || null;
      if (clean.nric !== currentNric) {
        await assertNricUnique(clean.nric as string | null, id);
      }
    }

    const flatUpdate = toDotNotation(clean, [...NESTED_KEYS]);
    const patient = await Patient.findByIdAndUpdate(id, { $set: flatUpdate }, { new: true, runValidators: false }).lean();
    if (!patient) throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
    return patient;
  }

  /** Soft-delete (deactivate). Preserves transaction references. */
  async deletePatient(id: string) {
    requireObjectId(id, 'patient ID');
    const patient = await Patient.findById(id);
    if (!patient) throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
    patient.status = 'inactive';
    await patient.save();
    return { message: 'Patient deactivated successfully' };
  }

  /** Bulk soft-delete. */
  async bulkDeletePatients(patientIds: string[]) {
    if (!Array.isArray(patientIds) || patientIds.length === 0) {
      throw Object.assign(new Error('Patient IDs array is required'), { statusCode: 400 });
    }
    patientIds.forEach(id => requireObjectId(id, 'patient ID'));

    const result = await Patient.updateMany({ _id: { $in: patientIds } }, { $set: { status: 'inactive' } });
    return { message: `${result.modifiedCount} patients deactivated successfully`, deletedCount: result.modifiedCount };
  }

  /** Recent patients (lightweight). */
  async getRecentPatients(limit = 10) {
    return Patient.find().select(LIST_PROJECTION).sort({ updatedAt: -1 }).limit(clampLimit(limit)).lean();
  }

  /** Aggregate stats for dashboard. */
  async getPatientStats() {
    const [totalPatients, activePatients, inactivePatients, withConsent, recentRegistrations] = await Promise.all([
      Patient.countDocuments(),
      Patient.countDocuments({ status: 'active' }),
      Patient.countDocuments({ status: 'inactive' }),
      Patient.countDocuments({ hasConsent: true }),
      Patient.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
    ]);
    return { totalPatients, activePatients, inactivePatients, withConsent, recentRegistrations };
  }
}
