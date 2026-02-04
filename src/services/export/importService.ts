/**
 * Import Service for MITA 3.0
 *
 * Handles importing assessment data from JSON and ZIP files.
 * Uses "Merge with History" strategy:
 * - Newer imports become current, existing moves to history
 * - Older imports are added to history, existing stays current
 */

import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";

import { db } from "../db";
import { extractAttachmentIdFromFileName } from "./exportService";
import type { ExportData, ImportResult, ImportItemResult, ImportProgressCallback } from "./types";
import type {
  CapabilityAssessment,
  Rating,
  AssessmentHistory,
  HistoricalRating,
  Attachment,
} from "../../types";

const SUPPORTED_VERSIONS = ["1.0"];

/**
 * Validates export data structure
 */
function validateExportData(data: unknown): data is ExportData {
  if (!data || typeof data !== "object") return false;

  const d = data as Record<string, unknown>;

  if (typeof d.exportVersion !== "string") return false;
  if (typeof d.exportDate !== "string") return false;
  if (!d.data || typeof d.data !== "object") return false;

  const dataObj = d.data as Record<string, unknown>;
  if (!Array.isArray(dataObj.assessments)) return false;
  if (!Array.isArray(dataObj.ratings)) return false;

  return true;
}

/**
 * Creates a history snapshot from an assessment and its ratings
 */
function createHistorySnapshot(
  assessment: CapabilityAssessment,
  ratings: Rating[],
  score: number
): AssessmentHistory {
  const historicalRatings: HistoricalRating[] = ratings
    .filter((r) => r.level !== null)
    .map((r) => ({
      questionIndex: r.questionIndex,
      level: r.level as 1 | 2 | 3 | 4 | 5,
      notes: r.notes,
      attachmentIds: r.attachmentIds || [],
    }));

  return {
    id: uuidv4(),
    capabilityCode: assessment.capabilityCode,
    snapshotDate: assessment.finalizedAt ?? assessment.updatedAt,
    tags: [...assessment.tags],
    score,
    ratings: historicalRatings,
    blueprintVersion: assessment.blueprintVersion,
  };
}

/**
 * Imports data from a JSON string
 */
export async function importFromJson(
  jsonString: string,
  onProgress?: ImportProgressCallback
): Promise<ImportResult> {
  onProgress?.(10, "Parsing JSON...");

  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch {
    return {
      success: false,
      importedAsCurrent: 0,
      importedAsHistory: 0,
      skipped: 0,
      attachmentsRestored: 0,
      errors: ["Invalid JSON format"],
      details: [],
    };
  }

  if (!validateExportData(data)) {
    return {
      success: false,
      importedAsCurrent: 0,
      importedAsHistory: 0,
      skipped: 0,
      attachmentsRestored: 0,
      errors: ["Invalid export data structure"],
      details: [],
    };
  }

  if (!SUPPORTED_VERSIONS.includes(data.exportVersion)) {
    return {
      success: false,
      importedAsCurrent: 0,
      importedAsHistory: 0,
      skipped: 0,
      attachmentsRestored: 0,
      errors: [`Unsupported export version: ${data.exportVersion}`],
      details: [],
    };
  }

  onProgress?.(30, "Processing assessments...");

  return await processImport(data, onProgress);
}

/**
 * Imports data from a ZIP file
 */
