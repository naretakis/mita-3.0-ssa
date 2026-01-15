import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Autocomplete,
  TextField,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useCapabilityAssessments } from '../hooks/useCapabilityAssessments';
import { useScores } from '../hooks/useScores';
import { useCapabilityHistory, useHistory } from '../hooks/useHistory';
import { getBusinessAreas, getCapabilityByCode } from '../services/blueprint';
import type { AssessmentHistory, CapabilityAssessment } from '../types';

// Stacked Progress Bar component for Business Areas (bar only)
function StackedProgressBar({
  finalized,
  inProgress,
  total,
}: {
  finalized: number;
  inProgress: number;
  total: number;
}) {
  const notStarted = total - finalized - inProgress;
  const finalizedPercent = total > 0 ? (finalized / total) * 100 : 0;
  const inProgressPercent = total > 0 ? (inProgress / total) * 100 : 0;
  const notStartedPercent = total > 0 ? (notStarted / total) * 100 : 0;
  
  return (
    <Box
      sx={{
        display: 'flex',
        height: 22,
        borderRadius: 1,
        overflow: 'hidden',
        backgroundColor: 'grey.200',
        fontSize: '0.75rem',
        fontWeight: 500,
      }}
    >
      {finalized > 0 && (
        <Box
          sx={{
            width: `${finalizedPercent}%`,
            backgroundColor: 'success.main',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: finalized > 0 ? 20 : 0,
          }}
        >
          {finalized}
        </Box>
      )}
      {inProgress > 0 && (
        <Box
          sx={{
            width: `${inProgressPercent}%`,
            background: `repeating-linear-gradient(
              -45deg,
              #81c784,
              #81c784 4px,
              #a5d6a7 4px,
              #a5d6a7 8px
            )`,
            color: '#1b5e20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: inProgress > 0 ? 20 : 0,
          }}
        >
          {inProgress}
        </Box>
      )}
      {notStarted > 0 && (
        <Box
          sx={{
            width: `${notStartedPercent}%`,
            backgroundColor: 'grey.300',
            color: 'grey.600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: notStarted > 0 ? 20 : 0,
          }}
        >
          {notStarted}
        </Box>
      )}
    </Box>
  );
}

// Simple Progress Bar component for Capabilities (bar only)
function CapabilityProgressBar({
  status,
  progress,
}: {
  status: 'not_assessed' | 'in_progress' | 'finalized';
  progress: number; // 0-100 for question completion
}) {
  const isFinalized = status === 'finalized';
  const isInProgress = status === 'in_progress';
  const displayProgress = isFinalized ? 100 : progress;
  
  return (
    <Box
      sx={{
        height: 18,
        borderRadius: 1,
        overflow: 'hidden',
        backgroundColor: 'grey.200',
      }}
    >
      {displayProgress > 0 && (
        <Box
          sx={{
            width: `${displayProgress}%`,
            height: '100%',
            ...(isFinalized ? {
              backgroundColor: 'success.main',
            } : isInProgress ? {
              background: `repeating-linear-gradient(
                -45deg,
                #81c784,
                #81c784 3px,
                #a5d6a7 3px,
                #a5d6a7 6px
              )`,
            } : {
              backgroundColor: 'grey.300',
            }),
          }}
        />
      )}
    </Box>
  );
}

