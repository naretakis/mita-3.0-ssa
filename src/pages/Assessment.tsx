import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HistoryIcon from '@mui/icons-material/History';
import EditIcon from '@mui/icons-material/Edit';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { useCapabilityAssessment, useCapabilityAssessments } from '../hooks/useCapabilityAssessments';
import { useRatings } from '../hooks/useRatings';
import { useTags } from '../hooks/useTags';
import { useAttachments } from '../hooks/useAttachments';
import { getCapabilityByCode } from '../services/blueprint';
import { db } from '../services/db';
import { AttachmentUpload, BptSidebar } from '../components/assessment';
import type { CapabilityQuestion } from '../types';

const SIDEBAR_WIDTH = 600;

// Question Card Component
function QuestionCard({
  question,
  questionIndex,
  assessmentId,
  onDirty,
  readOnly = false,
  attachmentHandlers,
}: {
  question: CapabilityQuestion;
  questionIndex: number;
  assessmentId: string;
  onDirty: () => void;
  readOnly?: boolean;
  attachmentHandlers: {
    getAttachmentsForRating: (ratingId: string) => ReturnType<typeof useAttachments>['attachments'];
    uploadAttachment: (ratingId: string, file: File, description?: string) => Promise<string>;
    deleteAttachment: (attachmentId: string) => Promise<void>;
    downloadAttachment: (attachment: ReturnType<typeof useAttachments>['attachments'][0]) => void;
  };
}) {
  const { getRating, saveRating } = useRatings(assessmentId);
  const rating = getRating(questionIndex);
  
  // Use rating notes as source of truth, local state only for editing
  const [localNotes, setLocalNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  
  // Derive notes value: use local when editing, otherwise use rating
  const notes = isEditingNotes ? localNotes : (rating?.notes || '');
  
  // Derive expanded states from data
  const notesExpanded = readOnly ? !!rating?.notes : (!!rating?.notes || isEditingNotes);
  
  // Get attachments for this rating
  const attachments = rating?.id ? attachmentHandlers.getAttachmentsForRating(rating.id) : [];
  
  // Derive attachments expanded from whether there are attachments
  const [attachmentsManuallyExpanded, setAttachmentsManuallyExpanded] = useState(false);
  const attachmentsExpanded = attachments.length > 0 || attachmentsManuallyExpanded;

  const handleLevelChange = async (level: 1 | 2 | 3 | 4 | 5) => {
    if (readOnly) return;
    onDirty();
    saveRating(questionIndex, level, notes);
  };

  const handleNotesChange = (value: string) => {
    if (!isEditingNotes) {
      setLocalNotes(rating?.notes || '');
      setIsEditingNotes(true);
    }
    setLocalNotes(value);
  };

  const handleNotesBlur = () => {
    if (readOnly) return;
    if (isEditingNotes && localNotes !== (rating?.notes || '')) {
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
        await attachmentHandlers.uploadAttachment(newRatingId, file, description);
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
    return rating?.carriedForward && rating?.previousLevel === level && rating?.level === null;
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 24 }}>
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
          {rating?.carriedForward && rating?.previousLevel && !rating?.level && (
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

        <FormControl component="fieldset" sx={{ width: '100%' }}>
          <RadioGroup value={rating?.level?.toString() || ''}>
            {[1, 2, 3, 4, 5].map((level) => (
              <Box
                key={level}
                sx={{
                  py: 1,
                  px: 1.5,
                  mb: 0.5,
                  borderRadius: 1,
                  border: 2,
                  borderColor: rating?.level === level 
                    ? 'primary.main' 
                    : isPreviousLevel(level) 
                      ? 'info.main' 
                      : 'divider',
                  borderStyle: isPreviousLevel(level) ? 'dashed' : 'solid',
                  backgroundColor: rating?.level === level 
                    ? 'primary.50' 
                    : isPreviousLevel(level)
                      ? 'info.50'
                      : 'transparent',
                  cursor: readOnly ? 'default' : 'pointer',
                  opacity: readOnly && rating?.level !== level ? 0.6 : 1,
                  position: 'relative',
                  ...(!readOnly && {
                    '&:hover': {
                      borderColor: 'primary.light',
                      backgroundColor: rating?.level === level ? 'primary.50' : 'action.hover',
                    },
                  }),
                }}
                onClick={() => handleLevelChange(level as 1 | 2 | 3 | 4 | 5)}
              >
                <FormControlLabel
                  value={level.toString()}
                  control={<Radio size="small" sx={{ py: 0.5 }} disabled={readOnly} />}
                  label={
                    <Typography variant="body2" component="span">
                      <strong>L{level}:</strong>{' '}
                      <span style={{ color: 'inherit' }}>
                        {question.levels[`level_${level}` as keyof typeof question.levels]}
                      </span>
                    </Typography>
                  }
                  sx={{ m: 0, alignItems: 'flex-start' }}
                />
                {isPreviousLevel(level) && (
                  <Chip
                    label="Previous"
                    size="small"
                    color="info"
                    sx={{ 
                      position: 'absolute', 
                      top: 4, 
                      right: 8,
                      height: 20,
                      fontSize: '0.65rem',
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
                  setLocalNotes(rating?.notes || '');
                  setIsEditingNotes(true);
                } else {
                  handleNotesBlur();
                }
              }}
              sx={{ mb: 1 }}
            >
              {isEditingNotes ? 'Done' : (rating?.notes ? 'Edit Notes' : 'Add Notes')}
            </Button>
          )}
          {notesExpanded && (
            readOnly ? (
              rating?.notes ? (
                <Box sx={{ p: 1.5, backgroundColor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Notes
                  </Typography>
                  <Typography variant="body2">{rating.notes}</Typography>
                </Box>
              ) : null
            ) : (
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Add notes or rationale for your rating..."
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                onBlur={handleNotesBlur}
                size="small"
              />
            )
          )}
        </Box>

        {/* Attachments section */}
        <Box sx={{ mt: 1.5 }}>
          {!readOnly && (
            <Button
              size="small"
              startIcon={<AttachFileIcon />}
              onClick={() => setAttachmentsManuallyExpanded(!attachmentsManuallyExpanded)}
              sx={{ mb: 1 }}
            >
              {attachmentsExpanded 
                ? 'Hide Attachments' 
                : attachments.length > 0 
                  ? `Show Attachments (${attachments.length})` 
                  : 'Add Attachments'}
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

// Tag Input Component
function TagInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const { tags: allTags, normalizeTag, isValidTag } = useTags();
  const [inputValue, setInputValue] = useState('');

  const suggestions = allTags.map(t => t.name);

  const commitTag = (value: string) => {
    if (!value.trim()) return;
    const normalized = normalizeTag(value.trim());
    if (isValidTag(value) && !tags.includes(normalized)) {
      onChange([...tags, normalized]);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && inputValue.trim()) {
      event.preventDefault();
      commitTag(inputValue);
      setInputValue('');
    }
  };

  const handleBlur = () => {
    // Commit any pending input when user clicks away
    if (inputValue.trim()) {
      commitTag(inputValue);
      setInputValue('');
    }
  };

  return (
    <Box>
      <Autocomplete
        multiple
        freeSolo
        size="small"
        options={suggestions}
        value={tags}
        inputValue={inputValue}
        onInputChange={(_, newValue) => setInputValue(newValue)}
        onChange={(_, newValue) => {
          const normalized = newValue.map(v => normalizeTag(v));
          onChange(normalized.filter((v, i, arr) => arr.indexOf(v) === i));
        }}
        onBlur={handleBlur}
        renderInput={(params) => (
          <TextField 
            {...params} 
            placeholder={tags.length === 0 ? "Add tags (e.g., #provider-module)" : ""}
            onKeyDown={handleKeyDown}
          />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip {...getTagProps({ index })} key={option} label={option} size="small" />
          ))
        }
      />
    </Box>
  );
}

export default function Assessment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Check if we're in view-only mode
  const isViewMode = searchParams.get('mode') === 'view';

  const { assessment } = useCapabilityAssessment(id);
  const { finalizeAssessment, updateTags, discardAssessment, revertEdit } = useCapabilityAssessments();
  const { getProgress, getAnsweredCount, getAverageScore } = useRatings(id);
  const { getAttachmentsForRating, uploadAttachment, deleteAttachment, downloadAttachment } = useAttachments(id);

  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_WIDTH);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  
  // Track if user has made any changes (dirty state)
  const [isDirty, setIsDirty] = useState(false);
  // Track if this assessment has history (was previously finalized)
  const [hasHistory, setHasHistory] = useState(false);
  
  // Track original status - initialized once when assessment loads
  const [originalStatus, setOriginalStatus] = useState<'in_progress' | 'finalized' | null>(null);
  const [tagsInitialized, setTagsInitialized] = useState(false);
  const [localTags, setLocalTags] = useState<string[]>([]);

  // Get capability data
  const capability = useMemo(() => {
    if (!assessment) return null;
    return getCapabilityByCode(assessment.capabilityCode);
  }, [assessment]);

  const totalQuestions = capability?.bcm.maturity_model.capability_questions.length || 0;
  const progress = getProgress(totalQuestions);
  const answeredCount = getAnsweredCount();

  // Initialize original status once when assessment first loads
  // This is a one-time initialization, not a sync pattern
  useEffect(() => {
    if (assessment && originalStatus === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- One-time initialization
      setOriginalStatus(assessment.status);
    }
  }, [assessment, originalStatus]);
  
  // Initialize local tags once when assessment first loads
  useEffect(() => {
    if (assessment?.tags && !tagsInitialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- One-time initialization
      setLocalTags(assessment.tags);
      setTagsInitialized(true);
    }
  }, [assessment?.tags, tagsInitialized]);

  // Check if this assessment has history (was previously finalized)
  useEffect(() => {
    let cancelled = false;
    if (assessment) {
      db.assessmentHistory
        .where('capabilityCode')
        .equals(assessment.capabilityCode)
        .count()
        .then(count => {
          if (!cancelled) setHasHistory(count > 0);
        });
    }
    return () => { cancelled = true; };
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
      navigate('/dashboard');
    }
  };

  const handleClose = () => {
    // Close just navigates back - changes are already auto-saved
    // If dirty and was finalized, the edit has already been triggered
    navigate('/dashboard');
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
    navigate('/dashboard');
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
      return 'Discard all changes made during this edit session? The assessment will be restored to its previous finalized state.';
    }
    return 'Discard this assessment? All ratings and notes will be permanently deleted.';
  };

  const showCancelWarning = true; // Always show warning since cancel has consequences

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
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
      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Sticky header */}
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            backgroundColor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
              <Typography variant="h5" sx={{ flexShrink: 0 }}>
                {capability.processName}
              </Typography>
              {isViewMode && (
                <Chip 
                  label="View Only" 
                  size="small" 
                  sx={{ flexShrink: 0 }}
                />
              )}
              {/* Tags inline */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {isViewMode ? (
                  localTags.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {localTags.map(tag => (
                        <Chip key={tag} label={tag} size="small" />
                      ))}
                    </Box>
                  ) : null
                ) : (
                  <TagInput 
                    tags={localTags} 
                    onChange={handleTagsChange}
                  />
                )}
              </Box>
            </Box>

            {/* Progress / Score on the right */}
            {isViewMode ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Score</Typography>
                  <Typography variant="h6" color="primary">
                    {getAverageScore()?.toFixed(1) || '—'} / 5.0
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Answered</Typography>
                  <Typography variant="h6">
                    {answeredCount}/{totalQuestions}
                  </Typography>
                </Box>
                {assessment?.finalizedAt && (
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary">Finalized</Typography>
                    <Typography variant="h6">
                      {new Date(assessment.finalizedAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 100, maxWidth: 150, flexShrink: 0 }}>
                <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4, width: '100%' }} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
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

          {capability.bcm.maturity_model.capability_questions.map((question, index) => (
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
          ))}

          {/* Action buttons */}
          {isViewMode ? (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, mb: 2, gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => navigate('/dashboard')}
              >
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, mb: 2, gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    onClick={handleClose}
                  >
                    Close
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => showCancelWarning ? setCancelDialogOpen(true) : navigate('/dashboard')}
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
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                  Answer all questions to finalize the assessment
                </Typography>
              )}

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                <strong>Close</strong> saves your progress. <strong>Cancel</strong> discards changes.
              </Typography>
            </>
          )}
        </Box>
      </Box>

      {/* Finalize Dialog */}
      <Dialog open={finalizeDialogOpen} onClose={() => setFinalizeDialogOpen(false)}>
        <DialogTitle>Finalize Assessment?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Finalize this assessment for "{capability.processName}"? 
            {localTags.length > 0 && (
              <> This assessment will be tagged with: {localTags.join(', ')}.</>
            )}
            {' '}You can edit it later if needed.
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
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>
          {originalStatus === 'finalized' ? 'Discard Changes?' : 'Discard Assessment?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {getCancelDialogContent()}
          </DialogContentText>
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
