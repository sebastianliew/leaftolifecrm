const mongoose = require('mongoose');
const { Patient } = require('./model-loader');

/**
 * Multi-factor patient matching algorithm
 * Handles various data quality issues including invalid emails
 */
class PatientMatcher {
  constructor() {
    this.stats = {
      matchedByLegacyId: 0,
      matchedByEmail: 0,
      matchedByNameDob: 0,
      matchedByNric: 0,
      notMatched: 0,
      totalAttempts: 0
    };
  }

  /**
   * Find a patient using multiple matching strategies
   * @param {Object} csvPatient - Patient data from CSV
   * @returns {Object|null} - Matched patient and match type or null
   */
  async findPatient(csvPatient) {
    this.stats.totalAttempts++;

    // Priority 1: Match by legacyCustomerNo (most reliable)
    if (csvPatient.customerNo) {
      try {
        const patient = await Patient.findOne({ 
          legacyCustomerNo: csvPatient.customerNo 
        }).lean();
        
        if (patient) {
          this.stats.matchedByLegacyId++;
          return { 
            patient, 
            matchType: 'legacy_id',
            confidence: 100
          };
        }
      } catch (error) {
        console.error(`Error matching by legacy ID ${csvPatient.customerNo}:`, error.message);
      }
    }

    // Priority 2: Match by valid email (exclude placeholder emails)
    if (csvPatient.email && !this.isPlaceholderEmail(csvPatient.email)) {
      try {
        const patient = await Patient.findOne({ 
          email: csvPatient.email.toLowerCase().trim() 
        }).lean();
        
        if (patient) {
          this.stats.matchedByEmail++;
          return { 
            patient, 
            matchType: 'email',
            confidence: 95
          };
        }
      } catch (error) {
        console.error(`Error matching by email ${csvPatient.email}:`, error.message);
      }
    }

    // Priority 3: Match by name + DOB combination
    if (csvPatient.first_name && csvPatient.last_name && csvPatient.birthdate) {
      try {
        const patient = await Patient.findOne({
          firstName: new RegExp(`^${this.escapeRegex(csvPatient.first_name)}$`, 'i'),
          lastName: new RegExp(`^${this.escapeRegex(csvPatient.last_name)}$`, 'i'),
          dateOfBirth: new Date(csvPatient.birthdate)
        }).lean();
        
        if (patient) {
          this.stats.matchedByNameDob++;
          return { 
            patient, 
            matchType: 'name_dob',
            confidence: 85
          };
        }
      } catch (error) {
        console.error(`Error matching by name+DOB:`, error.message);
      }
    }

    // Priority 4: Match by NRIC (if available and not placeholder)
    if (csvPatient.nric && !this.isPlaceholderNric(csvPatient.nric)) {
      try {
        const patient = await Patient.findOne({ 
          nric: csvPatient.nric 
        }).lean();
        
        if (patient) {
          this.stats.matchedByNric++;
          return { 
            patient, 
            matchType: 'nric',
            confidence: 90
          };
        }
      } catch (error) {
        console.error(`Error matching by NRIC ${csvPatient.nric}:`, error.message);
      }
    }

    // No match found
    this.stats.notMatched++;
    return null;
  }

  /**
   * Check if email is a placeholder
   */
  isPlaceholderEmail(email) {
    return email && (
      email.includes('noemail+') ||
      email.includes('@example.com') ||
      email.includes('@test.com') ||
      email === 'N/A' ||
      email === 'n/a'
    );
  }

  /**
   * Check if NRIC is a placeholder
   */
  isPlaceholderNric(nric) {
    return nric && (
      nric === 'N/A' ||
      nric === 'n/a' ||
      nric === '0000000000' ||
      nric.length < 5
    );
  }

  /**
   * Escape special regex characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Generate a valid email for patients with invalid emails
   */
  generateValidEmail(csvPatient) {
    const firstName = (csvPatient.first_name || 'unknown').toLowerCase().replace(/[^a-z]/g, '');
    const lastName = (csvPatient.last_name || 'user').toLowerCase().replace(/[^a-z]/g, '');
    const customerId = csvPatient.customerNo || `ID${csvPatient.id}`;
    
    return `${firstName}.${lastName}.${customerId}@migrated.leaftolife.com`;
  }

  /**
   * Get matching statistics
   */
  getStats() {
    return {
      ...this.stats,
      matchRate: this.stats.totalAttempts > 0 
        ? ((this.stats.totalAttempts - this.stats.notMatched) / this.stats.totalAttempts * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      matchedByLegacyId: 0,
      matchedByEmail: 0,
      matchedByNameDob: 0,
      matchedByNric: 0,
      notMatched: 0,
      totalAttempts: 0
    };
  }
}

module.exports = PatientMatcher;