import { Prescription, PrescriptionVersion, PrescriptionChange } from '@/types/prescription'
import { format, parseISO } from 'date-fns'

export class PrescriptionVersionManager {
  private static getStorageKey(patientId: string): string {
    return `prescription-versions-${patientId}`
  }

  private static getVersionKey(patientId: string, date: string): string {
    return `prescription-${patientId}-${date}`
  }

  static getAllVersions(patientId: string): PrescriptionVersion[] {
    try {
      const storageKey = this.getStorageKey(patientId)
      const versionsData = localStorage.getItem(storageKey)
      if (!versionsData) return []
      
      const versions = JSON.parse(versionsData) as PrescriptionVersion[]
      return versions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    } catch (error) {
      console.error('Failed to load prescription versions:', error)
      return []
    }
  }

  static getVersionByDate(patientId: string, date: string): PrescriptionVersion | null {
    try {
      const versionKey = this.getVersionKey(patientId, date)
      const versionData = localStorage.getItem(versionKey)
      if (!versionData) return null
      
      return JSON.parse(versionData) as PrescriptionVersion
    } catch (error) {
      console.error('Failed to load prescription version:', error)
      return null
    }
  }

  static saveVersion(patientId: string, prescription: Prescription, changes: PrescriptionChange[] = []): PrescriptionVersion {
    try {
      const existingVersions = this.getAllVersions(patientId)
      const prescriptionDate = format(new Date(), 'yyyy-MM-dd')
      
      // Check if version for this date already exists
      let version = existingVersions.find(v => v.date === prescriptionDate)
      
      if (version) {
        // Update existing version
        version.prescription = prescription
        version.changes = [...version.changes, ...changes]
        version.summary = this.generateChangeSummary(changes)
      } else {
        // Create new version
        const versionNumber = existingVersions.length + 1
        version = {
          id: `version-${patientId}-${prescriptionDate}`,
          version: versionNumber,
          date: prescriptionDate,
          prescription,
          changes,
          summary: changes.length > 0 ? this.generateChangeSummary(changes) : 'Initial prescription'
        }
        existingVersions.push(version)
      }

      // Save individual version
      const versionKey = this.getVersionKey(patientId, prescriptionDate)
      localStorage.setItem(versionKey, JSON.stringify(version))

      // Save versions index
      const storageKey = this.getStorageKey(patientId)
      localStorage.setItem(storageKey, JSON.stringify(existingVersions))

      return version
    } catch (error) {
      console.error('Failed to save prescription version:', error)
      throw error
    }
  }

  static compareVersions(version1: PrescriptionVersion, version2: PrescriptionVersion): PrescriptionChange[] {
    const changes: PrescriptionChange[] = []
    const timestamp = new Date().toISOString()

    // Compare basic fields
    const basicFields = ['practitionerName', 'date'] as const
    basicFields.forEach(field => {
      if (version1.prescription[field] !== version2.prescription[field]) {
        changes.push({
          field,
          oldValue: version1.prescription[field],
          newValue: version2.prescription[field],
          timestamp,
          changeType: 'modified'
        })
      }
    })

    // Compare arrays (dietary advice, lifestyle advice, special instructions)
    this.compareArrayFields(version1.prescription, version2.prescription, 'dietaryAdvice', changes, timestamp)
    this.compareArrayFields(version1.prescription, version2.prescription, 'lifestyleAdvice', changes, timestamp)
    this.compareSpecialInstructions(version1.prescription, version2.prescription, changes, timestamp)

    // Compare daily schedule
    this.compareDailySchedule(version1.prescription, version2.prescription, changes, timestamp)

    return changes
  }

  private static compareArrayFields(
    prescription1: Prescription,
    prescription2: Prescription,
    field: 'dietaryAdvice' | 'lifestyleAdvice',
    changes: PrescriptionChange[],
    timestamp: string
  ) {
    const array1 = prescription1[field] || []
    const array2 = prescription2[field] || []

    // Find added items
    array2.forEach((item, index) => {
      if (!array1.includes(item)) {
        changes.push({
          field: `${field}[${index}]`,
          oldValue: null,
          newValue: item,
          timestamp,
          changeType: 'added'
        })
      }
    })

    // Find removed items
    array1.forEach((item, index) => {
      if (!array2.includes(item)) {
        changes.push({
          field: `${field}[${index}]`,
          oldValue: item,
          newValue: null,
          timestamp,
          changeType: 'removed'
        })
      }
    })
  }

