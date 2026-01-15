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
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HistoryIcon from '@mui/icons-material/History';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EditIcon from '@mui/icons-material/Edit';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useCapabilityAssessment, useCapabilityAssessments } from '../hooks/useCapabilityAssessments';
import { useRatings } from '../hooks/useRatings';
import { useTags } from '../hooks/useTags';
import { getCapabilityByCode } from '../services/blueprint';
import { db } from '../services/db';
import type { CapabilityQuestion } from '../types';

const SIDEBAR_WIDTH = 600;
const SIDEBAR_WIDTH_MOBILE = 320;
const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 800;

// Helper to render formatted BPT description with notes, paragraphs, and lists
function FormattedDescription({ text }: { text: string }) {
  // Split by newlines to get paragraphs/lines
  const lines = text.split('\n');
  
  const elements: React.ReactNode[] = [];
  let currentListItems: { indent: number; marker: string; text: string }[] = [];
  
  const flushList = () => {
    if (currentListItems.length > 0) {
      elements.push(
        <Box key={`list-${elements.length}`} sx={{ mb: 1.5 }}>
          {currentListItems.map((item, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                pl: item.indent * 2,
                mb: 0.5,
              }}
            >
              <Typography
                component="span"
                variant="body2"
                sx={{
                  color: item.marker === '✓' ? 'success.main' : 'text.secondary',
                  fontWeight: item.marker === '✓' ? 600 : 400,
                  flexShrink: 0,
                  minWidth: item.marker === '✓' ? 16 : 12,
                }}
              >
                {item.marker}
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                {item.text}
              </Typography>
            </Box>
          ))}
        </Box>
      );
      currentListItems = [];
    }
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (!trimmed) continue;
    
    // Check for different list item types
    // Level 1: • bullet
    const bulletMatch = trimmed.match(/^[•]\s*(.+)$/);
    // Level 2: - dash
    const dashMatch = trimmed.match(/^[-–]\s*(.+)$/);
    // Special: ✓ checkmark (verification items)
    const checkMatch = trimmed.match(/^[✓]\s*(.+)$/);
    
    if (bulletMatch) {
      currentListItems.push({ indent: 0, marker: '•', text: bulletMatch[1] });
      continue;
    }
    
    if (dashMatch) {
      currentListItems.push({ indent: 1, marker: '–', text: dashMatch[1] });
      continue;
    }
    
    if (checkMatch) {
      // Checkmarks are special verification items, indent based on context
      const indent = currentListItems.length > 0 && currentListItems[currentListItems.length - 1].marker === '–' ? 2 : 1;
      currentListItems.push({ indent, marker: '✓', text: checkMatch[1] });
      continue;
    }
    
    // Not a list item - flush any pending list
    flushList();
    
    // Check if this is a NOTE
    if (trimmed.startsWith('NOTE:')) {
      const noteContent = trimmed.replace(/^NOTE:\s*/, '');
      elements.push(
        <Paper
          key={`note-${elements.length}`}
          elevation={0}
          sx={{
            p: 1.5,
            mb: 1.5,
            backgroundColor: 'info.50',
            borderLeft: 3,
            borderColor: 'info.main',
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <InfoOutlinedIcon sx={{ fontSize: 18, color: 'info.main', mt: 0.25 }} />
            <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
              {noteContent}
            </Typography>
          </Box>
        </Paper>
      );
      continue;
    }
    
    // Regular paragraph
    elements.push(
      <Typography key={`p-${elements.length}`} variant="body2" paragraph sx={{ lineHeight: 1.6, mb: 1.5 }}>
        {trimmed}
      </Typography>
    );
  }
  
  // Flush any remaining list
  flushList();
  
  return <>{elements}</>;
}

