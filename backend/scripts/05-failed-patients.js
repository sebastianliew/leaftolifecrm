const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Patient = require('../../models/Patient');
const PatientMatcher = require('./utils/patient-matcher');
const DataValidator = require('./utils/data-validator');
const EnrichmentLogger = require('./utils/enrichment-logger');

/**
 * Failed Patients Recovery Script
 * Priority: LOW - Data completeness (669 patients failed initial migration)
 * 
 * This script:
 * 1. Processes 669 failed patients from base_usermembership.csv
 * 2. Generates valid emails: firstname.lastname.CUS123@migrated.leaftolife.com
 * 3. Creates minimal patient records
 * 4. Flags records for manual review
 * 5. Links available related data (addresses, transactions, etc.)
 */

class FailedPatientsRecovery {
  constructor(dryRun = false) {
    this.dryRun = dryRun;
    this.logger = new EnrichmentLogger('failed-patients');
    this.matcher = new PatientMatcher();
    this.validator = new DataValidator();
    
    this.csvPath = path.join(__dirname, '../../../../sql_to_csv_extraction');
    this.membershipFile = path.join(this.csvPath, 'base_usermembership.csv');
    this.addressFile = path.join(this.csvPath, 'base_memberaddress.csv');
    
    this.stats = {
      totalProcessed: 0,
      patientsCreated: 0,
      patientsSkipped: 0,
      emailsGenerated: 0,
      addressesLinked: 0,
      requireManualReview: []
    };
    
    // Cache for addresses
    this.addressCache = new Map();
  }

