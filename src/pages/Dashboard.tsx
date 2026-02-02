import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Autocomplete,
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
  TextField,
  Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useCapabilityAssessments } from "../hooks/useCapabilityAssessments";
import { useScores } from "../hooks/useScores";
import { useHistory } from "../hooks/useHistory";
import { getBusinessAreas, getCapabilityByCode } from "../services/blueprint";
import {
  CapabilityProgressBar,
  HistoryPanel,
  HistoryViewDialog,
  StackedProgressBar,
} from "../components/dashboard";
import { compactChipSx, getInProgressGradient } from "../theme/sharedStyles";
import {
  ACTION_BUTTON_WIDTH,
  LEGEND_INDICATOR_SIZE,
  MAX_VISIBLE_TAGS,
  PROGRESS_STRIPE_WIDTH,
  TAG_FILTER_MIN_WIDTH,
} from "../constants/ui";
import type { AssessmentHistory } from "../types";

export default function Dashboard() {
  const navigate = useNavigate();
  const businessAreas = useMemo(() => getBusinessAreas(), []);
  const {
    startAssessment,
    editAssessment,
    deleteAssessment,
    getCapabilityStatus,
    getLatestFinalized,
    getInProgress,
  } = useCapabilityAssessments();
  const { deleteHistoryEntry } = useHistory();
  const {
    getCapabilityScore,
    getBusinessAreaScore,
    getCapabilityTags,
    getCapabilityProgress,
    getAllTagsInUse,
  } = useScores();

  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [expandedCapabilities, setExpandedCapabilities] = useState<Set<string>>(
    new Set(),
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Menu state for action dropdown
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuCapabilityCode, setMenuCapabilityCode] = useState<string | null>(
    null,
  );
  const [menuCapabilityStatus, setMenuCapabilityStatus] = useState<
    "not_assessed" | "in_progress" | "finalized"
  >("not_assessed");

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "assessment" | "history";
    id: string;
    name: string;
  } | null>(null);
  const [historyViewEntry, setHistoryViewEntry] =
    useState<AssessmentHistory | null>(null);

  const allTags = getAllTagsInUse();

  // Get aggregated tags for a business area
  const getAreaTags = (areaName: string): string[] => {
    const area = businessAreas.find((a) => a.name === areaName);
    if (!area) return [];

    const tagSet = new Set<string>();
    for (const cap of area.capabilities) {
      const capTags = getCapabilityTags(cap.code);
      capTags.forEach((tag) => tagSet.add(tag));
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
  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    capabilityCode: string,
    status: "not_assessed" | "in_progress" | "finalized",
  ) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setMenuCapabilityCode(capabilityCode);
    setMenuCapabilityStatus(status);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuCapabilityCode(null);
    setMenuCapabilityStatus("not_assessed");
  };

  const handleViewFromMenu = () => {
    if (menuCapabilityCode) {
      if (menuCapabilityStatus === "finalized") {
        const finalized = getLatestFinalized(menuCapabilityCode);
        if (finalized) {
          navigate(`/assessment/${finalized.id}?mode=view`);
        }
      } else if (menuCapabilityStatus === "in_progress") {
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
        await editAssessment(finalized.id);
        navigate(`/assessment/${finalized.id}`);
      }
    }
    handleMenuClose();
  };

  const handleDeleteFromMenu = () => {
    if (menuCapabilityCode) {
      if (menuCapabilityStatus === "finalized") {
        const finalized = getLatestFinalized(menuCapabilityCode);
        if (finalized) {
          setDeleteTarget({
            type: "assessment",
            id: finalized.id,
            name: finalized.processName,
          });
          setDeleteDialogOpen(true);
        }
      } else if (menuCapabilityStatus === "in_progress") {
        const inProgress = getInProgress(menuCapabilityCode);
        if (inProgress) {
          setDeleteTarget({
            type: "assessment",
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
      type: "history",
      id: entry.id,
      name: `${capability?.processName || entry.capabilityCode} (${new Date(entry.snapshotDate).toLocaleDateString()})`,
    });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === "assessment") {
      await deleteAssessment(deleteTarget.id);
    } else {
      await deleteHistoryEntry(deleteTarget.id);
    }

    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const getAreaStats = (areaName: string) => {
    const area = businessAreas.find((a) => a.name === areaName);
    if (!area) return { finalized: 0, total: 0, inProgress: 0 };

    let finalized = 0;
    let inProgress = 0;

    for (const cap of area.capabilities) {
      if (selectedTags.length > 0) {
        const capTags = getCapabilityTags(cap.code);
        if (!selectedTags.some((t) => capTags.includes(t))) {
          continue;
        }
      }

      const status = getCapabilityStatus(cap.code);
      if (status === "finalized") {
        finalized++;
      } else if (status === "in_progress") {
        inProgress++;
      }
    }

    let total = area.capabilities.length;
    if (selectedTags.length > 0) {
      total = area.capabilities.filter((cap) => {
        const capTags = getCapabilityTags(cap.code);
        return selectedTags.some((t) => capTags.includes(t));
      }).length;
    }

    return { finalized, total, inProgress };
  };

  const shouldShowCapability = (capabilityCode: string): boolean => {
    if (selectedTags.length === 0) return true;
    const capTags = getCapabilityTags(capabilityCode);
    return selectedTags.some((t) => capTags.includes(t));
  };

  const overallStats = useMemo(() => {
    let totalFinalized = 0;
    let totalCapabilities = 0;

    for (const area of businessAreas) {
      for (const cap of area.capabilities) {
        if (!shouldShowCapability(cap.code)) continue;
        totalCapabilities++;
        const status = getCapabilityStatus(cap.code);
        if (status === "finalized") {
          totalFinalized++;
        }
      }
    }

    return { finalized: totalFinalized, total: totalCapabilities };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessAreas, selectedTags, getCapabilityStatus]);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 2,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h5" component="h2">
            MITA 3.0 State Self-Assessment Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click on any business area start, view, or edit a capability
            maturity assessment
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {allTags.length > 0 && (
            <Autocomplete
              multiple
              size="small"
              options={allTags}
              value={selectedTags}
              onChange={(_, newValue) => setSelectedTags(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Filter by tags..."
                  sx={{ minWidth: TAG_FILTER_MIN_WIDTH }}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option}
                    label={option}
                    size="small"
                  />
                ))
              }
            />
          )}
          <Chip
            label={`${overallStats.finalized} of ${overallStats.total} finalized`}
            color={
              overallStats.finalized === overallStats.total &&
              overallStats.total > 0
                ? "success"
                : "default"
            }
            variant="outlined"
          />
        </Box>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "grey.50" }}>
              <TableCell>Business Area / Capability</TableCell>
              <TableCell align="center" width={70}>
                Score
              </TableCell>
              <TableCell align="center" width={180}>
                Tags
              </TableCell>
              <TableCell align="center" width={120}>
                Status
              </TableCell>
              <TableCell align="center" width={70}>
                Completion
              </TableCell>
              <TableCell align="center" width={80}>
                Action
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {businessAreas.map((area) => {
              const stats = getAreaStats(area.name);
              const isExpanded = expandedAreas.has(area.name);
              const areaScore = getBusinessAreaScore(
                area.capabilities.map((c) => c.code),
              );
              const areaTags = getAreaTags(area.name);

              if (selectedTags.length > 0 && stats.total === 0) return null;

              return (
                <React.Fragment key={area.name}>
                  <TableRow
                    hover
                    onClick={() => toggleArea(area.name)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <IconButton size="small" sx={{ p: 0.25 }}>
                          {isExpanded ? (
                            <KeyboardArrowDownIcon fontSize="small" />
                          ) : (
                            <KeyboardArrowRightIcon fontSize="small" />
                          )}
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
                        color={
                          areaScore !== null ? "text.primary" : "text.disabled"
                        }
                      >
                        {areaScore !== null ? areaScore.toFixed(1) : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box
                        sx={{
                          display: "flex",
                          gap: 0.5,
                          flexWrap: "wrap",
                          justifyContent: "center",
                        }}
                      >
                        {areaTags.slice(0, MAX_VISIBLE_TAGS).map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            variant="outlined"
                            sx={compactChipSx}
                          />
                        ))}
                        {areaTags.length > MAX_VISIBLE_TAGS && (
                          <Chip
                            label={`+${areaTags.length - MAX_VISIBLE_TAGS}`}
                            size="small"
                            variant="outlined"
                            sx={compactChipSx}
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
                          color:
                            stats.total > 0 && stats.finalized === stats.total
                              ? "success.main"
                              : "text.secondary",
                        }}
                      >
                        {stats.total > 0
                          ? `${Math.round((stats.finalized / stats.total) * 100)}%`
                          : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>

                  {isExpanded &&
                    area.capabilities.map((cap) => {
                      if (!shouldShowCapability(cap.code)) return null;

                      const status = getCapabilityStatus(cap.code);
                      const score = getCapabilityScore(cap.code);
                      const tags = getCapabilityTags(cap.code);
                      const progress = getCapabilityProgress(cap.code);
                      const isCapExpanded = expandedCapabilities.has(cap.code);

                      return (
                        <React.Fragment key={cap.code}>
                          <TableRow hover sx={{ backgroundColor: "grey.50" }}>
                            <TableCell>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                  pl: 4,
                                  cursor: "pointer",
                                }}
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
                                color={
                                  score !== null
                                    ? "text.primary"
                                    : "text.disabled"
                                }
                              >
                                {score !== null ? score.toFixed(1) : "—"}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Box
                                sx={{
                                  display: "flex",
                                  gap: 0.5,
                                  flexWrap: "wrap",
                                  justifyContent: "center",
                                }}
                              >
                                {tags.map((tag) => (
                                  <Chip
                                    key={tag}
                                    label={tag}
                                    size="small"
                                    sx={compactChipSx}
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
                                  fontWeight:
                                    status === "finalized" ? 500 : 400,
                                  color:
                                    status === "finalized"
                                      ? "success.main"
                                      : status === "not_assessed"
                                        ? "text.disabled"
                                        : "text.secondary",
                                }}
                              >
                                {status === "not_assessed"
                                  ? "—"
                                  : `${status === "finalized" ? 100 : progress}%`}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              {status === "not_assessed" ? (
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={async () => {
                                    const assessmentId = await startAssessment(
                                      cap.code,
                                    );
                                    navigate(`/assessment/${assessmentId}`);
                                  }}
                                  sx={{
                                    textTransform: "none",
                                    width: ACTION_BUTTON_WIDTH,
                                    py: 0.25,
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  Start
                                </Button>
                              ) : (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={(e) =>
                                    handleMenuOpen(e, cap.code, status)
                                  }
                                  sx={{
                                    textTransform: "none",
                                    width: ACTION_BUTTON_WIDTH,
                                    py: 0.25,
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  •••
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>

                          {isCapExpanded && (
                            <TableRow>
                              <TableCell
                                colSpan={6}
                                sx={{ backgroundColor: "grey.100", py: 1 }}
                              >
                                <HistoryPanel
                                  capabilityCode={cap.code}
                                  currentAssessment={getLatestFinalized(
                                    cap.code,
                                  )}
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

      <Box sx={{ mt: 1, display: "flex", gap: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
          <Typography variant="caption" color="text.secondary">
            Not assessed
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box
            sx={{
              width: LEGEND_INDICATOR_SIZE,
              height: LEGEND_INDICATOR_SIZE,
              borderRadius: 0.5,
              background: getInProgressGradient(PROGRESS_STRIPE_WIDTH.small),
            }}
          />
          <Typography variant="caption" color="text.secondary">
            In progress
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <CheckCircleIcon fontSize="small" color="success" />
          <Typography variant="caption" color="text.secondary">
            Finalized
          </Typography>
        </Box>
      </Box>

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        {menuCapabilityStatus === "in_progress" && (
          <MenuItem onClick={handleViewFromMenu}>
            <VisibilityIcon fontSize="small" sx={{ mr: 1 }} />
            View
          </MenuItem>
        )}
        {menuCapabilityStatus === "in_progress" && (
          <MenuItem onClick={handleResumeFromMenu}>
            <PlayArrowIcon fontSize="small" sx={{ mr: 1 }} />
            Resume
          </MenuItem>
        )}
        {menuCapabilityStatus === "in_progress" && (
          <MenuItem onClick={handleDeleteFromMenu} sx={{ color: "error.main" }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        )}
        {menuCapabilityStatus === "finalized" && (
          <MenuItem onClick={handleViewFromMenu}>
            <VisibilityIcon fontSize="small" sx={{ mr: 1 }} />
            View
          </MenuItem>
        )}
        {menuCapabilityStatus === "finalized" && (
          <MenuItem onClick={handleEditFromMenu}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
        )}
        {menuCapabilityStatus === "finalized" && (
          <MenuItem onClick={handleDeleteFromMenu} sx={{ color: "error.main" }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        )}
      </Menu>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>
          {deleteTarget?.type === "assessment"
            ? "Delete Assessment?"
            : "Delete History Entry?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget?.type === "assessment"
              ? `Are you sure you want to delete the assessment for "${deleteTarget?.name}"? This will permanently remove all ratings and notes. This cannot be undone.`
              : `Are you sure you want to delete this history entry for "${deleteTarget?.name}"? This cannot be undone.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <HistoryViewDialog
        entry={historyViewEntry}
        open={Boolean(historyViewEntry)}
        onClose={() => setHistoryViewEntry(null)}
      />
    </Container>
  );
}