  private static compareSpecialInstructions(
    prescription1: Prescription,
    prescription2: Prescription,
    changes: PrescriptionChange[],
    timestamp: string
  ) {
    const instructions1 = prescription1.specialInstructions || []
    const instructions2 = prescription2.specialInstructions || []

    // Find added instructions
    instructions2.forEach(instruction => {
      if (!instructions1.find(i => i.id === instruction.id)) {
        changes.push({
          field: `specialInstructions.${instruction.id}`,
          oldValue: null,
          newValue: instruction.instruction,
          timestamp,
          changeType: 'added'
        })
      }
    })

    // Find removed instructions
    instructions1.forEach(instruction => {
      if (!instructions2.find(i => i.id === instruction.id)) {
        changes.push({
          field: `specialInstructions.${instruction.id}`,
          oldValue: instruction.instruction,
          newValue: null,
          timestamp,
          changeType: 'removed'
        })
      }
    })

    // Find modified instructions
    instructions1.forEach(instruction1 => {
      const instruction2 = instructions2.find(i => i.id === instruction1.id)
      if (instruction2 && instruction1.instruction !== instruction2.instruction) {
        changes.push({
          field: `specialInstructions.${instruction1.id}`,
          oldValue: instruction1.instruction,
          newValue: instruction2.instruction,
          timestamp,
          changeType: 'modified'
        })
      }
    })
  }

  private static compareDailySchedule(
    prescription1: Prescription,
    prescription2: Prescription,
    changes: PrescriptionChange[],
    timestamp: string
  ) {
    const meals = ['breakfast', 'lunch', 'dinner'] as const
    const timings = ['before', 'during', 'after'] as const

    meals.forEach(meal => {
      timings.forEach(timing => {
        const remedies1 = prescription1.dailySchedule[meal][timing] || []
        const remedies2 = prescription2.dailySchedule[meal][timing] || []

        // Find added remedies
        remedies2.forEach(remedy => {
          if (!remedies1.find(r => r.id === remedy.id)) {
            changes.push({
              field: `dailySchedule.${meal}.${timing}.${remedy.id}`,
              oldValue: null,
              newValue: `${remedy.name}: ${remedy.instructions}`,
              timestamp,
              changeType: 'added'
            })
          }
        })

        // Find removed remedies
        remedies1.forEach(remedy => {
          if (!remedies2.find(r => r.id === remedy.id)) {
            changes.push({
              field: `dailySchedule.${meal}.${timing}.${remedy.id}`,
              oldValue: `${remedy.name}: ${remedy.instructions}`,
              newValue: null,
              timestamp,
              changeType: 'removed'
            })
          }
        })

        // Find modified remedies
        remedies1.forEach(remedy1 => {
          const remedy2 = remedies2.find(r => r.id === remedy1.id)
          if (remedy2 && (remedy1.instructions !== remedy2.instructions || remedy1.name !== remedy2.name)) {
            changes.push({
              field: `dailySchedule.${meal}.${timing}.${remedy1.id}`,
              oldValue: `${remedy1.name}: ${remedy1.instructions}`,
              newValue: `${remedy2.name}: ${remedy2.instructions}`,
              timestamp,
              changeType: 'modified'
            })
          }
        })
      })
    })
  }

  static generateChangeSummary(changes: PrescriptionChange[]): string {
    if (changes.length === 0) return 'No changes'

    const added = changes.filter(c => c.changeType === 'added').length
    const modified = changes.filter(c => c.changeType === 'modified').length
    const removed = changes.filter(c => c.changeType === 'removed').length

    const parts = []
    if (added > 0) parts.push(`${added} added`)
    if (modified > 0) parts.push(`${modified} modified`)
    if (removed > 0) parts.push(`${removed} removed`)

    return parts.join(', ')
  }

  static deleteVersion(patientId: string, date: string): boolean {
    try {
      const versionKey = this.getVersionKey(patientId, date)
      localStorage.removeItem(versionKey)

      const existingVersions = this.getAllVersions(patientId)
      const filteredVersions = existingVersions.filter(v => v.date !== date)

      const storageKey = this.getStorageKey(patientId)
      localStorage.setItem(storageKey, JSON.stringify(filteredVersions))

      return true
    } catch (error) {
      console.error('Failed to delete prescription version:', error)
      return false
    }
  }

  static getVersionsForDateRange(patientId: string, startDate: string, endDate: string): PrescriptionVersion[] {
    const allVersions = this.getAllVersions(patientId)
    const start = parseISO(startDate)
    const end = parseISO(endDate)

    return allVersions.filter(version => {
      const versionDate = parseISO(version.date)
      return versionDate >= start && versionDate <= end
    })
  }

  static getCurrentVersion(patientId: string): PrescriptionVersion | null {
    const versions = this.getAllVersions(patientId)
    if (versions.length === 0) return null
    
    // Return the most recent version
    return versions[0]
  }

  static createVersionFromLegacyPrescription(patientId: string, prescription: Prescription): PrescriptionVersion {
    return this.saveVersion(patientId, prescription, [])
  }
}