/**
 * Capability Progress Bar Component
 *
 * Displays a simple progress bar for individual capability rows.
 * Shows completion percentage with different styles for finalized vs in-progress.
 */

import { Box } from "@mui/material";
import { getInProgressGradient } from "../../theme/sharedStyles";
import {
  PROGRESS_BAR_HEIGHT_SMALL,
  PROGRESS_STRIPE_WIDTH,
} from "../../constants/ui";

interface CapabilityProgressBarProps {
  status: "not_assessed" | "in_progress" | "finalized";
  progress: number; // 0-100 for question completion
}

export function CapabilityProgressBar({
  status,
  progress,
}: CapabilityProgressBarProps) {
  const isFinalized = status === "finalized";
  const isInProgress = status === "in_progress";
  const displayProgress = isFinalized ? 100 : progress;

  return (
    <Box
      sx={{
        height: PROGRESS_BAR_HEIGHT_SMALL,
        borderRadius: 1,
        overflow: "hidden",
        backgroundColor: "grey.200",
      }}
    >
      {displayProgress > 0 && (
        <Box
          sx={{
            width: `${displayProgress}%`,
            height: "100%",
            ...(isFinalized
              ? {
                  backgroundColor: "success.main",
                }
              : isInProgress
                ? {
                    background: getInProgressGradient(
                      PROGRESS_STRIPE_WIDTH.medium,
                    ),
                  }
                : {
                    backgroundColor: "grey.300",
                  }),
          }}
        />
      )}
    </Box>
  );
}
