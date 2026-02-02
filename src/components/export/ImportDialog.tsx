/**
 * Import Dialog
 *
 * Handles file selection and import process for ZIP and JSON files.
 */

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import FolderZipIcon from "@mui/icons-material/FolderZip";
import DataObjectIcon from "@mui/icons-material/DataObject";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import HistoryIcon from "@mui/icons-material/History";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import {
  importFromJson,
  importFromZip,
  readFileAsText,
} from "../../services/export";
import type { ImportResult } from "../../services/export";

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export function ImportDialog({
  open,
  onClose,
  onImportComplete,
}: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (selectedFile) {
        const isValid =
          selectedFile.name.endsWith(".zip") ||
          selectedFile.name.endsWith(".json");
        if (isValid) {
          setFile(selectedFile);
          setError(null);
          setResult(null);
        } else {
          setError("Please select a .zip or .json file");
        }
      }
      event.target.value = "";
    },
    [],
  );

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      const isValid =
        droppedFile.name.endsWith(".zip") || droppedFile.name.endsWith(".json");
      if (isValid) {
        setFile(droppedFile);
        setError(null);
        setResult(null);
      } else {
        setError("Please select a .zip or .json file");
      }
    }
  }, []);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      let importResult: ImportResult;

      const onProgress = (p: number, message: string) => {
        setProgress(p);
        setProgressMessage(message);
      };

      if (file.name.endsWith(".zip")) {
        importResult = await importFromZip(file, onProgress);
      } else {
        const jsonString = await readFileAsText(file);
        importResult = await importFromJson(jsonString, onProgress);
      }

      setResult(importResult);

      if (importResult.success) {
        onImportComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      setProgress(0);
      setProgressMessage("");
    }
  };

  const handleClose = () => {
    if (!importing) {
      setFile(null);
      setResult(null);
      setError(null);
      onClose();
    }
  };

  const getFileIcon = () => {
    if (!file) return null;
    if (file.name.endsWith(".zip")) {
      return <FolderZipIcon sx={{ fontSize: 48, color: "primary.main" }} />;
    }
    return <DataObjectIcon sx={{ fontSize: 48, color: "info.main" }} />;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import Assessment Data</DialogTitle>
      <DialogContent>
        {!result ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select a backup file to import. Supports ZIP (complete backup with
              attachments) and JSON (data only) files.
            </Typography>

            {/* Drop zone */}
            <Paper
              variant="outlined"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              sx={{
                p: 3,
                textAlign: "center",
                bgcolor: file ? "primary.50" : "grey.50",
                borderStyle: "dashed",
                borderColor: file ? "primary.main" : "grey.300",
                cursor: importing ? "not-allowed" : "pointer",
              }}
            >
              <input
                type="file"
                id="import-file-input"
                accept=".zip,.json"
                onChange={handleFileSelect}
                disabled={importing}
                style={{ display: "none" }}
              />
              <label htmlFor="import-file-input">
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  {file ? (
                    <>
                      {getFileIcon()}
                      <Typography variant="body1" fontWeight={500}>
                        {file.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {(file.size / 1024).toFixed(1)} KB
                      </Typography>
                    </>
                  ) : (
                    <>
                      <CloudUploadIcon
                        sx={{ fontSize: 48, color: "action.active" }}
                      />
                      <Typography variant="body1">
                        Drop file here or click to select
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Supports .zip and .json files
                      </Typography>
                    </>
                  )}
                </Box>
              </label>
            </Paper>

            {importing && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress variant="determinate" value={progress} />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  {progressMessage || "Processing..."}
                </Typography>
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </>
        ) : (
          <>
            {/* Import Results */}
            <Alert
              severity={result.success ? "success" : "warning"}
              sx={{ mb: 2 }}
            >
              {result.success
                ? "Import completed successfully!"
                : `Import completed with ${result.errors.length} error(s)`}
            </Alert>

            <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
              <Chip
                icon={<CheckCircleIcon />}
                label={`${result.importedAsCurrent} imported as current`}
                color="success"
                variant="outlined"
              />
              <Chip
                icon={<HistoryIcon />}
                label={`${result.importedAsHistory} added to history`}
                color="info"
                variant="outlined"
              />
              <Chip
                icon={<SkipNextIcon />}
                label={`${result.skipped} skipped`}
                variant="outlined"
              />
            </Box>

            {result.attachmentsRestored > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {result.attachmentsRestored} attachment(s) restored.
              </Typography>
            )}

            {result.details.length > 0 && (
              <Box sx={{ maxHeight: 200, overflow: "auto" }}>
                <List dense>
                  {result.details.slice(0, 10).map((item, index) => (
                    <ListItem key={index} disableGutters>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {item.action === "imported_current" && (
                          <CheckCircleIcon fontSize="small" color="success" />
                        )}
                        {item.action === "imported_history" && (
                          <HistoryIcon fontSize="small" color="info" />
                        )}
                        {item.action === "skipped" && (
                          <SkipNextIcon fontSize="small" color="action" />
                        )}
                        {item.action === "error" && (
                          <ErrorIcon fontSize="small" color="error" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.capabilityName}
                        secondary={item.reason}
                        primaryTypographyProps={{ variant: "body2" }}
                        secondaryTypographyProps={{ variant: "caption" }}
                      />
                    </ListItem>
                  ))}
                  {result.details.length > 10 && (
                    <ListItem disableGutters>
                      <ListItemText
                        primary={`... and ${result.details.length - 10} more`}
                        primaryTypographyProps={{
                          variant: "body2",
                          color: "text.secondary",
                        }}
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {!result ? (
          <>
            <Button onClick={handleClose} disabled={importing}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              variant="contained"
              disabled={!file || importing}
            >
              {importing ? "Importing..." : "Import"}
            </Button>
          </>
        ) : (
          <Button onClick={handleClose} variant="contained">
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
