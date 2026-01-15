import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { getCapabilityByCode } from '../services/blueprint';
import type { CapabilityAssessment } from '../types';

export interface CapabilityScoreData {
  capabilityCode: string;
  score: number | null;
  assessmentId: string | null;
  assessmentDate: Date | null;
  tags: string[];
  status: 'not_assessed' | 'in_progress' | 'finalized';
  questionProgress: number; // 0-100 percentage of questions answered
}

/**
 * Hook for accessing maturity scores (v2.0)
 * Simplified since each capability now has its own assessment record
 */
export function useScores() {
  const scoreData = useLiveQuery(async () => {
    // Get all capability assessments
    const assessments = await db.capabilityAssessments.toArray();
    
    // Get all ratings for progress calculation
    const allRatings = await db.ratings.toArray();
    const ratingsByAssessment = new Map<string, number>();
    for (const rating of allRatings) {
      if (rating.level !== null) {
        const count = ratingsByAssessment.get(rating.capabilityAssessmentId) || 0;
        ratingsByAssessment.set(rating.capabilityAssessmentId, count + 1);
      }
    }
    
    // Build a map of capability code -> score data
    // For each capability, we want the finalized assessment (if exists)
    // or the in-progress one (for status display)
    const capabilityScores = new Map<string, CapabilityScoreData>();
    
    // Group by capability code
    const byCapability = new Map<string, CapabilityAssessment[]>();
    for (const assessment of assessments) {
      const existing = byCapability.get(assessment.capabilityCode) || [];
      existing.push(assessment);
      byCapability.set(assessment.capabilityCode, existing);
    }
    
    // For each capability, determine the score data
    for (const [capabilityCode, capAssessments] of byCapability) {
      // Prefer finalized, then in-progress
      const finalized = capAssessments.find(a => a.status === 'finalized');
      const inProgress = capAssessments.find(a => a.status === 'in_progress');
      
      // Get total questions for this capability
      const capability = getCapabilityByCode(capabilityCode);
      const totalQuestions = capability?.bcm.maturity_model.capability_questions.length || 1;
      
      if (finalized) {
        const answeredCount = ratingsByAssessment.get(finalized.id) || 0;
        capabilityScores.set(capabilityCode, {
          capabilityCode,
          score: finalized.score ?? null,
          assessmentId: finalized.id,
          assessmentDate: finalized.finalizedAt || finalized.updatedAt,
          tags: finalized.tags,
          status: 'finalized',
          questionProgress: Math.round((answeredCount / totalQuestions) * 100),
        });
      } else if (inProgress) {
        const answeredCount = ratingsByAssessment.get(inProgress.id) || 0;
        capabilityScores.set(capabilityCode, {
          capabilityCode,
          score: null, // In-progress doesn't have a finalized score
          assessmentId: inProgress.id,
          assessmentDate: inProgress.updatedAt,
          tags: inProgress.tags,
          status: 'in_progress',
          questionProgress: Math.round((answeredCount / totalQuestions) * 100),
        });
      }
    }
    
    return { capabilityScores };
  }, []);

  /**
   * Get score data for a specific capability
   */
  const getCapabilityScoreData = (capabilityCode: string): CapabilityScoreData | undefined => {
    return scoreData?.capabilityScores.get(capabilityCode);
  };

  /**
   * Get just the score for a capability (null if not finalized)
   */
  const getCapabilityScore = (capabilityCode: string): number | null => {
    return scoreData?.capabilityScores.get(capabilityCode)?.score ?? null;
  };

  /**
   * Get average score for a business area
   */
  const getBusinessAreaScore = (capabilityCodes: string[]): number | null => {
    if (!scoreData) return null;
    
    const scores: number[] = [];
    for (const code of capabilityCodes) {
      const data = scoreData.capabilityScores.get(code);
      if (data?.score !== null && data?.score !== undefined) {
        scores.push(data.score);
      }
    }
    
    if (scores.length === 0) return null;
    
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return Math.round(avg * 10) / 10;
  };

  /**
   * Get status for a capability
   */
  const getCapabilityStatus = (
    capabilityCode: string
  ): 'not_assessed' | 'in_progress' | 'finalized' => {
    return scoreData?.capabilityScores.get(capabilityCode)?.status ?? 'not_assessed';
  };

  /**
   * Get question progress for a capability (0-100)
   */
  const getCapabilityProgress = (capabilityCode: string): number => {
    return scoreData?.capabilityScores.get(capabilityCode)?.questionProgress ?? 0;
  };

  /**
   * Get tags for a capability (from latest finalized)
   */
  const getCapabilityTags = (capabilityCode: string): string[] => {
    const data = scoreData?.capabilityScores.get(capabilityCode);
    // Only return tags from finalized assessments
    if (data?.status === 'finalized') {
      return data.tags;
    }
    return [];
  };

  /**
   * Get all unique tags in use across finalized assessments
   */
  const getAllTagsInUse = (): string[] => {
    if (!scoreData) return [];
    
    const tagSet = new Set<string>();
    for (const data of scoreData.capabilityScores.values()) {
      if (data.status === 'finalized') {
        for (const tag of data.tags) {
          tagSet.add(tag);
        }
      }
    }
    
    return Array.from(tagSet).sort();
  };

  /**
   * Get capabilities that have a specific tag
   */
  const getCapabilitiesByTag = (tag: string): string[] => {
    if (!scoreData) return [];
    
    const capabilities: string[] = [];
    for (const [code, data] of scoreData.capabilityScores) {
      if (data.status === 'finalized' && data.tags.includes(tag)) {
        capabilities.push(code);
      }
    }
    
    return capabilities;
  };

  /**
   * Get assessment counts by status
   */
  const getStatusCounts = (): { finalized: number; inProgress: number; notAssessed: number } => {
    if (!scoreData) return { finalized: 0, inProgress: 0, notAssessed: 0 };
    
    let finalized = 0;
    let inProgress = 0;
    
    for (const data of scoreData.capabilityScores.values()) {
      if (data.status === 'finalized') finalized++;
      else if (data.status === 'in_progress') inProgress++;
    }
    
    // Note: notAssessed would need total capability count from blueprint
    return { finalized, inProgress, notAssessed: 0 };
  };

  return {
    capabilityScores: scoreData?.capabilityScores ?? new Map(),
    getCapabilityScoreData,
    getCapabilityScore,
    getBusinessAreaScore,
    getCapabilityStatus,
    getCapabilityProgress,
    getCapabilityTags,
    getAllTagsInUse,
    getCapabilitiesByTag,
    getStatusCounts,
  };
}
