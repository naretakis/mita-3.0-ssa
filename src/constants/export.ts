/**
 * Export/Import Constants
 *
 * Configuration values for export and import operations.
 */

/** Max characters for capability description before truncation in PDF */
export const PDF_DESCRIPTION_MAX_LENGTH = 300;

/** Maximum attachment file size (10MB) */
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

/** Tolerance for timestamp comparison during import (ms) */
export const TIMESTAMP_TOLERANCE_MS = 1000;

/** Tolerance for score comparison during import */
export const SCORE_TOLERANCE = 0.01;

/** Maximum import results to show before "and N more" */
export const MAX_VISIBLE_IMPORT_RESULTS = 10;
