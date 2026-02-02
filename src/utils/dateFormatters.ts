/**
 * Date Formatting Utilities
 *
 * Centralized date formatting functions for consistent display across the app.
 */

/**
 * Format a date as a short date/time string
 * Example: "1/15/2025, 2:30 PM"
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format a date as a short date string
 * Example: "1/15/2025"
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString();
}

/**
 * Format a date as a long date string
 * Example: "January 15, 2025"
 */
export function formatDateLong(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