// Helper to render process steps with alternate path support
function ProcessSteps({ steps }: { steps: string[] }) {
  // Group steps by sections (main flow + alternate paths)
  const sections: { title: string | null; steps: string[] }[] = [];
  let currentSection: { title: string | null; steps: string[] } = { title: null, steps: [] };
  
  for (const step of steps) {
    // Check for alternate path header: --- Alternate Path: ... ---
    const altPathMatch = step.match(/^-{3}\s*(.+?)\s*-{3}$/);
    if (altPathMatch) {
      // Save current section if it has steps
      if (currentSection.steps.length > 0) {
        sections.push(currentSection);
      }
      // Start new section with this title
      currentSection = { title: altPathMatch[1], steps: [] };
    } else {
      currentSection.steps.push(step);
    }
  }
  // Don't forget the last section
  if (currentSection.steps.length > 0) {
    sections.push(currentSection);
  }
  
  return (
    <>
      {sections.map((section, sectionIdx) => (
        <Box key={sectionIdx} sx={{ mb: 2 }}>
          {section.title && (
            <Typography 
              variant="subtitle2" 
              sx={{ 
                mt: 2, 
                mb: 1, 
                py: 0.5,
                px: 1,
                backgroundColor: 'grey.100',
                borderRadius: 1,
                fontStyle: 'italic',
              }}
            >
              {section.title}
            </Typography>
          )}
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {section.steps.map((step, i) => (
              <li key={i}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {step.replace(/^\d+\.\s*/, '')}
                </Typography>
              </li>
            ))}
          </ol>
        </Box>
      ))}
    </>
  );
}

// BPT Sidebar Component
function BptSidebar({ 
  capability, 
  open, 
  onClose,
  isMobile,
  width,
  onWidthChange,
  collapsed,
  onCollapsedChange,
}: { 
  capability: ReturnType<typeof getCapabilityByCode>;
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, e.clientX));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onWidthChange]);
  if (!capability) return null;
  
  const { process_details } = capability.bpt;

  const content = (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontSize: '1rem' }}>
          Process Details (BPT)
        </Typography>
        {isMobile ? (
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        ) : (
          <IconButton onClick={() => onCollapsedChange(true)} size="small" title="Collapse sidebar">
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

      <FormattedDescription text={process_details.description} />

      {(process_details.trigger_events.environment_based.length > 0 || 
        process_details.trigger_events.interaction_based.length > 0) && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Trigger Events
          </Typography>
          {process_details.trigger_events.environment_based.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                Environment-Based
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {process_details.trigger_events.environment_based.map((event, i) => (
                  <li key={`env-${i}`}><Typography variant="body2" sx={{ mb: 0.5 }}>{event}</Typography></li>
                ))}
              </ul>
            </Box>
          )}
          {process_details.trigger_events.interaction_based.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                Interaction-Based
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {process_details.trigger_events.interaction_based.map((event, i) => (
                  <li key={`int-${i}`}><Typography variant="body2" sx={{ mb: 0.5 }}>{event}</Typography></li>
                ))}
              </ul>
            </Box>
          )}
        </Box>
      )}

      {process_details.process_steps.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Process Steps
          </Typography>
          <ProcessSteps steps={process_details.process_steps} />
        </Box>
      )}

      {process_details.results.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Results
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {process_details.results.map((result, i) => (
              <li key={i}><Typography variant="body2" sx={{ mb: 0.5 }}>{result}</Typography></li>
            ))}
          </ul>
        </Box>
      )}

      {process_details.shared_data.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Shared Data
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {process_details.shared_data.map((data, i) => (
              <li key={i}><Typography variant="body2" sx={{ mb: 0.5 }}>{data}</Typography></li>
            ))}
          </ul>
        </Box>
      )}
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="left"
        open={open}
        onClose={onClose}
        sx={{ '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH_MOBILE } }}
      >
        {content}
      </Drawer>
    );
  }

  // Collapsed state - show thin bar with expand button
  if (collapsed) {
    return (
      <Box
        sx={{
          width: 40,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          backgroundColor: 'grey.50',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: 1,
        }}
      >
        <IconButton 
          onClick={() => onCollapsedChange(false)} 
          size="small" 
          title="Expand sidebar"
        >
          <ChevronRightIcon />
        </IconButton>
        <Typography
          variant="caption"
          sx={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            mt: 2,
            color: 'text.secondary',
          }}
        >
          Process Details
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: width,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        backgroundColor: 'grey.50',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        userSelect: isResizing ? 'none' : 'auto',
      }}
    >
      {content}
      {/* Resize handle */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 6,
          height: '100%',
          cursor: 'col-resize',
          backgroundColor: isResizing ? 'primary.main' : 'transparent',
          transition: 'background-color 0.15s',
          '&:hover': {
            backgroundColor: 'primary.light',
          },
        }}
      />
    </Box>
  );
}

