/**
 * State Name Dialog
 *
 * Prompts user for state name before export operations.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
} from '@mui/material';

interface StateNameDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (stateName: string) => void;
  exportType: string;
}

export function StateNameDialog({
  open,
  onClose,
  onConfirm,
  exportType,
}: StateNameDialogProps) {
  const [stateName, setStateName] = useState('');

  const handleConfirm = () => {
    onConfirm(stateName || 'State');
    setStateName('');
  };

  const handleClose = () => {
    setStateName('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Enter State Name</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter your state name to include in the {exportType}. This helps identify the source
          of the assessment data.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="State Name"
          placeholder="e.g., California, Texas, New York"
          value={stateName}
          onChange={(e) => setStateName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleConfirm();
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained">
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
}
