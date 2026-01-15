import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/db';
import { getBlueprintVersion, getCapabilityByCode } from '../services/blueprint';
import type { CapabilityAssessment, Rating, AssessmentHistory } from '../types';

/**
 * Hook for managing capability assessments (v2.0 model)
 * Each capability is assessed independently as a standalone record
 */
export function useCapabilityAssessments() {
  // Get all capability assessments
  const assessments = useLiveQuery(
    () => db.capabilityAssessments.orderBy('updatedAt').reverse().toArray(),
    []
  );

  /**
   * Start a new assessment for a capability
   */
  const startAssessment = async (
    capabilityCode: string,
    initialTags: string[] = []
  ): Promise<string> => {
    const capability = getCapabilityByCode(capabilityCode);
    if (!capability) {
      throw new Error(`Capability not found: ${capabilityCode}`);
    }

    const now = new Date();
    const assessmentId = uuidv4();

    // Create the new assessment
    const assessment: CapabilityAssessment = {
      id: assessmentId,
      capabilityCode,
      businessArea: capability.businessArea,
      processName: capability.processName,
      status: 'in_progress',
      tags: initialTags,
      blueprintVersion: getBlueprintVersion(),
      createdAt: now,
      updatedAt: now,
    };

    await db.capabilityAssessments.add(assessment);

    // Update tag usage
    for (const tag of assessment.tags) {
      await updateTagUsage(tag);
    }

    return assessmentId;
  };

  /**
   * Edit an existing finalized assessment
   * Snapshots the current state to history, then sets status to in_progress
   * Converts ratings to "suggestion" format (level becomes previousLevel, level set to null)
   */
  const editAssessment = async (assessmentId: string): Promise<void> => {
    const assessment = await db.capabilityAssessments.get(assessmentId);
    if (!assessment) {
      throw new Error(`Assessment not found: ${assessmentId}`);
    }

    if (assessment.status !== 'finalized') {
      // Already in progress, nothing to do
      return;
    }

    // Snapshot current finalized state to history before editing
    if (assessment.score !== undefined) {
      const currentRatings = await db.ratings
        .where('capabilityAssessmentId')
        .equals(assessmentId)
        .toArray();

      const historyEntry: AssessmentHistory = {
        id: uuidv4(),
        capabilityCode: assessment.capabilityCode,
        snapshotDate: assessment.finalizedAt || assessment.updatedAt,
        tags: assessment.tags,
        score: assessment.score,
        ratings: currentRatings
          .filter(r => r.level !== null)
          .map(r => ({
            questionIndex: r.questionIndex,
            level: r.level as 1 | 2 | 3 | 4 | 5,
            notes: r.notes,
          })),
        blueprintVersion: assessment.blueprintVersion,
      };

      await db.assessmentHistory.add(historyEntry);

      // Convert ratings to "suggestion" format
      // Move current level to previousLevel, set level to null
      const now = new Date();
      for (const rating of currentRatings) {
        if (rating.level !== null) {
          await db.ratings.update(rating.id, {
            previousLevel: rating.level,
            level: null,
            carriedForward: true,
            updatedAt: now,
          });
        }
      }
    }

    await db.capabilityAssessments.update(assessmentId, {
      status: 'in_progress',
      updatedAt: new Date(),
    });
  };

  /**
   * Finalize an assessment
   * Snapshots any existing finalized assessment to history first
   */
  const finalizeAssessment = async (assessmentId: string): Promise<void> => {
    const assessment = await db.capabilityAssessments.get(assessmentId);
    
    if (!assessment) {
      throw new Error(`Assessment not found: ${assessmentId}`);
    }

    const now = new Date();

    // Get ratings for this assessment
    const ratings = await db.ratings
      .where('capabilityAssessmentId')
      .equals(assessmentId)
      .toArray();

    // Calculate score
    const answeredRatings = ratings.filter(r => r.level !== null);
    const score = answeredRatings.length > 0
      ? answeredRatings.reduce((sum, r) => sum + (r.level || 0), 0) / answeredRatings.length
      : undefined;

    // Check for existing finalized assessment (different from current)
    const existingFinalized = await db.capabilityAssessments
      .where('capabilityCode')
      .equals(assessment.capabilityCode)
      .filter(a => a.status === 'finalized' && a.id !== assessmentId)
      .first();

    // Snapshot existing finalized to history before replacing
    if (existingFinalized && existingFinalized.score !== undefined) {
      const existingRatings = await db.ratings
        .where('capabilityAssessmentId')
        .equals(existingFinalized.id)
        .toArray();

      const historyEntry: AssessmentHistory = {
        id: uuidv4(),
        capabilityCode: existingFinalized.capabilityCode,
        snapshotDate: existingFinalized.finalizedAt || existingFinalized.updatedAt,
        tags: existingFinalized.tags,
        score: existingFinalized.score,
        ratings: existingRatings
          .filter(r => r.level !== null)
          .map(r => ({
            questionIndex: r.questionIndex,
            level: r.level as 1 | 2 | 3 | 4 | 5,
            notes: r.notes,
          })),
        blueprintVersion: existingFinalized.blueprintVersion,
      };

      await db.assessmentHistory.add(historyEntry);

      // Delete the old finalized assessment and its ratings
      await db.ratings.where('capabilityAssessmentId').equals(existingFinalized.id).delete();
      await db.capabilityAssessments.delete(existingFinalized.id);
    }

    // Update current assessment to finalized
    const updateData = {
      status: 'finalized' as const,
      finalizedAt: now,
      updatedAt: now,
      score: score ? Math.round(score * 10) / 10 : undefined,
    };
    
    await db.capabilityAssessments.update(assessmentId, updateData);

    // Update tag usage
    for (const tag of assessment.tags) {
      await updateTagUsage(tag);
    }
  };

  /**
   * Update tags on an assessment
   */
  const updateTags = async (assessmentId: string, tags: string[]): Promise<void> => {
    await db.capabilityAssessments.update(assessmentId, {
      tags,
      updatedAt: new Date(),
    });

    // Update tag usage counts
    for (const tag of tags) {
      await updateTagUsage(tag);
    }
  };

  /**
   * Delete an assessment and its ratings
   */
  const deleteAssessment = async (assessmentId: string): Promise<void> => {
    await db.transaction('rw', [db.capabilityAssessments, db.ratings], async () => {
      await db.ratings.where('capabilityAssessmentId').equals(assessmentId).delete();
      await db.capabilityAssessments.delete(assessmentId);
    });
  };

  /**
   * Discard an in-progress assessment (for new assessments that were never finalized)
   * Deletes the assessment and all its ratings
   */
  const discardAssessment = async (assessmentId: string): Promise<void> => {
    await db.transaction('rw', [db.capabilityAssessments, db.ratings], async () => {
      await db.ratings.where('capabilityAssessmentId').equals(assessmentId).delete();
      await db.capabilityAssessments.delete(assessmentId);
    });
  };

  /**
   * Revert an edit session on a finalized assessment
   * Restores the assessment to finalized status and restores ratings from the most recent history snapshot
   */
  const revertEdit = async (assessmentId: string): Promise<void> => {
    const assessment = await db.capabilityAssessments.get(assessmentId);
    if (!assessment) {
      throw new Error(`Assessment not found: ${assessmentId}`);
    }

    // Get the most recent history entry for this capability (the one we just created when editing)
    const latestHistory = await db.assessmentHistory
      .where('capabilityCode')
      .equals(assessment.capabilityCode)
      .reverse()
      .sortBy('snapshotDate')
      .then(entries => entries[0]);

    if (!latestHistory) {
      // No history to restore from - this shouldn't happen if we're reverting an edit
      // but handle gracefully by just setting status back to finalized
      await db.capabilityAssessments.update(assessmentId, {
        status: 'finalized',
        updatedAt: new Date(),
      });
      return;
    }

    await db.transaction('rw', [db.capabilityAssessments, db.ratings, db.assessmentHistory], async () => {
      // Delete current ratings
      await db.ratings.where('capabilityAssessmentId').equals(assessmentId).delete();

      // Restore ratings from history
      const now = new Date();
      const restoredRatings: Rating[] = latestHistory.ratings.map(r => ({
        id: uuidv4(),
        capabilityAssessmentId: assessmentId,
        questionIndex: r.questionIndex,
        level: r.level,
        notes: r.notes,
        carriedForward: false,
        updatedAt: now,
      }));

      if (restoredRatings.length > 0) {
        await db.ratings.bulkAdd(restoredRatings);
      }

      // Restore assessment to finalized state
      await db.capabilityAssessments.update(assessmentId, {
        status: 'finalized',
        tags: latestHistory.tags,
        score: latestHistory.score,
        finalizedAt: latestHistory.snapshotDate,
        updatedAt: now,
      });

      // Remove the history entry we just restored from (since we're reverting, not keeping it)
      await db.assessmentHistory.delete(latestHistory.id);
    });
  };

  /**
   * Get the current assessment for a capability (finalized or in-progress)
   */
  const getAssessmentForCapability = async (
    capabilityCode: string
  ): Promise<CapabilityAssessment | undefined> => {
    // First check for in-progress
    const inProgress = await db.capabilityAssessments
      .where('capabilityCode')
      .equals(capabilityCode)
      .filter(a => a.status === 'in_progress')
      .first();

    if (inProgress) return inProgress;

    // Then check for finalized
    return db.capabilityAssessments
      .where('capabilityCode')
      .equals(capabilityCode)
      .filter(a => a.status === 'finalized')
      .first();
  };

  /**
   * Get assessment status for a capability
   */
  const getCapabilityStatus = (
    capabilityCode: string
  ): 'not_assessed' | 'in_progress' | 'finalized' => {
    if (!assessments) return 'not_assessed';

    const inProgress = assessments.find(
      a => a.capabilityCode === capabilityCode && a.status === 'in_progress'
    );
    if (inProgress) return 'in_progress';

    const finalized = assessments.find(
      a => a.capabilityCode === capabilityCode && a.status === 'finalized'
    );
    if (finalized) return 'finalized';

    return 'not_assessed';
  };

  /**
   * Get the latest finalized assessment for a capability
   */
  const getLatestFinalized = (capabilityCode: string): CapabilityAssessment | undefined => {
    return assessments?.find(
      a => a.capabilityCode === capabilityCode && a.status === 'finalized'
    );
  };

  /**
   * Get in-progress assessment for a capability
   */
  const getInProgress = (capabilityCode: string): CapabilityAssessment | undefined => {
    return assessments?.find(
      a => a.capabilityCode === capabilityCode && a.status === 'in_progress'
    );
  };

  return {
    assessments: assessments || [],
    startAssessment,
    editAssessment,
    finalizeAssessment,
    updateTags,
    deleteAssessment,
    discardAssessment,
    revertEdit,
    getAssessmentForCapability,
    getCapabilityStatus,
    getLatestFinalized,
    getInProgress,
  };
}

/**
 * Hook for a single capability assessment
 */
export function useCapabilityAssessment(assessmentId: string | undefined) {
  const assessment = useLiveQuery(
    () => assessmentId ? db.capabilityAssessments.get(assessmentId) : undefined,
    [assessmentId]
  );

  return { assessment };
}

/**
 * Helper to update tag usage count
 */
async function updateTagUsage(tagName: string): Promise<void> {
  const existing = await db.tags.where('name').equals(tagName).first();
  const now = new Date();

  if (existing) {
    await db.tags.update(existing.id, {
      usageCount: existing.usageCount + 1,
      lastUsed: now,
    });
  } else {
    await db.tags.add({
      id: uuidv4(),
      name: tagName,
      usageCount: 1,
      lastUsed: now,
    });
  }
}
