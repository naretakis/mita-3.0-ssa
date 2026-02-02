/**
 * BptSidebar - Business Process Template Sidebar Component
 *
 * Renders all BPT data fields in a structured, readable format.
 * Handles complex text parsing including bullets, notes, sub-lists, and alternate paths.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Chip,
  Collapse,
  Drawer,
  IconButton,
  Paper,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import type { BPT } from "../../types";

// ============================================
// Constants
// ============================================

const SIDEBAR_WIDTH_MOBILE = 320;
const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 800;

// ============================================
// Text Parsing Utilities
// ============================================

interface ParsedLine {
  type:
    | "paragraph"
    | "note"
    | "bullet"
    | "dash"
    | "check"
    | "numbered"
    | "lettered"
    | "roman";
  content: string;
  indent: number;
}

/**
 * Parse a single line to determine its type and content
 */
function parseLine(line: string): ParsedLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Calculate indent level based on leading whitespace
  const leadingSpaces = line.length - line.trimStart().length;
  const indent = Math.floor(leadingSpaces / 2);

  // NOTE: callout
  if (trimmed.startsWith("NOTE:")) {
    return {
      type: "note",
      content: trimmed.replace(/^NOTE:\s*/, ""),
      indent: 0,
    };
  }

  // Checkmark item (✓)
  const checkMatch = trimmed.match(/^[✓]\s*(.+)$/);
  if (checkMatch) {
    return { type: "check", content: checkMatch[1], indent: indent + 2 };
  }

  // Bullet item (•)
  const bulletMatch = trimmed.match(/^[•]\s*(.+)$/);
  if (bulletMatch) {
    return { type: "bullet", content: bulletMatch[1], indent };
  }

  // Dash item (- or –)
  const dashMatch = trimmed.match(/^[-–]\s*(.+)$/);
  if (dashMatch) {
    return { type: "dash", content: dashMatch[1], indent: indent + 1 };
  }

  // Roman numeral (i., ii., iii., iv., etc.)
  const romanMatch = trimmed.match(/^(i{1,3}|iv|vi{0,3}|ix|x)\.\s*(.+)$/i);
  if (romanMatch) {
    return { type: "roman", content: romanMatch[2], indent: indent + 2 };
  }

  // Lettered item (a., b., c., etc.)
  const letterMatch = trimmed.match(/^([a-z])\.\s*(.+)$/i);
  if (letterMatch) {
    return { type: "lettered", content: letterMatch[2], indent: indent + 1 };
  }

  // Numbered item (1., 2., etc.)
  const numberMatch = trimmed.match(/^(\d+)\.\s*(.+)$/);
  if (numberMatch) {
    return { type: "numbered", content: numberMatch[2], indent };
  }

  return { type: "paragraph", content: trimmed, indent };
}

// ============================================
// Rendering Components
// ============================================

/**
 * Collapsible section wrapper with card-style content container
 */
function Section({
  title,
  children,
  defaultExpanded = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          cursor: "pointer",
          py: 0.5,
          "&:hover": { opacity: 0.8 },
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            color: "primary.main",
            fontWeight: 600,
            flex: 1,
          }}
        >
          {title}
        </Typography>
        {expanded ? (
          <ExpandLessIcon fontSize="small" />
        ) : (
          <ExpandMoreIcon fontSize="small" />
        )}
      </Box>
      <Collapse in={expanded}>
        <Box
          sx={{
            mt: 1,
            p: 1.5,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            backgroundColor: "background.paper",
          }}
        >
          {children}
        </Box>
      </Collapse>
    </Box>
  );
}

/**
 * Render a NOTE callout
 */
function NoteCallout({ content }: { content: string }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        my: 1.5,
        backgroundColor: "info.50",
        borderLeft: 3,
        borderColor: "info.main",
      }}
    >
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <InfoOutlinedIcon
          sx={{ fontSize: 18, color: "info.main", mt: 0.25, flexShrink: 0 }}
        />
        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
          {content}
        </Typography>
      </Box>
    </Paper>
  );
}

