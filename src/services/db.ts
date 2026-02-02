import Dexie, { type EntityTable } from "dexie";
import type {
  CapabilityAssessment,
  Rating,
  AssessmentHistory,
  Tag,
  Attachment,
} from "../types";

// ============================================
// Database Definition - v2.0
// ============================================

const db = new Dexie("MitaSSADatabase") as Dexie & {
  capabilityAssessments: EntityTable<CapabilityAssessment, "id">;
  ratings: EntityTable<Rating, "id">;
  assessmentHistory: EntityTable<AssessmentHistory, "id">;
  tags: EntityTable<Tag, "id">;
  attachments: EntityTable<Attachment, "id">;
};

// Fresh v2.0 schema - clean slate
db.version(3).stores({
  capabilityAssessments: "id, capabilityCode, status, updatedAt",
  ratings: "id, capabilityAssessmentId, [capabilityAssessmentId+questionIndex]",
  assessmentHistory: "id, capabilityCode, snapshotDate",
  tags: "id, name, usageCount, lastUsed",
});

// v4: Add compound index for ratings to prevent duplicates
db.version(4).stores({
  capabilityAssessments: "id, capabilityCode, status, updatedAt",
  ratings: "id, capabilityAssessmentId, [capabilityAssessmentId+questionIndex]",
  assessmentHistory: "id, capabilityCode, snapshotDate",
  tags: "id, name, usageCount, lastUsed",
});

// v5: Add attachments table for file storage
db.version(5).stores({
  capabilityAssessments: "id, capabilityCode, status, updatedAt",
  ratings: "id, capabilityAssessmentId, [capabilityAssessmentId+questionIndex]",
  assessmentHistory: "id, capabilityCode, snapshotDate",
  tags: "id, name, usageCount, lastUsed",
  attachments: "id, capabilityAssessmentId, ratingId, uploadedAt",
});

export { db };
