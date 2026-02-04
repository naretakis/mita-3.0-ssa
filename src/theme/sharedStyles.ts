/**
 * Shared Styles
 *
 * Reusable style objects and generators for consistent UI across the app.
 */

import type { SxProps, Theme } from "@mui/material";
import {
  COMPACT_CHIP_HEIGHT,
  COMPACT_CHIP_FONT_SIZE,
  LIST_ITEM_ICON_MIN_WIDTH,
  PROGRESS_STRIPE_WIDTH,
} from "../constants/ui";

/**
 * Generate striped gradient for in-progress status
 * @param stripeWidth - Width of each stripe in pixels (default: 4)
 */
export function getInProgressGradient(stripeWidth: number = PROGRESS_STRIPE_WIDTH.large): string {
  return `repeating-linear-gradient(
    -45deg,
    #81c784,
    #81c784 ${stripeWidth}px,
    #a5d6a7 ${stripeWidth}px,
    #a5d6a7 ${stripeWidth * 2}px
  )`;
}

/**
 * Common chip styling for compact tags throughout the app
 */
export const compactChipSx: SxProps<Theme> = {
  height: COMPACT_CHIP_HEIGHT,
  fontSize: COMPACT_CHIP_FONT_SIZE,
};

/**
 * List item icon styling for dense lists
 */
export const listItemIconSx: SxProps<Theme> = {
  minWidth: LIST_ITEM_ICON_MIN_WIDTH,
};