/**
 * Render formatted text with support for bullets, notes, and nested lists
 */
function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const parsed = parseLine(lines[i]);
    if (!parsed) continue;

    const key = `line-${i}`;

    switch (parsed.type) {
      case "note":
        elements.push(<NoteCallout key={key} content={parsed.content} />);
        break;

      case "check":
        elements.push(
          <Box
            key={key}
            sx={{ display: "flex", gap: 1, pl: parsed.indent * 1.5, mb: 0.5 }}
          >
            <Typography
              component="span"
              sx={{ color: "success.main", fontWeight: 600, flexShrink: 0 }}
            >
              ✓
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
              {parsed.content}
            </Typography>
          </Box>,
        );
        break;

      case "bullet":
        elements.push(
          <Box
            key={key}
            sx={{ display: "flex", gap: 1, pl: parsed.indent * 1.5, mb: 0.5 }}
          >
            <Typography
              component="span"
              sx={{ color: "text.secondary", flexShrink: 0 }}
            >
              •
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
              {parsed.content}
            </Typography>
          </Box>,
        );
        break;

      case "dash":
        elements.push(
          <Box
            key={key}
            sx={{ display: "flex", gap: 1, pl: parsed.indent * 1.5, mb: 0.5 }}
          >
            <Typography
              component="span"
              sx={{ color: "text.secondary", flexShrink: 0 }}
            >
              –
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
              {parsed.content}
            </Typography>
          </Box>,
        );
        break;

      default:
        elements.push(
          <Typography
            key={key}
            variant="body2"
            sx={{ lineHeight: 1.6, mb: 1, pl: parsed.indent * 1.5 }}
          >
            {parsed.content}
          </Typography>,
        );
    }
  }

  return <>{elements}</>;
}

/**
 * Render process steps with alternate path support
 */
