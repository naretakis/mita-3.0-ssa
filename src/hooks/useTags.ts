import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "../services/db";
import type { Tag } from "../types";

/**
 * Hook for managing tags
 */
export function useTags() {
  // Get all tags sorted by usage count (most used first)
  const tags = useLiveQuery(() => db.tags.orderBy("usageCount").reverse().toArray(), []);

  /**
   * Get tag suggestions for autocomplete
   * Returns tags sorted by usage, optionally filtered by prefix
   */
  const getSuggestions = (prefix?: string): Tag[] => {
    if (!tags) return [];

    if (!prefix) return tags;

    const normalizedPrefix = prefix.toLowerCase().replace(/^#/, "");
    return tags.filter((t) => t.name.toLowerCase().replace(/^#/, "").startsWith(normalizedPrefix));
  };

  /**
   * Create or update a tag
   */
  const ensureTag = async (name: string): Promise<void> => {
    // Normalize tag name (ensure it starts with #)
    const normalizedName = name.startsWith("#") ? name : `#${name}`;

    const existing = await db.tags.where("name").equals(normalizedName).first();
    const now = new Date();

    if (existing) {
      await db.tags.update(existing.id, {
        usageCount: existing.usageCount + 1,
        lastUsed: now,
      });
    } else {
      await db.tags.add({
        id: uuidv4(),
        name: normalizedName,
        usageCount: 1,
        lastUsed: now,
      });
    }
  };

  /**
   * Get all unique tags currently in use (from finalized assessments)
   */
  const getTagsInUse = async (): Promise<string[]> => {
    const assessments = await db.capabilityAssessments
      .filter((a) => a.status === "finalized")
      .toArray();

    const tagSet = new Set<string>();
    for (const assessment of assessments) {
      for (const tag of assessment.tags) {
        tagSet.add(tag);
      }
    }

    return Array.from(tagSet).sort();
  };

  /**
   * Delete a tag (removes from tag list, not from assessments)
   */
  const deleteTag = async (tagId: string): Promise<void> => {
    await db.tags.delete(tagId);
  };

  /**
   * Normalize a tag name (ensure # prefix, lowercase)
   */
  const normalizeTag = (name: string): string => {
    const trimmed = name.trim().toLowerCase();
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  };

  /**
   * Validate a tag name
   */
  const isValidTag = (name: string): boolean => {
    const normalized = name.replace(/^#/, "").trim();
    // Must be at least 1 character, alphanumeric with hyphens/underscores
    return /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/.test(normalized);
  };

  return {
    tags: tags || [],
    getSuggestions,
    ensureTag,
    getTagsInUse,
    deleteTag,
    normalizeTag,
    isValidTag,
  };
}
