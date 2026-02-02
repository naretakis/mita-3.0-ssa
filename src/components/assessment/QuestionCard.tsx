/**
 * Question Card Component
 *
 * Displays a single assessment question with rating options, notes, and attachments.
 */

import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HistoryIcon from "@mui/icons-material/History";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { useRatings } from "../../hooks/useRatings";
import { AttachmentUpload } from "./AttachmentUpload";
import { compactChipSx } from "../../theme/sharedStyles";
import {
  QUESTION_NUMBER_MIN_WIDTH,
  NOTES_TEXTAREA_ROWS,
} from "../../constants/ui";
import type { CapabilityQuestion, Attachment } from "../../types";

interface AttachmentHandlers {
  getAttachmentsForRating: (ratingId: string) => Attachment[];
  uploadAttachment: (
    ratingId: string,
    file: File,
    description?: string,
  ) => Promise<string>;
  deleteAttachment: (attachmentId: string) => Promise<void>;
  downloadAttachment: (attachment: Attachment) => void;
}

interface QuestionCardProps {
  question: CapabilityQuestion;
  questionIndex: number;
  assessmentId: string;
  onDirty: () => void;
  readOnly?: boolean;
  attachmentHandlers: AttachmentHandlers;
}

export function QuestionCard({
  question,
  questionIndex,
  assessmentId,
  onDirty,
  readOnly = false,
  attachmentHandlers,
}: QuestionCardProps) {
  const { getRating, saveRating } = useRatings(assessmentId);
  const rating = getRating(questionIndex);

  // Use rating notes as source of truth, local state only for editing
  const [localNotes, setLocalNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Derive notes value: use local when editing, otherwise use rating
  const notes = isEditingNotes ? localNotes : rating?.notes || "";

  // Derive expanded states from data
  const notesExpanded = readOnly
    ? !!rating?.notes
    : !!rating?.notes || isEditingNotes;

  // Get attachments for this rating
  const attachments = rating?.id
    ? attachmentHandlers.getAttachmentsForRating(rating.id)
    : [];

  // Derive attachments expanded from whether there are attachments
  const [attachmentsManuallyExpanded, setAttachmentsManuallyExpanded] =
    useState(false);
  const attachmentsExpanded =
    attachments.length > 0 || attachmentsManuallyExpanded;

  const handleLevelChange = async (level: 1 | 2 | 3 | 4 | 5) => {
    if (readOnly) return;
    onDirty();
    saveRating(questionIndex, level, notes);
  };

  const handleNotesChange = (value: string) => {
    if (!isEditingNotes) {
      setLocalNotes(rating?.notes || "");
      setIsEditingNotes(true);
    }
    setLocalNotes(value);
  };

  const handleNotesBlur = () => {
    if (readOnly) return;
    if (isEditingNotes && localNotes !== (rating?.notes || "")) {
      onDirty();
      saveRating(questionIndex, rating?.level || null, localNotes);
    }
    setIsEditingNotes(false);
  };

  const handleUpload = async (file: File, description?: string) => {
    if (!rating?.id) {
      // Need to create a rating first - saveRating returns the new rating ID
      const newRatingId = await saveRating(questionIndex, null, notes);
      if (newRatingId) {
        await attachmentHandlers.uploadAttachment(
          newRatingId,
          file,
          description,
        );
      }
    } else {
      await attachmentHandlers.uploadAttachment(rating.id, file, description);
    }
    onDirty();
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    await attachmentHandlers.deleteAttachment(attachmentId);
    onDirty();
  };

  // Check if this level was the previous selection (carry-forward hint)
  const isPreviousLevel = (level: number) => {
    return (
      rating?.carriedForward &&
      rating?.previousLevel === level &&
      rating?.level === null
    );
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Box
          sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1.5 }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ minWidth: QUESTION_NUMBER_MIN_WIDTH }}
          >
            Q{questionIndex + 1}
          </Typography>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ lineHeight: 1.3 }}>
              {question.question}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {question.category}
            </Typography>
          </Box>
          {attachments.length > 0 && (
            <Chip
              icon={<AttachFileIcon />}
              label={attachments.length}
              size="small"
              variant="outlined"
              color="default"
            />
          )}
          {rating?.carriedForward &&
            rating?.previousLevel &&
            !rating?.level && (
              <Chip
                icon={<HistoryIcon />}
                label={`Previously: Level ${rating.previousLevel}`}
                size="small"
                variant="outlined"
                color="info"
              />
            )}
          {rating?.level && (
            <CheckCircleIcon color="success" fontSize="small" />
          )}
        </Box>

        <FormControl component="fieldset" sx={{ width: "100%" }}>
          <RadioGroup value={rating?.level?.toString() || ""}>
            {[1, 2, 3, 4, 5].map((level) => (
              <Box
                key={level}
                sx={{
                  py: 1,
                  px: 1.5,
                  mb: 0.5,
                  borderRadius: 1,
                  border: 2,
                  borderColor:
                    rating?.level === level
                      ? "primary.main"
                      : isPreviousLevel(level)
                        ? "info.main"
                        : "divider",
                  borderStyle: isPreviousLevel(level) ? "dashed" : "solid",
                  backgroundColor:
                    rating?.level === level
                      ? "primary.50"
                      : isPreviousLevel(level)
                        ? "info.50"
                        : "transparent",
                  cursor: readOnly ? "default" : "pointer",
                  opacity: readOnly && rating?.level !== level ? 0.6 : 1,
                  position: "relative",
                  ...(!readOnly && {
                    "&:hover": {
                      borderColor: "primary.light",
                      backgroundColor:
                        rating?.level === level ? "primary.50" : "action.hover",
                    },
                  }),
                }}
                onClick={() => handleLevelChange(level as 1 | 2 | 3 | 4 | 5)}
              >
                <FormControlLabel
                  value={level.toString()}
                  control={
                    <Radio size="small" sx={{ py: 0.5 }} disabled={readOnly} />
                  }
                  label={
                    <Typography variant="body2" component="span">
                      <strong>L{level}:</strong>{" "}
                      <span style={{ color: "inherit" }}>
                        {
                          question.levels[
                            `level_${level}` as keyof typeof question.levels
                          ]
                        }
                      </span>
                    </Typography>
                  }
                  sx={{ m: 0, alignItems: "flex-start" }}
                />
                {isPreviousLevel(level) && (
                  <Chip
                    label="Previous"
                    size="small"
                    color="info"
                    sx={{
                      position: "absolute",
                      top: 4,
                      right: 8,
                      ...compactChipSx,
                    }}
                  />
                )}
              </Box>
            ))}
          </RadioGroup>
        </FormControl>

        {/* Notes section */}
        <Box sx={{ mt: 1.5 }}>
          {!readOnly && (
            <Button
              size="small"
              onClick={() => {
                if (!isEditingNotes) {
                  setLocalNotes(rating?.notes || "");
                  setIsEditingNotes(true);
                } else {
                  handleNotesBlur();
                }
              }}
              sx={{ mb: 1 }}
            >
              {isEditingNotes
                ? "Done"
                : rating?.notes
                  ? "Edit Notes"
                  : "Add Notes"}
            </Button>
          )}
          {notesExpanded &&
            (readOnly ? (
              rating?.notes ? (
                <Box
                  sx={{ p: 1.5, backgroundColor: "grey.50", borderRadius: 1 }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mb: 0.5 }}
                  >
                    Notes
                  </Typography>
                  <Typography variant="body2">{rating.notes}</Typography>
                </Box>
              ) : null
            ) : (
              <TextField
                fullWidth
                multiline
                rows={NOTES_TEXTAREA_ROWS}
                placeholder="Add notes or rationale for your rating..."
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                onBlur={handleNotesBlur}
                size="small"
              />
            ))}
        </Box>

        {/* Attachments section */}
        <Box sx={{ mt: 1.5 }}>
          {!readOnly && (
            <Button
              size="small"
              startIcon={<AttachFileIcon />}
              onClick={() =>
                setAttachmentsManuallyExpanded(!attachmentsManuallyExpanded)
              }
              sx={{ mb: 1 }}
            >
              {attachmentsExpanded
                ? "Hide Attachments"
                : attachments.length > 0
                  ? `Show Attachments (${attachments.length})`
                  : "Add Attachments"}
            </Button>
          )}
          {(attachmentsExpanded || (readOnly && attachments.length > 0)) && (
            <AttachmentUpload
              attachments={attachments}
              onUpload={handleUpload}
              onDelete={handleDeleteAttachment}
              onDownload={attachmentHandlers.downloadAttachment}
              disabled={readOnly}
              uploadId={`q${questionIndex}`}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
