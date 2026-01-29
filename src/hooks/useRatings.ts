import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/db';
import type { Rating } from '../types';

/**
 * Hook for managing ratings within a capability assessment (v2.0)
 */
export function useRatings(capabilityAssessmentId: string | undefined) {
  const ratings = useLiveQuery(
    () => capabilityAssessmentId 
      ? db.ratings.where('capabilityAssessmentId').equals(capabilityAssessmentId).toArray()
      : [],
    [capabilityAssessmentId]
  );

  /**
   * Save a rating for a question
   * Returns the rating ID (useful for attachments)
   */
  const saveRating = async (
    questionIndex: number,
    level: 1 | 2 | 3 | 4 | 5 | null,
    notes: string = ''
  ): Promise<string | undefined> => {
    if (!capabilityAssessmentId) return undefined;

    const now = new Date();
    let ratingId: string | undefined;

    // Use transaction to prevent race conditions creating duplicate ratings
    await db.transaction('rw', [db.ratings, db.capabilityAssessments], async () => {
      // Check if rating exists for this question using compound index
      const existing = await db.ratings
        .where('[capabilityAssessmentId+questionIndex]')
        .equals([capabilityAssessmentId, questionIndex])
        .first();

      if (existing) {
        // Update existing rating
        await db.ratings.update(existing.id, {
          level,
          notes,
          carriedForward: false, // Clear carried forward flag on edit
          updatedAt: now,
        });
        ratingId = existing.id;
      } else {
        // Create new rating
        ratingId = uuidv4();
        const rating: Rating = {
          id: ratingId,
          capabilityAssessmentId,
          questionIndex,
          level,
          notes,
          carriedForward: false,
          attachmentIds: [], // Initialize empty attachments array
          updatedAt: now,
        };
        await db.ratings.add(rating);
      }

      // Update assessment timestamp
      await db.capabilityAssessments.update(capabilityAssessmentId, {
        updatedAt: now,
      });
    });

    return ratingId;
  };

  /**
   * Get rating for a specific question
   */
  const getRating = (questionIndex: number): Rating | undefined => {
    return ratings?.find(r => r.questionIndex === questionIndex);
  };

  /**
   * Get progress (percentage of questions answered)
   */
  const getProgress = (totalQuestions: number): number => {
    if (!ratings || totalQuestions === 0) return 0;
    const answered = ratings.filter(r => r.level !== null).length;
    return Math.round((answered / totalQuestions) * 100);
  };

  /**
   * Get count of answered questions
   */
  const getAnsweredCount = (): number => {
    return ratings?.filter(r => r.level !== null).length || 0;
  };

  /**
   * Check if all questions are answered
   */
  const isComplete = (totalQuestions: number): boolean => {
    return getAnsweredCount() >= totalQuestions;
  };

  /**
   * Calculate average score
   */
  const getAverageScore = (): number | null => {
    if (!ratings) return null;
    const answered = ratings.filter(r => r.level !== null);
    if (answered.length === 0) return null;
    const sum = answered.reduce((acc, r) => acc + (r.level || 0), 0);
    return Math.round((sum / answered.length) * 10) / 10;
  };

  return {
    ratings: ratings || [],
    saveRating,
    getRating,
    getProgress,
    getAnsweredCount,
    isComplete,
    getAverageScore,
  };
}
