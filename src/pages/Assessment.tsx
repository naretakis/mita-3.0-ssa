import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import EditIcon from "@mui/icons-material/Edit";
import {
  useCapabilityAssessment,
  useCapabilityAssessments,
} from "../hooks/useCapabilityAssessments";
import { useRatings } from "../hooks/useRatings";
import { useAttachments } from "../hooks/useAttachments";
import { getCapabilityByCode } from "../services/blueprint";
import { db } from "../services/db";
import { BptSidebar, QuestionCard, TagInput } from "../components/assessment";
import { formatDate } from "../utils/dateFormatters";
import {
  HEADER_HEIGHT,
  LINEAR_PROGRESS_HEIGHT,
  PROGRESS_CONTAINER_MAX_WIDTH,
  PROGRESS_CONTAINER_MIN_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  STICKY_HEADER_Z_INDEX,
} from "../constants/ui";

export default function Assessment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Check if we're in view-only mode
  const isViewMode = searchParams.get("mode") === "view";

  const { assessment } = useCapabilityAssessment(id);
  const { finalizeAssessment, updateTags, discardAssessment, revertEdit } =
    useCapabilityAssessments();
  const { getProgress, getAnsweredCount, getAverageScore } = useRatings(id);
  const {
    getAttachmentsForRating,
    uploadAttachment,
    deleteAttachment,
    downloadAttachment,
  } = useAttachments(id);

  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Track if user has made any changes (dirty state)
  const [isDirty, setIsDirty] = useState(false);
  // Track if this assessment has history (was previously finalized)
  const [hasHistory, setHasHistory] = useState(false);

  // Track original status - captured on first render when assessment is available
  // Using a key pattern: store the assessment ID we captured status for
  const [capturedAssessmentId, setCapturedAssessmentId] = useState<
    string | null
  >(null);
  const [originalStatus, setOriginalStatus] = useState<
    "in_progress" | "finalized" | null
  >(null);

  // Track tags - captured on first render when assessment is available
  const [capturedTagsForId, setCapturedTagsForId] = useState<string | null>(
    null,
  );
  const [localTags, setLocalTags] = useState<string[]>([]);

  // Get capability data
  const capability = useMemo(() => {
    if (!assessment) return null;
    return getCapabilityByCode(assessment.capabilityCode);
  }, [assessment]);

  const totalQuestions =
    capability?.bcm.maturity_model.capability_questions.length || 0;
  const progress = getProgress(totalQuestions);
  const answeredCount = getAnsweredCount();

  // Capture original status when assessment first loads (or when ID changes)
  // This is a "sync external state" pattern - we're syncing from the database
  if (assessment && capturedAssessmentId !== assessment.id) {
    setCapturedAssessmentId(assessment.id);
    setOriginalStatus(assessment.status);
  }

  // Capture tags when assessment first loads (or when ID changes)
  if (assessment?.tags && capturedTagsForId !== assessment.id) {
    setCapturedTagsForId(assessment.id);
    setLocalTags(assessment.tags);
  }

  // Check if this assessment has history (was previously finalized)
  useEffect(() => {
    let cancelled = false;
    if (assessment) {
      db.assessmentHistory
        .where("capabilityCode")
        .equals(assessment.capabilityCode)
        .count()
        .then((count) => {
          if (!cancelled) setHasHistory(count > 0);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [assessment]);

  // Mark as dirty when user makes changes
  const markDirty = useCallback(() => {
    if (!isDirty) {
      setIsDirty(true);
    }
  }, [isDirty]);

  const handleTagsChange = async (newTags: string[]) => {
    setLocalTags(newTags);
    if (id) {
      markDirty();
      updateTags(id, newTags);
    }
  };

  const handleFinalize = async () => {
    if (id) {
      // Save tags one more time before finalizing to ensure they're persisted
      await updateTags(id, localTags);
      await finalizeAssessment(id);
      setFinalizeDialogOpen(false);
      navigate("/dashboard");
    }
  };

  const handleClose = () => {
    // Close just navigates back - changes are already auto-saved
    navigate("/dashboard");
  };

  const handleCancel = async () => {
    if (!id || !assessment) return;

    if (hasHistory) {
      // Was editing a finalized assessment - revert to previous state
      await revertEdit(id);
    } else {
      // Was a new in-progress assessment - delete it entirely
      await discardAssessment(id);
    }

    setCancelDialogOpen(false);
    navigate("/dashboard");
  };

  if (!assessment || !capability) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  // Determine cancel dialog message based on context
  const getCancelDialogContent = () => {
    if (hasHistory) {
      return "Discard all changes made during this edit session? The assessment will be restored to its previous finalized state.";
    }
    return "Discard this assessment? All ratings and notes will be permanently deleted.";
  };

  const showCancelWarning = true; // Always show warning since cancel has consequences

  return (
    <Box sx={{ display: "flex", height: `calc(100vh - ${HEADER_HEIGHT}px)` }}>
      {/* BPT Sidebar */}
      <BptSidebar
        bpt={capability.bpt}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isMobile={isMobile}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Main content */}
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Sticky header */}
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: STICKY_HEADER_Z_INDEX,
            backgroundColor: "background.paper",
            borderBottom: 1,
            borderColor: "divider",
            px: 3,
            py: 2,
          }}
        >
          {isMobile && (
            <Button
              startIcon={<MenuIcon />}
              onClick={() => setSidebarOpen(true)}
              size="small"
              sx={{ mb: 1 }}
            >
              Show Process Details
            </Button>
          )}

          <Typography variant="overline" color="text.secondary">
            {capability.businessArea}
          </Typography>

          {/* Title row with tags and progress */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                flex: 1,
                minWidth: 0,
              }}
            >
              <Typography variant="h5" sx={{ flexShrink: 0 }}>
                {capability.processName}
              </Typography>
              {isViewMode && (
                <Chip label="View Only" size="small" sx={{ flexShrink: 0 }} />
              )}
              {/* Tags inline */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {isViewMode ? (
                  localTags.length > 0 ? (
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {localTags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" />
                      ))}
                    </Box>
                  ) : null
                ) : (
                  <TagInput tags={localTags} onChange={handleTagsChange} />
                )}
              </Box>
            </Box>

            {/* Progress / Score on the right */}
            {isViewMode ? (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  flexShrink: 0,
                }}
              >
                <Box sx={{ textAlign: "right" }}>
                  <Typography variant="caption" color="text.secondary">
                    Score
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {getAverageScore()?.toFixed(1) || "—"} / 5.0
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography variant="caption" color="text.secondary">
                    Answered
                  </Typography>
                  <Typography variant="h6">
                    {answeredCount}/{totalQuestions}
                  </Typography>
                </Box>
                {assessment?.finalizedAt && (
                  <Box sx={{ textAlign: "right" }}>
                    <Typography variant="caption" color="text.secondary">
                      Finalized
                    </Typography>
                    <Typography variant="h6">
                      {formatDate(assessment.finalizedAt)}
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  minWidth: PROGRESS_CONTAINER_MIN_WIDTH,
                  maxWidth: PROGRESS_CONTAINER_MAX_WIDTH,
                  flexShrink: 0,
                }}
              >
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{
                    height: LINEAR_PROGRESS_HEIGHT,
                    borderRadius: 4,
                    width: "100%",
                  }}
                />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  {answeredCount}/{totalQuestions} ({progress}%)
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Scrollable content */}
        <Box sx={{ flex: 1, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Maturity Assessment
          </Typography>

          {capability.bcm.maturity_model.capability_questions.map(
            (question, index) => (
              <QuestionCard
                key={index}
                question={question}
                questionIndex={index}
                assessmentId={id!}
                onDirty={markDirty}
                readOnly={isViewMode}
                attachmentHandlers={{
                  getAttachmentsForRating,
                  uploadAttachment,
                  deleteAttachment,
                  downloadAttachment,
                }}
              />
            ),
          )}

          {/* Action buttons */}
          {isViewMode ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                mt: 4,
                mb: 2,
                gap: 2,
              }}
            >
              <Button variant="outlined" onClick={() => navigate("/dashboard")}>
                Back to Dashboard
              </Button>
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => navigate(`/assessment/${id}`)}
              >
                Switch to Edit
              </Button>
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mt: 4,
                  mb: 2,
                  gap: 2,
                }}
              >
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button variant="outlined" onClick={handleClose}>
                    Close
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() =>
                      showCancelWarning
                        ? setCancelDialogOpen(true)
                        : navigate("/dashboard")
                    }
                  >
                    Cancel
                  </Button>
                </Box>
                <Button
                  variant="contained"
                  onClick={() => setFinalizeDialogOpen(true)}
                  disabled={progress < 100}
                >
                  Finalize Assessment
                </Button>
              </Box>

              {progress < 100 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", textAlign: "center" }}
                >
                  Answer all questions to finalize the assessment
                </Typography>
              )}

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", textAlign: "center", mt: 1 }}
              >
                <strong>Close</strong> saves your progress.{" "}
                <strong>Cancel</strong> discards changes.
              </Typography>
            </>
          )}
        </Box>
      </Box>

      {/* Finalize Dialog */}
      <Dialog
        open={finalizeDialogOpen}
        onClose={() => setFinalizeDialogOpen(false)}
      >
        <DialogTitle>Finalize Assessment?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Finalize this assessment for "{capability.processName}"?
            {localTags.length > 0 && (
              <> This assessment will be tagged with: {localTags.join(", ")}.</>
            )}{" "}
            You can edit it later if needed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFinalizeDialogOpen(false)}>Back</Button>
          <Button onClick={handleFinalize} variant="contained">
            Finalize
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
      >
        <DialogTitle>
          {originalStatus === "finalized"
            ? "Discard Changes?"
            : "Discard Assessment?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{getCancelDialogContent()}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Back</Button>
          <Button onClick={handleCancel} color="error" variant="contained">
            Discard
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