  async connect() {
    if (!mongoose.connection.readyState) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/l2l';
      await mongoose.connect(mongoUri);
      this.logger.writeLog('Connected to MongoDB');
    }
  }

  async loadAddresses() {
    this.logger.writeLog('Loading address data into cache...');
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(this.addressFile)
        .pipe(csv())
        .on('data', (row) => {
          this.addressCache.set(row.user_id, row);
        })
        .on('end', () => {
          this.logger.writeLog(`Loaded ${this.addressCache.size} address records`);
          resolve();
        })
        .on('error', reject);
    });
  }

  async processFailedPatients() {
    this.logger.writeLog('Starting failed patients recovery...');
    
    // Load addresses first
    await this.loadAddresses();
    
    return new Promise((resolve, reject) => {
      const failedPatients = [];
      
      fs.createReadStream(this.membershipFile)
        .pipe(csv())
        .on('data', (row) => {
          // Identify failed patients by invalid email patterns
          if (this.isFailedPatient(row)) {
            failedPatients.push(row);
          }
        })
        .on('end', async () => {
          this.logger.writeLog(`Found ${failedPatients.length} failed patient records to process...`);
          
          // Process in batches
          const batchSize = 50;
          for (let i = 0; i < failedPatients.length; i += batchSize) {
            const batch = failedPatients.slice(i, i + batchSize);
            await this.processBatch(batch);
            this.logger.logProgress(i + batch.length, failedPatients.length);
          }
          
          resolve(this.stats);
        })
        .on('error', reject);
    });
  }

  isFailedPatient(memberData) {
    // Check if this patient likely failed migration
    const email = memberData.email;
    
    // Invalid email patterns that would have caused migration failure
    return (
      email.includes('noemail+') ||
      email === 'N/A' ||
      email === 'n/a' ||
      email === '' ||
      !email.includes('@') ||
      email.includes('@example.com') ||
      email.includes('@test.com')
    );
  }

  async processBatch(patients) {
    for (const patientData of patients) {
      try {
        await this.processFailedPatient(patientData);
        this.stats.totalProcessed++;
      } catch (error) {
        this.logger.logError(patientData.customerNo || patientData.id, error);
      }
    }
  }

  async processFailedPatient(patientData) {
    // First check if patient already exists (by customerNo)
    if (patientData.customerNo) {
      const existing = await Patient.findOne({ 
        legacyCustomerNo: patientData.customerNo 
      });
      
      if (existing) {
        this.logger.logSkipped(patientData.customerNo, 'Patient already exists');
        this.stats.patientsSkipped++;
        return;
      }
    }
    
    // Generate valid email
    const generatedEmail = this.matcher.generateValidEmail(patientData);
    this.stats.emailsGenerated++;
    
    if (this.dryRun) {
      this.logger.writeLog(`[DRY RUN] Would create patient ${patientData.customerNo} with email ${generatedEmail}`);
      this.stats.patientsCreated++;
      return;
    }
    
    // Create patient record
    const patient = await this.createPatientRecord(patientData, generatedEmail);
    
    if (patient) {
      this.stats.patientsCreated++;
      
      // Flag for manual review
      this.stats.requireManualReview.push({
        patientId: patient._id,
        legacyCustomerNo: patient.legacyCustomerNo,
        reason: 'Invalid email in source data',
        originalEmail: patientData.email,
        generatedEmail: generatedEmail
      });
    }
  }

  async createPatientRecord(patientData, generatedEmail) {
    try {
      // Get address data if available
      const addressData = this.addressCache.get(patientData.email);
      
      // Prepare patient data
      const newPatient = {
        // Basic information
        firstName: patientData.first_name || 'Unknown',
        lastName: patientData.last_name || 'Unknown',
        email: generatedEmail,
        legacyCustomerNo: patientData.customerNo,
        
        // Required fields with defaults
        dateOfBirth: patientData.birthdate ? new Date(patientData.birthdate) : new Date('1900-01-01'),
        gender: 'prefer-not-to-say',
        phone: 'PENDING_UPDATE',
        status: patientData.active === '1' ? 'active' : 'inactive',
        hasConsent: false,
        
        // Optional fields
        nric: patientData.nric && patientData.nric !== 'N/A' ? patientData.nric : undefined,
        occupation: patientData.occupation,
        salutation: patientData.salutation,
        
        // Address information if available
        address: this.formatAddress(addressData),
        city: addressData?.city || 'Singapore',
        postalCode: addressData?.postal,
        altPhone: addressData?.mobile,
        country: 'Singapore',
        
        // Marketing preferences
        marketingPreferences: {
          partnerOffers: patientData.partner_offers_status === '1',
          newsletter: patientData.newsletter_status === '1',
          lastUpdated: new Date(patientData.updated || Date.now())
        },
        
        // Migration metadata
        migrationInfo: {
          sourceSystem: 'leaftolife_legacy',
          migratedAt: new Date(),
          migrationVersion: '2.0',
          dataQuality: 'minimal',
          conflictResolved: false,
          notes: 'Recovered from failed migration - invalid email'
        },
        
        // Enrichment info
        enrichmentInfo: {
          lastEnriched: new Date(),
          enrichmentVersion: '2.0',
          enrichmentSources: ['failed-recovery'],
          dataCompleteness: 10, // Minimal data
          enrichmentPhases: [{
            phase: 'failed-recovery',
            completedAt: new Date(),
            recordsEnriched: 1,
            success: true
          }]
        }
      };
      
      // Create patient
      const patient = new Patient(newPatient);
      await patient.save();
      
      this.logger.logEnrichment(patient._id, newPatient, 'failed-recovery');
      
      if (addressData) {
        this.stats.addressesLinked++;
      }
      
      return patient;
      
    } catch (error) {
      // Handle duplicate key errors
      if (error.code === 11000) {
        this.logger.logSkipped(patientData.customerNo, `Duplicate key error: ${JSON.stringify(error.keyValue)}`);
        this.stats.patientsSkipped++;
        return null;
      }
      
      throw error;
    }
  }

  formatAddress(addressData) {
    if (!addressData) return undefined;
    
    const parts = [
      addressData.address1,
      addressData.address2,
      addressData.address3,
      addressData.address4
    ].filter(part => part && part.trim() !== '');
    
    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  async generateRecoveryReport() {
    const report = {
      ...this.logger.generateReport(),
      recoveryStats: {
        totalProcessed: this.stats.totalProcessed,
        patientsCreated: this.stats.patientsCreated,
        patientsSkipped: this.stats.patientsSkipped,
        creationRate: this.stats.totalProcessed > 0 ?
          ((this.stats.patientsCreated / this.stats.totalProcessed) * 100).toFixed(2) + '%' : '0%',
        emailsGenerated: this.stats.emailsGenerated,
        addressesLinked: this.stats.addressesLinked,
        requireManualReview: this.stats.requireManualReview.length,
        matcherStats: this.matcher.getStats()
      },
      manualReviewList: this.stats.requireManualReview
    };
    
    // Save detailed report
    const reportFile = path.join(this.logger.logDir, 'failed-patients-recovery-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    // Save manual review list separately
    const reviewFile = path.join(this.logger.logDir, 'manual-review-required.json');
    fs.writeFileSync(reviewFile, JSON.stringify({
      generatedAt: new Date().toISOString(),
      totalPatients: this.stats.requireManualReview.length,
      patients: this.stats.requireManualReview
    }, null, 2));
    
    return report;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  console.log(`Starting failed patients recovery ${dryRun ? '(DRY RUN)' : ''}...`);
  
  const recovery = new FailedPatientsRecovery(dryRun);
  
  try {
    await recovery.connect();
    await recovery.processFailedPatients();
    const report = await recovery.generateRecoveryReport();
    
    console.log('\n=== Failed Patients Recovery Complete ===');
    console.log(`Total processed: ${report.recoveryStats.totalProcessed}`);
    console.log(`Patients created: ${report.recoveryStats.patientsCreated}`);
    console.log(`Patients skipped: ${report.recoveryStats.patientsSkipped}`);
    console.log(`Creation rate: ${report.recoveryStats.creationRate}`);
    console.log(`Emails generated: ${report.recoveryStats.emailsGenerated}`);
    console.log(`Addresses linked: ${report.recoveryStats.addressesLinked}`);
    console.log(`\nPatients requiring manual review: ${report.recoveryStats.requireManualReview}`);
    console.log('\nDetailed reports saved to logs/enrichment/');
    console.log('Manual review list: logs/enrichment/manual-review-required.json');
    
    if (dryRun) {
      console.log('\n[DRY RUN] No data was actually modified.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Failed patients recovery failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = FailedPatientsRecovery;