// Question Card Component
function QuestionCard({
  question,
  questionIndex,
  assessmentId,
  onDirty,
  readOnly = false,
}: {
  question: CapabilityQuestion;
  questionIndex: number;
  assessmentId: string;
  onDirty: () => void;
  readOnly?: boolean;
}) {
  const { getRating, saveRating } = useRatings(assessmentId);
  const rating = getRating(questionIndex);
  const [notes, setNotes] = useState(rating?.notes || '');
  const [notesExpanded, setNotesExpanded] = useState(!!rating?.notes || readOnly);

  // Sync notes when rating changes
  useEffect(() => {
    setNotes(rating?.notes || '');
    if (rating?.notes) setNotesExpanded(true);
  }, [rating?.notes]);

  const handleLevelChange = async (level: 1 | 2 | 3 | 4 | 5) => {
    if (readOnly) return;
    onDirty();
    saveRating(questionIndex, level, notes);
  };

  const handleNotesBlur = () => {
    if (readOnly) return;
    if (notes !== (rating?.notes || '')) {
      onDirty();
      saveRating(questionIndex, rating?.level || null, notes);
    }
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

        <Box sx={{ mt: 1.5 }}>
          {!readOnly && (
            <Button
              size="small"
              onClick={() => setNotesExpanded(!notesExpanded)}
              sx={{ mb: 1 }}
            >
              {notesExpanded ? 'Hide Notes' : (rating?.notes ? 'Show Notes' : 'Add Notes')}
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
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                size="small"
              />
            )
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

  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_WIDTH);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [localTags, setLocalTags] = useState<string[]>([]);
  
  // Track original status when page loads (for cancel behavior)
  const [originalStatus, setOriginalStatus] = useState<'in_progress' | 'finalized' | null>(null);
  // Track if user has made any changes (dirty state)
  const [isDirty, setIsDirty] = useState(false);
  // Track if this assessment has history (was previously finalized)
  const [hasHistory, setHasHistory] = useState(false);

  // Get capability data
  const capability = useMemo(() => {
    if (!assessment) return null;
    return getCapabilityByCode(assessment.capabilityCode);
  }, [assessment]);

  const totalQuestions = capability?.bcm.maturity_model.capability_questions.length || 0;
  const progress = getProgress(totalQuestions);
  const answeredCount = getAnsweredCount();

  // Capture original status when assessment first loads
  useEffect(() => {
    if (assessment && originalStatus === null) {
      setOriginalStatus(assessment.status);
    }
  }, [assessment, originalStatus]);

  // Check if this assessment has history (was previously finalized)
  useEffect(() => {
    if (assessment) {
      db.assessmentHistory
        .where('capabilityCode')
        .equals(assessment.capabilityCode)
        .count()
        .then(count => setHasHistory(count > 0));
    }
  }, [assessment]);

  // Sync local tags with assessment tags when assessment loads
  useEffect(() => {
    if (assessment?.tags) {
      setLocalTags(assessment.tags);
    }
  }, [assessment?.tags]);

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
        capability={capability} 
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