function ProcessSteps({ steps }: { steps: string[] }) {
  // Group steps by sections (main flow + alternate paths)
  const sections: { title: string | null; steps: string[] }[] = [];
  let currentSection: { title: string | null; steps: string[] } = {
    title: null,
    steps: [],
  };

  for (const step of steps) {
    // Check for alternate path header: --- Alternate Path: ... ---
    const altPathMatch = step.match(/^-{3}\s*(.+?)\s*-{3}$/);
    if (altPathMatch) {
      if (currentSection.steps.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { title: altPathMatch[1], steps: [] };
    } else {
      currentSection.steps.push(step);
    }
  }
  if (currentSection.steps.length > 0) {
    sections.push(currentSection);
  }

  return (
    <>
      {sections.map((section, sectionIdx) => (
        <Box key={sectionIdx} sx={{ mb: 2 }}>
          {section.title && (
            <Paper
              elevation={0}
              sx={{
                mt: 2,
                mb: 1,
                py: 0.75,
                px: 1.5,
                backgroundColor: "warning.50",
                borderLeft: 3,
                borderColor: "warning.main",
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 600, color: "warning.dark" }}
              >
                {section.title}
              </Typography>
            </Paper>
          )}
          {section.steps.map((step, i) => {
            // Parse step number and content
            const stepMatch = step.match(/^(\d+)\.\s*(.*)$/s);
            const stepNum = stepMatch ? stepMatch[1] : null;
            const stepContent = stepMatch ? stepMatch[2] : step;

            return (
              <Box key={i} sx={{ mb: 1.5 }}>
                <Box
                  sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}
                >
                  {stepNum && (
                    <Box
                      sx={{
                        minWidth: 24,
                        height: 24,
                        borderRadius: "50%",
                        backgroundColor: "primary.main",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {stepNum}
                    </Box>
                  )}
                  <Box sx={{ flex: 1 }}>
                    <FormattedText text={stepContent} />
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      ))}
    </>
  );
}

/**
 * Render a simple list of strings
 */
function SimpleList({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
      {items.map((item, i) => (
        <Box component="li" key={i} sx={{ mb: 0.5 }}>
          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
            {item}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Render process links (predecessor/successor) as chips
 */
function ProcessLinks({
  processes,
  direction,
}: {
  processes: string[];
  direction: "predecessor" | "successor";
}) {
  if (processes.length === 0) return null;

  const icon =
    direction === "predecessor" ? (
      <ArrowBackIcon sx={{ fontSize: 14 }} />
    ) : (
      <ArrowForwardIcon sx={{ fontSize: 14 }} />
    );

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
      {processes.map((process, i) => (
        <Chip
          key={i}
          label={process}
          size="small"
          icon={icon}
          variant="outlined"
          sx={{
            height: "auto",
            "& .MuiChip-label": {
              whiteSpace: "normal",
              py: 0.5,
            },
          }}
        />
      ))}
    </Box>
  );
}

/**
 * Render trigger events grouped by type
 */
function TriggerEvents({
  events,
}: {
  events: BPT["process_details"]["trigger_events"];
}) {
  const hasEnvironment = events.environment_based.length > 0;
  const hasInteraction = events.interaction_based.length > 0;

  if (!hasEnvironment && !hasInteraction) return null;

  return (
    <Box>
      {hasEnvironment && (
        <Box sx={{ mb: 1.5 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: "text.secondary",
              display: "block",
              mb: 0.5,
            }}
          >
            Environment-Based
          </Typography>
          <SimpleList items={events.environment_based} />
        </Box>
      )}
      {hasInteraction && (
        <Box>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: "text.secondary",
              display: "block",
              mb: 0.5,
            }}
          >
            Interaction-Based
          </Typography>
          <SimpleList items={events.interaction_based} />
        </Box>
      )}
    </Box>
  );
}

/**
 * Render diagrams section
 */
function DiagramsSection({
  diagrams,
}: {
  diagrams: BPT["process_details"]["diagrams"];
}) {
  if (!diagrams || diagrams.length === 0) return null;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {diagrams.length} diagram{diagrams.length !== 1 ? "s" : ""} available
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {diagrams.map((diagram, i) => {
          // Handle both string and object formats
          const isObject = typeof diagram === "object" && diagram !== null;
          const filename = isObject
            ? (diagram as { filename: string }).filename
            : diagram;
          const description = isObject
            ? (diagram as { description?: string }).description
            : undefined;

          return (
            <Paper
              key={i}
              elevation={0}
              sx={{ p: 1, backgroundColor: "grey.50" }}
            >
              <Typography variant="caption" sx={{ fontWeight: 500 }}>
                {filename}
              </Typography>
              {description && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block" }}
                >
                  {description}
                </Typography>
              )}
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}

/**
 * Render constraints as a callout
 */
function ConstraintsSection({ constraints }: { constraints: string }) {
  if (!constraints) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        backgroundColor: "warning.50",
        borderLeft: 3,
        borderColor: "warning.main",
      }}
    >
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <WarningAmberIcon
          sx={{ fontSize: 18, color: "warning.main", mt: 0.25, flexShrink: 0 }}
        />
        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
          {constraints}
        </Typography>
      </Box>
    </Paper>
  );
}

// ============================================
// Main Sidebar Component
// ============================================

export interface BptSidebarProps {
  bpt: BPT;
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function BptSidebar({
  bpt,
  open,
  onClose,
  isMobile,
  width,
  onWidthChange,
  collapsed,
  onCollapsedChange,
}: BptSidebarProps) {
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, e.clientX),
      );
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  const { process_details } = bpt;

  // Count items for section headers
  const stepCount = process_details.process_steps.length;
  const resultCount = process_details.results.length;
  const sharedDataCount = process_details.shared_data.length;
  const predecessorCount = process_details.predecessor_processes.length;
  const successorCount = process_details.successor_processes.length;
  const failureCount = process_details.failures.length;
  const measureCount = process_details.performance_measures.length;
  const diagramCount = process_details.diagrams?.length || 0;

  const content = (
    <Box sx={{ p: 2, height: "100%", overflow: "auto" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontSize: "1rem", fontWeight: 600 }}>
            Business Process Template
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {bpt.process_name} • v{bpt.version} • {bpt.version_date}
          </Typography>
        </Box>
        {isMobile ? (
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        ) : (
          <IconButton
            onClick={() => onCollapsedChange(true)}
            size="small"
            title="Collapse sidebar"
          >
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

      {/* Description */}
      <Section title="Description" defaultExpanded={true}>
        <FormattedText text={process_details.description} />
      </Section>

      {/* Predecessor Processes */}
      {predecessorCount > 0 && (
        <Section title="Predecessor Processes" defaultExpanded={true}>
          <ProcessLinks
            processes={process_details.predecessor_processes}
            direction="predecessor"
          />
        </Section>
      )}

      {/* Trigger Events */}
      {(process_details.trigger_events.environment_based.length > 0 ||
        process_details.trigger_events.interaction_based.length > 0) && (
        <Section title="Trigger Events" defaultExpanded={true}>
          <TriggerEvents events={process_details.trigger_events} />
        </Section>
      )}

      {/* Process Steps */}
      {stepCount > 0 && (
        <Section title="Process Steps" defaultExpanded={true}>
          <ProcessSteps steps={process_details.process_steps} />
        </Section>
      )}

      {/* Results */}
      {resultCount > 0 && (
        <Section title="Results" defaultExpanded={true}>
          <SimpleList items={process_details.results} />
        </Section>
      )}

      {/* Successor Processes */}
      {successorCount > 0 && (
        <Section title="Successor Processes" defaultExpanded={true}>
          <ProcessLinks
            processes={process_details.successor_processes}
            direction="successor"
          />
        </Section>
      )}

      {/* Shared Data */}
      {sharedDataCount > 0 && (
        <Section title="Shared Data" defaultExpanded={false}>
          <SimpleList items={process_details.shared_data} />
        </Section>
      )}

      {/* Constraints */}
      {process_details.constraints && (
        <Section title="Constraints" defaultExpanded={true}>
          <ConstraintsSection constraints={process_details.constraints} />
        </Section>
      )}

      {/* Potential Failures */}
      {failureCount > 0 && (
        <Section title="Potential Failures" defaultExpanded={false}>
          <SimpleList items={process_details.failures} />
        </Section>
      )}

      {/* Performance Measures */}
      {measureCount > 0 && (
        <Section title="Performance Measures" defaultExpanded={false}>
          <SimpleList items={process_details.performance_measures} />
        </Section>
      )}

      {/* Diagrams */}
      {diagramCount > 0 && (
        <Section title="Diagrams" defaultExpanded={false}>
          <DiagramsSection diagrams={process_details.diagrams} />
        </Section>
      )}

      {/* Metadata footer */}
      <Box sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary">
          Source: {bpt.metadata.source_file}
        </Typography>
        {bpt.metadata.source_page_range && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block" }}
          >
            Pages: {bpt.metadata.source_page_range}
          </Typography>
        )}
      </Box>
    </Box>
  );

  // Mobile drawer
  if (isMobile) {
    return (
      <Drawer
        anchor="left"
        open={open}
        onClose={onClose}
        sx={{ "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH_MOBILE } }}
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
          borderColor: "divider",
          backgroundColor: "grey.50",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
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
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            mt: 2,
            color: "text.secondary",
          }}
        >
          Process Details
        </Typography>
      </Box>
    );
  }

  // Expanded desktop sidebar
  return (
    <Box
      sx={{
        width: width,
        flexShrink: 0,
        borderRight: 1,
        borderColor: "divider",
        backgroundColor: "grey.50",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        userSelect: isResizing ? "none" : "auto",
      }}
    >
      {content}
      {/* Resize handle */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 6,
          height: "100%",
          cursor: "col-resize",
          backgroundColor: isResizing ? "primary.main" : "transparent",
          transition: "background-color 0.15s",
          "&:hover": {
            backgroundColor: "primary.light",
          },
        }}
      />
    </Box>
  );
}