export async function importFromZip(
  zipBlob: Blob,
  onProgress?: ImportProgressCallback
): Promise<ImportResult> {
  onProgress?.(10, "Reading ZIP file...");

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBlob);
  } catch {
    return {
      success: false,
      importedAsCurrent: 0,
      importedAsHistory: 0,
      skipped: 0,
      attachmentsRestored: 0,
      errors: ["Invalid ZIP file"],
      details: [],
    };
  }

  const dataFile = zip.file("data.json");
  if (!dataFile) {
    return {
      success: false,
      importedAsCurrent: 0,
      importedAsHistory: 0,
      skipped: 0,
      attachmentsRestored: 0,
      errors: ["ZIP file missing data.json"],
      details: [],
    };
  }

  onProgress?.(20, "Parsing data...");

  const jsonString = await dataFile.async("string");
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch {
    return {
      success: false,
      importedAsCurrent: 0,
      importedAsHistory: 0,
      skipped: 0,
      attachmentsRestored: 0,
      errors: ["Invalid JSON in data.json"],
      details: [],
    };
  }

  if (!validateExportData(data)) {
    return {
      success: false,
      importedAsCurrent: 0,
      importedAsHistory: 0,
      skipped: 0,
      attachmentsRestored: 0,
      errors: ["Invalid export data structure"],
      details: [],
    };
  }

  onProgress?.(40, "Processing assessments...");

  const result = await processImport(data, (p, m) => {
    onProgress?.(40 + p * 0.3, m);
  });

  // Import attachments
  onProgress?.(70, "Importing attachments...");

  let attachmentsRestored = 0;
  const attachmentsFolder = zip.folder("attachments");
  if (attachmentsFolder) {
    const attachmentFiles: { path: string; file: JSZip.JSZipObject }[] = [];

    attachmentsFolder.forEach((relativePath, file) => {
      if (!file.dir) {
        attachmentFiles.push({ path: relativePath, file });
      }
    });

    for (const { path, file } of attachmentFiles) {
      try {
        const fileName = path.split("/").pop() ?? "";
        const attachmentId = extractAttachmentIdFromFileName(fileName);

        let attachmentMeta = attachmentId
          ? data.data.attachments.find((a) => a.id === attachmentId)
          : null;

        if (!attachmentMeta) {
          attachmentMeta = data.data.attachments.find((a) => a.fileName === fileName);
        }

        if (attachmentMeta) {
          const existing = await db.attachments.get(attachmentMeta.id);
          if (!existing) {
            const blob = await file.async("blob");

            // Find the assessment
            const importedAssessment = data.data.assessments.find(
              (a) => a.id === attachmentMeta.capabilityAssessmentId
            );

            if (importedAssessment) {
              const assessment = await db.capabilityAssessments
                .where("capabilityCode")
                .equals(importedAssessment.capabilityCode)
                .first();

              if (assessment) {
                // Find the rating
                const importedRating = data.data.ratings.find(
                  (r) => r.id === attachmentMeta.ratingId
                );

                if (importedRating) {
                  const rating = await db.ratings
                    .where("[capabilityAssessmentId+questionIndex]")
                    .equals([assessment.id, importedRating.questionIndex])
                    .first();

                  if (rating) {
                    const attachment: Attachment = {
                      id: uuidv4(),
                      capabilityAssessmentId: assessment.id,
                      ratingId: rating.id,
                      fileName: attachmentMeta.fileName,
                      fileType: attachmentMeta.fileType,
                      fileSize: attachmentMeta.fileSize,
                      blob,
                      description: attachmentMeta.description,
                      uploadedAt: new Date(attachmentMeta.uploadedAt),
                    };

                    await db.attachments.add(attachment);

                    await db.ratings.update(rating.id, {
                      attachmentIds: [...(rating.attachmentIds || []), attachment.id],
                    });

                    attachmentsRestored++;
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to import attachment:", path, error);
      }
    }
  }

  result.attachmentsRestored = attachmentsRestored;

  onProgress?.(100, "Complete");

  return result;
}

/**
 * Core import processing logic
 */
async function processImport(
  data: ExportData,
  onProgress?: ImportProgressCallback
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    importedAsCurrent: 0,
    importedAsHistory: 0,
    skipped: 0,
    attachmentsRestored: 0,
    errors: [],
    details: [],
  };

  const totalAssessments = data.data.assessments.length;

  for (let i = 0; i < data.data.assessments.length; i++) {
    const importedAssessment = data.data.assessments[i];
    if (!importedAssessment) continue;

    const progress = Math.round(((i + 1) / totalAssessments) * 100);
    onProgress?.(progress, `Processing ${importedAssessment.processName}...`);

    try {
      const itemResult = await processAssessmentImport(importedAssessment, data);
      result.details.push(itemResult);

      switch (itemResult.action) {
        case "imported_current":
          result.importedAsCurrent++;
          break;
        case "imported_history":
          result.importedAsHistory++;
          break;
        case "skipped":
          result.skipped++;
          break;
        case "error":
          result.errors.push(itemResult.reason ?? "Unknown error");
          break;
      }
    } catch (error) {
      result.errors.push(`Failed to import ${importedAssessment.processName}: ${error}`);
      result.details.push({
        capabilityCode: importedAssessment.capabilityCode,
        capabilityName: importedAssessment.processName,
        action: "error",
        reason: String(error),
      });
    }
  }

  // Import tags
  for (const tag of data.data.tags) {
    const existing = await db.tags.where("name").equals(tag.name).first();
    if (!existing) {
      await db.tags.add({
        ...tag,
        lastUsed: new Date(tag.lastUsed),
      });
    }
  }

  // Import history entries
  for (const historyEntry of data.data.history) {
    const existing = await db.assessmentHistory.get(historyEntry.id);
    if (!existing) {
      await db.assessmentHistory.add({
        ...historyEntry,
        snapshotDate: new Date(historyEntry.snapshotDate),
      });
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Processes a single assessment import with merge logic
 */
async function processAssessmentImport(
  importedAssessment: ExportData["data"]["assessments"][0],
  data: ExportData
): Promise<ImportItemResult> {
  const capabilityCode = importedAssessment.capabilityCode;

  const importedRatings = data.data.ratings.filter(
    (r) => r.capabilityAssessmentId === importedAssessment.id
  );

  const existingAssessment = await db.capabilityAssessments
    .where("capabilityCode")
    .equals(capabilityCode)
    .first();

  const importedDate = new Date(importedAssessment.updatedAt);

  if (!existingAssessment) {
    // No existing - import as current
    const newAssessmentId = uuidv4();

    await db.capabilityAssessments.add({
      id: newAssessmentId,
      capabilityCode: importedAssessment.capabilityCode,
      businessArea: importedAssessment.businessArea,
      processName: importedAssessment.processName,
      status: importedAssessment.status,
      tags: importedAssessment.tags,
      blueprintVersion: importedAssessment.blueprintVersion,
      createdAt: new Date(importedAssessment.createdAt),
      updatedAt: importedDate,
      finalizedAt: importedAssessment.finalizedAt
        ? new Date(importedAssessment.finalizedAt)
        : undefined,
      score: importedAssessment.score,
    });

    for (const rating of importedRatings) {
      await db.ratings.add({
        id: uuidv4(),
        capabilityAssessmentId: newAssessmentId,
        questionIndex: rating.questionIndex,
        level: rating.level,
        previousLevel: rating.previousLevel,
        notes: rating.notes,
        carriedForward: rating.carriedForward,
        attachmentIds: [],
        updatedAt: new Date(rating.updatedAt),
      });
    }

    return {
      capabilityCode,
      capabilityName: importedAssessment.processName,
      action: "imported_current",
    };
  }

  // Existing assessment found - compare timestamps
  const existingDate = existingAssessment.updatedAt;
  const timeDiff = Math.abs(importedDate.getTime() - existingDate.getTime());

  const isSameData =
    timeDiff < 1000 &&
    importedAssessment.score !== undefined &&
    existingAssessment.score !== undefined &&
    Math.abs(importedAssessment.score - existingAssessment.score) < 0.01;

  if (isSameData) {
    return {
      capabilityCode,
      capabilityName: importedAssessment.processName,
      action: "skipped",
      reason: "Identical to current assessment",
    };
  }

  if (importedDate > existingDate) {
    // Imported is newer - move existing to history, import as current

    const existingRatings = await db.ratings
      .where("capabilityAssessmentId")
      .equals(existingAssessment.id)
      .toArray();

    if (existingAssessment.status === "finalized" && existingAssessment.score) {
      const historySnapshot = createHistorySnapshot(
        existingAssessment,
        existingRatings,
        existingAssessment.score
      );
      await db.assessmentHistory.add(historySnapshot);
    }

    // Delete existing ratings
    await db.ratings.where("capabilityAssessmentId").equals(existingAssessment.id).delete();

    // Update existing assessment with imported data
    await db.capabilityAssessments.update(existingAssessment.id, {
      status: importedAssessment.status,
      tags: importedAssessment.tags,
      updatedAt: importedDate,
      finalizedAt: importedAssessment.finalizedAt
        ? new Date(importedAssessment.finalizedAt)
        : undefined,
      score: importedAssessment.score,
    });

    // Add imported ratings
    for (const rating of importedRatings) {
      await db.ratings.add({
        id: uuidv4(),
        capabilityAssessmentId: existingAssessment.id,
        questionIndex: rating.questionIndex,
        level: rating.level,
        previousLevel: rating.previousLevel,
        notes: rating.notes,
        carriedForward: rating.carriedForward,
        attachmentIds: [],
        updatedAt: new Date(rating.updatedAt),
      });
    }

    return {
      capabilityCode,
      capabilityName: importedAssessment.processName,
      action: "imported_current",
      reason: "Replaced older local assessment (moved to history)",
    };
  } else {
    // Imported is older - add to history only

    if (importedAssessment.status === "finalized" && importedAssessment.score) {
      const existingHistory = await db.assessmentHistory
        .where("capabilityCode")
        .equals(capabilityCode)
        .toArray();

      const alreadyExists = existingHistory.some(
        (h) =>
          Math.abs(h.snapshotDate.getTime() - importedDate.getTime()) < 1000 &&
          Math.abs(h.score - importedAssessment.score!) < 0.01
      );

      if (alreadyExists) {
        return {
          capabilityCode,
          capabilityName: importedAssessment.processName,
          action: "skipped",
          reason: "Historical entry already exists",
        };
      }

      const historicalRatings: HistoricalRating[] = importedRatings
        .filter((r) => r.level !== null)
        .map((r) => ({
          questionIndex: r.questionIndex,
          level: r.level as 1 | 2 | 3 | 4 | 5,
          notes: r.notes,
          attachmentIds: r.attachmentIds || [],
        }));

      await db.assessmentHistory.add({
        id: uuidv4(),
        capabilityCode,
        snapshotDate: importedDate,
        tags: importedAssessment.tags,
        score: importedAssessment.score,
        ratings: historicalRatings,
        blueprintVersion: importedAssessment.blueprintVersion,
      });

      return {
        capabilityCode,
        capabilityName: importedAssessment.processName,
        action: "imported_history",
        reason: "Added as historical entry (local is newer)",
      };
    }

    return {
      capabilityCode,
      capabilityName: importedAssessment.processName,
      action: "skipped",
      reason: "Local assessment is newer and imported is not finalized",
    };
  }
}

/**
 * Reads a file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
