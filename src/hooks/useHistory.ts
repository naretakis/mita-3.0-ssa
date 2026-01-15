import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { AssessmentHistory } from '../types';

/**
 * Hook for accessing assessment history
 */
export function useHistory(capabilityCode?: string) {
  // Get history for a specific capability or all history
  const history = useLiveQuery(
    async () => {
      if (capabilityCode) {
        return db.assessmentHistory
          .where('capabilityCode')
          .equals(capabilityCode)
          .reverse()
          .sortBy('snapshotDate');
      }
      return db.assessmentHistory
        .orderBy('snapshotDate')
        .reverse()
        .toArray();
    },
    [capabilityCode]
  );

  /**
   * Get history entries for a specific capability
   */
  const getCapabilityHistory = async (code: string): Promise<AssessmentHistory[]> => {
    return db.assessmentHistory
      .where('capabilityCode')
      .equals(code)
      .reverse()
      .sortBy('snapshotDate');
  };

  /**
   * Get a specific history entry by ID
   */
  const getHistoryEntry = async (id: string): Promise<AssessmentHistory | undefined> => {
    return db.assessmentHistory.get(id);
  };

  /**
   * Delete a history entry
   */
  const deleteHistoryEntry = async (id: string): Promise<void> => {
    await db.assessmentHistory.delete(id);
  };

  /**
   * Clear all history for a capability
   */
  const clearCapabilityHistory = async (code: string): Promise<void> => {
    await db.assessmentHistory.where('capabilityCode').equals(code).delete();
  };

  return {
    history: history || [],
    getCapabilityHistory,
    getHistoryEntry,
    deleteHistoryEntry,
    clearCapabilityHistory,
  };
}

/**
 * Hook for history of a specific capability (reactive)
 */
export function useCapabilityHistory(capabilityCode: string | undefined) {
  const history = useLiveQuery(
    async () => {
      if (!capabilityCode) return [];
      return db.assessmentHistory
        .where('capabilityCode')
        .equals(capabilityCode)
        .reverse()
        .sortBy('snapshotDate');
    },
    [capabilityCode]
  );

  return { history: history || [] };
}