// History Panel Component
function HistoryPanel({ 
  capabilityCode,
  currentAssessment,
  onViewHistory,
  onDeleteHistory,
}: { 
  capabilityCode: string;
  currentAssessment: CapabilityAssessment | undefined;
  onViewHistory: (entry: AssessmentHistory) => void;
  onDeleteHistory: (entry: AssessmentHistory) => void;
}) {
  const { history } = useCapabilityHistory(capabilityCode);

  const hasCurrentFinalized = currentAssessment?.status === 'finalized' && currentAssessment.score !== undefined;
  const hasHistory = history.length > 0;

  if (!hasCurrentFinalized && !hasHistory) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ pl: 5, py: 1 }}>
        No assessments yet
      </Typography>
    );
  }

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString(undefined, {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Box sx={{ pl: 5, py: 1 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
        Assessment History
      </Typography>
      
      {/* Current finalized assessment */}
      {hasCurrentFinalized && currentAssessment && (
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            py: 0.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'success.50',
            mx: -1,
            px: 1,
            borderRadius: 1,
          }}
        >
          <Box sx={{ width: 70 }}>
            <Chip 
              label="Current" 
              size="small" 
              color="success"
              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
            />
          </Box>
          <Typography variant="body2" sx={{ width: 160 }}>
            {formatDateTime(currentAssessment.finalizedAt || currentAssessment.updatedAt)}
          </Typography>
          <Typography variant="body2" fontWeight={500} sx={{ width: 80 }}>
            Score: {currentAssessment.score?.toFixed(1)}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {currentAssessment.tags.map(tag => (
              <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
            ))}
          </Box>
        </Box>
      )}

      {/* Historical assessments */}
      {history.map((entry: AssessmentHistory) => (
        <Box 
          key={entry.id} 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            py: 0.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ width: 70 }} /> {/* Spacer for "Current" badge alignment */}
          <Typography variant="body2" sx={{ width: 160 }}>
            {formatDateTime(entry.snapshotDate)}
          </Typography>
          <Typography variant="body2" fontWeight={500} sx={{ width: 80 }}>
            Score: {entry.score.toFixed(1)}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {entry.tags.map(tag => (
              <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, ml: 2 }}>
            <IconButton 
              size="small" 
              onClick={() => onViewHistory(entry)}
              title="View details"
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
            <IconButton 
              size="small" 
              onClick={() => onDeleteHistory(entry)}
              title="Delete history entry"
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// History View Dialog Component
function HistoryViewDialog({
  entry,
  open,
  onClose,
}: {
  entry: AssessmentHistory | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!entry) return null;

  const capability = getCapabilityByCode(entry.capabilityCode);
  const questions = capability?.bcm.maturity_model.capability_questions || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box>
          <Typography variant="overline" color="text.secondary">
            Historical Assessment
          </Typography>
          <Typography variant="h6">
            {capability?.processName || entry.capabilityCode}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Date</Typography>
              <Typography variant="body2" fontWeight={500}>
                {new Date(entry.snapshotDate).toLocaleDateString()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Score</Typography>
              <Typography variant="body2" fontWeight={500}>
                {entry.score.toFixed(1)} / 5.0
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Blueprint Version</Typography>
              <Typography variant="body2" fontWeight={500}>
                {entry.blueprintVersion}
              </Typography>
            </Box>
          </Box>
          {entry.tags.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">Tags</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                {entry.tags.map(tag => (
                  <Chip key={tag} label={tag} size="small" />
                ))}
              </Box>
            </Box>
          )}
        </Box>

        <Typography variant="subtitle2" gutterBottom>
          Ratings ({entry.ratings.length} questions answered)
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {[...entry.ratings]
            .sort((a, b) => a.questionIndex - b.questionIndex)
            .map((rating) => {
              const question = questions[rating.questionIndex];
              return (
                <Paper key={rating.questionIndex} variant="outlined" sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ flex: 1, pr: 2 }}>
                      <strong>Q{rating.questionIndex + 1}:</strong> {question?.question || 'Question not found'}
                    </Typography>
                    <Chip 
                      label={`Level ${rating.level}`} 
                      size="small" 
                      color="primary"
                      sx={{ minWidth: 70 }}
                    />
                  </Box>
                  {question && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      {question.levels[`level_${rating.level}` as keyof typeof question.levels]}
                    </Typography>
                  )}
                  {rating.notes && (
                    <Box sx={{ mt: 1, p: 1, backgroundColor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary">Notes:</Typography>
                      <Typography variant="body2">{rating.notes}</Typography>
                    </Box>
                  )}
                </Paper>
              );
            })}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// Coverage Overview Component
function CoverageOverview() {
  const navigate = useNavigate();
  const businessAreas = useMemo(() => getBusinessAreas(), []);
  const { startAssessment, editAssessment, deleteAssessment, getCapabilityStatus, getLatestFinalized, getInProgress } = useCapabilityAssessments();
  const { deleteHistoryEntry } = useHistory();
  const { getCapabilityScore, getBusinessAreaScore, getCapabilityTags, getCapabilityProgress, getAllTagsInUse } = useScores();
  
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [expandedCapabilities, setExpandedCapabilities] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Menu state for action dropdown
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuCapabilityCode, setMenuCapabilityCode] = useState<string | null>(null);
  const [menuCapabilityStatus, setMenuCapabilityStatus] = useState<'not_assessed' | 'in_progress' | 'finalized'>('not_assessed');
  
  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'assessment' | 'history'; id: string; name: string } | null>(null);
  const [historyViewEntry, setHistoryViewEntry] = useState<AssessmentHistory | null>(null);

  const allTags = getAllTagsInUse();

  // Get aggregated tags for a business area
  const getAreaTags = (areaName: string): string[] => {
    const area = businessAreas.find(a => a.name === areaName);
    if (!area) return [];
    
    const tagSet = new Set<string>();
    for (const cap of area.capabilities) {
      const capTags = getCapabilityTags(cap.code);
      capTags.forEach(tag => tagSet.add(tag));
    }
    return Array.from(tagSet).sort();
  };

  const toggleArea = (areaName: string) => {
    const newExpanded = new Set(expandedAreas);
    if (newExpanded.has(areaName)) {
      newExpanded.delete(areaName);
    } else {
      newExpanded.add(areaName);
    }
    setExpandedAreas(newExpanded);
  };

  const toggleCapability = (code: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newExpanded = new Set(expandedCapabilities);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedCapabilities(newExpanded);
  };

  // Menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, capabilityCode: string, status: 'not_assessed' | 'in_progress' | 'finalized') => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setMenuCapabilityCode(capabilityCode);
    setMenuCapabilityStatus(status);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuCapabilityCode(null);
    setMenuCapabilityStatus('not_assessed');
  };

  const handleViewFromMenu = () => {
    if (menuCapabilityCode) {
      if (menuCapabilityStatus === 'finalized') {
        const finalized = getLatestFinalized(menuCapabilityCode);
        if (finalized) {
          navigate(`/assessment/${finalized.id}?mode=view`);
        }
      } else if (menuCapabilityStatus === 'in_progress') {
        const inProgress = getInProgress(menuCapabilityCode);
        if (inProgress) {
          navigate(`/assessment/${inProgress.id}?mode=view`);
        }
      }
    }
    handleMenuClose();
  };

  const handleResumeFromMenu = () => {
    if (menuCapabilityCode) {
      const inProgress = getInProgress(menuCapabilityCode);
      if (inProgress) {
        navigate(`/assessment/${inProgress.id}`);
      }
    }
    handleMenuClose();
  };

  const handleEditFromMenu = async () => {
    if (menuCapabilityCode) {
      const finalized = getLatestFinalized(menuCapabilityCode);
      if (finalized) {
        // Call editAssessment first to convert ratings to suggestions
        await editAssessment(finalized.id);
        navigate(`/assessment/${finalized.id}`);
      }
    }
    handleMenuClose();
  };

  const handleDeleteFromMenu = () => {
    if (menuCapabilityCode) {
      if (menuCapabilityStatus === 'finalized') {
        const finalized = getLatestFinalized(menuCapabilityCode);
        if (finalized) {
          setDeleteTarget({
            type: 'assessment',
            id: finalized.id,
            name: finalized.processName,
          });
          setDeleteDialogOpen(true);
        }
      } else if (menuCapabilityStatus === 'in_progress') {
        const inProgress = getInProgress(menuCapabilityCode);
        if (inProgress) {
          setDeleteTarget({
            type: 'assessment',
            id: inProgress.id,
            name: inProgress.processName,
          });
          setDeleteDialogOpen(true);
        }
      }
    }
    handleMenuClose();
  };

  // History handlers
  const handleViewHistory = (entry: AssessmentHistory) => {
    setHistoryViewEntry(entry);
  };

  const handleDeleteHistory = (entry: AssessmentHistory) => {
    const capability = getCapabilityByCode(entry.capabilityCode);
    setDeleteTarget({
      type: 'history',
      id: entry.id,
      name: `${capability?.processName || entry.capabilityCode} (${new Date(entry.snapshotDate).toLocaleDateString()})`,
    });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    
    if (deleteTarget.type === 'assessment') {
      await deleteAssessment(deleteTarget.id);
    } else {
      await deleteHistoryEntry(deleteTarget.id);
    }
    
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const getAreaStats = (areaName: string) => {
    const area = businessAreas.find(a => a.name === areaName);
    if (!area) return { finalized: 0, total: 0, inProgress: 0 };
    
    let finalized = 0;
    let inProgress = 0;
    
    for (const cap of area.capabilities) {
      // Apply tag filter
      if (selectedTags.length > 0) {
        const capTags = getCapabilityTags(cap.code);
        if (!selectedTags.some(t => capTags.includes(t))) {
          continue;
        }
      }
      
      const status = getCapabilityStatus(cap.code);
      if (status === 'finalized') {
        finalized++;
      } else if (status === 'in_progress') {
        inProgress++;
      }
    }
    
    // Count total based on filter
    let total = area.capabilities.length;
    if (selectedTags.length > 0) {
      total = area.capabilities.filter(cap => {
        const capTags = getCapabilityTags(cap.code);
        return selectedTags.some(t => capTags.includes(t));
      }).length;
    }
    
    return { finalized, total, inProgress };
  };

  // Filter capabilities based on selected tags
  const shouldShowCapability = (capabilityCode: string): boolean => {
    if (selectedTags.length === 0) return true;
    const capTags = getCapabilityTags(capabilityCode);
    return selectedTags.some(t => capTags.includes(t));
  };

  // Calculate overall stats
  const overallStats = useMemo(() => {
    let totalFinalized = 0;
    let totalCapabilities = 0;
    
    for (const area of businessAreas) {
      for (const cap of area.capabilities) {
        if (!shouldShowCapability(cap.code)) continue;
        totalCapabilities++;
        const status = getCapabilityStatus(cap.code);
        if (status === 'finalized') {
          totalFinalized++;
        }
      }
    }
    
    return { finalized: totalFinalized, total: totalCapabilities };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessAreas, selectedTags, getCapabilityStatus]);

  return (
    <Box>
      {/* Header with tag filter */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" component="h2">
            MITA 3.0 State Self-Assessment Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click on any business area start, view, or edit a capability maturity assessment
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {allTags.length > 0 && (
            <Autocomplete
              multiple
              size="small"
              options={allTags}
              value={selectedTags}
              onChange={(_, newValue) => setSelectedTags(newValue)}
              renderInput={(params) => (
                <TextField {...params} placeholder="Filter by tags..." sx={{ minWidth: 200 }} />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip {...getTagProps({ index })} key={option} label={option} size="small" />
                ))
              }
            />
          )}
          <Chip 
            label={`${overallStats.finalized} of ${overallStats.total} finalized`}
            color={overallStats.finalized === overallStats.total && overallStats.total > 0 ? 'success' : 'default'}
            variant="outlined"
          />
        </Box>
      </Box>
      
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: 'grey.50' }}>
              <TableCell>Business Area / Capability</TableCell>
              <TableCell align="center" width={70}>Score</TableCell>
              <TableCell align="center" width={180}>Tags</TableCell>
              <TableCell align="center" width={120}>Status</TableCell>
              <TableCell align="center" width={70}>Completion</TableCell>
              <TableCell align="center" width={80}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {businessAreas.map((area) => {
              const stats = getAreaStats(area.name);
              const isExpanded = expandedAreas.has(area.name);
              const areaScore = getBusinessAreaScore(area.capabilities.map(c => c.code));
              const areaTags = getAreaTags(area.name);
              
              // Skip areas with no matching capabilities when filtering
              if (selectedTags.length > 0 && stats.total === 0) return null;
              
              return (
                <React.Fragment key={area.name}>
                  {/* Business Area Row */}
                  <TableRow 
                    hover
                    onClick={() => toggleArea(area.name)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton size="small" sx={{ p: 0.25 }}>
                          {isExpanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                        </IconButton>
                        <Typography variant="body2" fontWeight={600}>
                          {area.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Typography 
                        variant="body2" 
                        fontWeight={areaScore !== null ? 600 : 400}
                        color={areaScore !== null ? 'text.primary' : 'text.disabled'}
                      >
                        {areaScore !== null ? areaScore.toFixed(1) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {areaTags.slice(0, 3).map(tag => (
                          <Chip 
                            key={tag} 
                            label={tag} 
                            size="small" 
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.65rem' }}
                          />
                        ))}
                        {areaTags.length > 3 && (
                          <Chip 
                            label={`+${areaTags.length - 3}`} 
                            size="small" 
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.65rem' }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <StackedProgressBar 
                        finalized={stats.finalized}
                        inProgress={stats.inProgress}
                        total={stats.total}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 500,
                          color: stats.total > 0 && stats.finalized === stats.total ? 'success.main' : 'text.secondary',
                        }}
                      >
                        {stats.total > 0 ? `${Math.round((stats.finalized / stats.total) * 100)}%` : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                  
                  {/* Capability Rows (when expanded) */}
                  {isExpanded && area.capabilities.map((cap) => {
                    if (!shouldShowCapability(cap.code)) return null;
                    
                    const status = getCapabilityStatus(cap.code);
                    const score = getCapabilityScore(cap.code);
                    const tags = getCapabilityTags(cap.code);
                    const progress = getCapabilityProgress(cap.code);
                    const isCapExpanded = expandedCapabilities.has(cap.code);
                    
                    return (
                      <React.Fragment key={cap.code}>
                        <TableRow 
                          hover
                          sx={{ backgroundColor: 'grey.50' }}
                        >
                          <TableCell>
                            <Box 
                              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 4, cursor: 'pointer' }}
                              onClick={(e) => toggleCapability(cap.code, e)}
                            >
                              <IconButton size="small" sx={{ p: 0.25 }}>
                                {isCapExpanded ? (
                                  <KeyboardArrowDownIcon fontSize="small" />
                                ) : (
                                  <KeyboardArrowRightIcon fontSize="small" />
                                )}
                              </IconButton>
                              <Typography variant="body2">
                                {cap.processName}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Typography 
                              variant="body2" 
                              fontWeight={score !== null ? 500 : 400}
                              color={score !== null ? 'text.primary' : 'text.disabled'}
                            >
                              {score !== null ? score.toFixed(1) : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                              {tags.map(tag => (
                                <Chip 
                                  key={tag} 
                                  label={tag} 
                                  size="small" 
                                  sx={{ height: 20, fontSize: '0.65rem' }}
                                />
                              ))}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <CapabilityProgressBar 
                              status={status}
                              progress={progress}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontWeight: status === 'finalized' ? 500 : 400,
                                color: status === 'finalized' ? 'success.main' : status === 'not_assessed' ? 'text.disabled' : 'text.secondary',
                              }}
                            >
                              {status === 'not_assessed' ? '—' : `${status === 'finalized' ? 100 : progress}%`}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            {status === 'not_assessed' ? (
                              <Button
                                size="small"
                                variant="contained"
                                onClick={async () => {
                                  const assessmentId = await startAssessment(cap.code);
                                  navigate(`/assessment/${assessmentId}`);
                                }}
                                sx={{ 
                                  textTransform: 'none',
                                  width: 64,
                                  py: 0.25,
                                  fontSize: '0.75rem',
                                }}
                              >
                                Start
                              </Button>
                            ) : (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={(e) => handleMenuOpen(e, cap.code, status)}
                                sx={{ 
                                  textTransform: 'none',
                                  width: 64,
                                  py: 0.25,
                                  fontSize: '0.75rem',
                                }}
                              >
                                •••
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        
                        {/* History Panel (when capability expanded) */}
                        {isCapExpanded && (
                          <TableRow>
                            <TableCell colSpan={6} sx={{ backgroundColor: 'grey.100', py: 1 }}>
                              <HistoryPanel 
                                capabilityCode={cap.code}
                                currentAssessment={getLatestFinalized(cap.code)}
                                onViewHistory={handleViewHistory}
                                onDeleteHistory={handleDeleteHistory}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Legend */}
      <Box sx={{ mt: 1, display: 'flex', gap: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
          <Typography variant="caption" color="text.secondary">Not assessed</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box 
            sx={{ 
              width: 16, 
              height: 16, 
              borderRadius: 0.5,
              background: `repeating-linear-gradient(
                -45deg,
                #81c784,
                #81c784 2px,
                #a5d6a7 2px,
                #a5d6a7 4px
              )`,
            }} 
          />
          <Typography variant="caption" color="text.secondary">In progress</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CheckCircleIcon fontSize="small" color="success" />
          <Typography variant="caption" color="text.secondary">Finalized</Typography>
        </Box>
      </Box>

      {/* Action Menu for In Progress and Finalized */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        {/* In Progress: View, Resume, Delete */}
        {menuCapabilityStatus === 'in_progress' && (
          <MenuItem onClick={handleViewFromMenu}>
            <VisibilityIcon fontSize="small" sx={{ mr: 1 }} />
            View
          </MenuItem>
        )}
        {menuCapabilityStatus === 'in_progress' && (
          <MenuItem onClick={handleResumeFromMenu}>
            <PlayArrowIcon fontSize="small" sx={{ mr: 1 }} />
            Resume
          </MenuItem>
        )}
        {menuCapabilityStatus === 'in_progress' && (
          <MenuItem onClick={handleDeleteFromMenu} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        )}
        
        {/* Finalized: View, Edit, Delete */}
        {menuCapabilityStatus === 'finalized' && (
          <MenuItem onClick={handleViewFromMenu}>
            <VisibilityIcon fontSize="small" sx={{ mr: 1 }} />
            View
          </MenuItem>
        )}
        {menuCapabilityStatus === 'finalized' && (
          <MenuItem onClick={handleEditFromMenu}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
        )}
        {menuCapabilityStatus === 'finalized' && (
          <MenuItem onClick={handleDeleteFromMenu} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        )}
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>
          {deleteTarget?.type === 'assessment' ? 'Delete Assessment?' : 'Delete History Entry?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget?.type === 'assessment' 
              ? `Are you sure you want to delete the assessment for "${deleteTarget?.name}"? This will permanently remove all ratings and notes. This cannot be undone.`
              : `Are you sure you want to delete this history entry for "${deleteTarget?.name}"? This cannot be undone.`
            }
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* History View Dialog */}
      <HistoryViewDialog
        entry={historyViewEntry}
        open={Boolean(historyViewEntry)}
        onClose={() => setHistoryViewEntry(null)}
      />
    </Box>
  );
}

export default function Dashboard() {
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <CoverageOverview />
    </Container>
  );
}
