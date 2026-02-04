/**
 * BptSidebar - Business Process Template Sidebar Component
 *
 * A collapsible/resizable sidebar wrapper for BptContent.
 * Used in the Assessment page to show process details alongside the assessment.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Drawer,
  IconButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { BptContent } from "../bpt";
import type { BPT } from "../../types";

// ============================================
// Constants
// ============================================

const SIDEBAR_WIDTH_MOBILE = 320;
const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 800;

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

      {/* BPT Content - reuse shared component */}
      <BptContent bpt={bpt} showHeader={false} showMetadata={true} />
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
