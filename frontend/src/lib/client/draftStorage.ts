/**
 * Client-side draft storage utilities
 * Handles localStorage persistence for transaction drafts
 */

export interface DraftData {
  draftId: string;
  draftName?: string;
  formData: Record<string, unknown>;
  selectedPatientId?: string;
  timestamp: Date;
  userId: string;
}

const DRAFT_STORAGE_KEY = 'transaction_drafts';
const MAX_DRAFTS = 10;
const DRAFT_EXPIRY_DAYS = 7;

export class DraftStorage {
  /**
   * Save draft to localStorage
   */
  static saveDraft(draftId: string, formData: Record<string, unknown>, userId: string, draftName?: string, selectedPatientId?: string): void {
    try {
      const drafts = this.getAllDrafts();
      const existingIndex = drafts.findIndex(d => d.draftId === draftId && d.userId === userId);
      
      const draftData: DraftData = {
        draftId,
        draftName,
        formData,
        selectedPatientId,
        timestamp: new Date(),
        userId
      };

      if (existingIndex >= 0) {
        // Update existing draft
        drafts[existingIndex] = draftData;
      } else {
        // Add new draft
        drafts.unshift(draftData);
      }

      // Keep only the most recent drafts
      const trimmedDrafts = drafts.slice(0, MAX_DRAFTS);
      
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(trimmedDrafts));
    } catch (_error) {
      console.warn('Failed to save draft to localStorage:', _error);
    }
  }

  /**
   * Get draft from localStorage
   */
  static getDraft(draftId: string, userId: string): DraftData | null {
    try {
      const drafts = this.getAllDrafts();
      const draft = drafts.find(d => d.draftId === draftId && d.userId === userId);
      
      if (draft && this.isDraftValid(draft)) {
        return {
          ...draft,
          timestamp: new Date(draft.timestamp)
        };
      }
      
      return null;
    } catch (_error) {
      console.warn('Failed to get draft from localStorage:', _error);
      return null;
    }
  }

  /**
   * Get all drafts for a user
   */
  static getUserDrafts(userId: string): DraftData[] {
    try {
      const drafts = this.getAllDrafts();
      return drafts
        .filter(d => d.userId === userId && this.isDraftValid(d))
        .map(d => ({
          ...d,
          timestamp: new Date(d.timestamp)
        }))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (_error) {
      console.warn('Failed to get user drafts from localStorage:', _error);
      return [];
    }
  }

  /**
   * Delete draft from localStorage
   */
  static deleteDraft(draftId: string, userId: string): void {
    try {
      const drafts = this.getAllDrafts();
      const filteredDrafts = drafts.filter(d => !(d.draftId === draftId && d.userId === userId));
      
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(filteredDrafts));
    } catch (_error) {
      console.warn('Failed to delete draft from localStorage:', _error);
    }
  }

  /**
   * Clear all drafts for a user
   */
  static clearUserDrafts(userId: string): void {
    try {
      const drafts = this.getAllDrafts();
      const filteredDrafts = drafts.filter(d => d.userId !== userId);
      
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(filteredDrafts));
    } catch (_error) {
      console.warn('Failed to clear user drafts from localStorage:', _error);
    }
  }

  /**
   * Check if there's a draft for the current form session
   */
  static hasUnsavedDraft(userId: string): boolean {
    try {
      const drafts = this.getUserDrafts(userId);
      return drafts.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Generate a unique draft ID
   */
  static generateDraftId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Merge server draft with local draft (conflict resolution)
   */
  static mergeDrafts(serverDraft: Record<string, unknown>, localDraft: DraftData): Record<string, unknown> {
    // Simple strategy: use the most recent timestamp
    const serverTimestamp = new Date(
      (serverDraft.autoSaveTimestamp as string | Date) || 
      (serverDraft.updatedAt as string | Date) || 
      new Date()
    );
    const localTimestamp = localDraft.timestamp;

    if (serverTimestamp > localTimestamp) {
      return serverDraft;
    } else {
      return {
        ...serverDraft,
        ...localDraft.formData,
        draftName: localDraft.draftName || serverDraft.draftName
      };
    }
  }

  /**
   * Clean up expired drafts
   */
  static cleanupExpiredDrafts(): void {
    try {
      const drafts = this.getAllDrafts();
      const validDrafts = drafts.filter(d => this.isDraftValid(d));
      
      if (validDrafts.length !== drafts.length) {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(validDrafts));
      }
    } catch (_error) {
      console.warn('Failed to cleanup expired drafts:', _error);
    }
  }

  /**
   * Get all drafts from localStorage
   */
  private static getAllDrafts(): DraftData[] {
    try {
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      console.warn('Failed to parse drafts from localStorage:', _error);
      return [];
    }
  }

  /**
   * Check if draft is still valid (not expired)
   */
  private static isDraftValid(draft: DraftData): boolean {
    try {
      const draftDate = new Date(draft.timestamp);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() - DRAFT_EXPIRY_DAYS);
      
      return draftDate > expiryDate;
    } catch {
      return false;
    }
  }

  /**
   * Get storage usage info
   */
  static getStorageInfo(): {
    totalDrafts: number;
    userDrafts: number;
    storageSize: number;
  } {
    try {
      const drafts = this.getAllDrafts();
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY) || '';
      
      return {
        totalDrafts: drafts.length,
        userDrafts: 0, // Would need userId to calculate
        storageSize: new Blob([stored]).size
      };
    } catch {
      return {
        totalDrafts: 0,
        userDrafts: 0,
        storageSize: 0
      };
    }
  }
}