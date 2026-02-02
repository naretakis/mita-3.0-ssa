/**
 * Tag Input Component
 *
 * Autocomplete input for managing assessment tags with free-form entry.
 */

import { useState } from "react";
import { Autocomplete, Box, Chip, TextField } from "@mui/material";
import { useTags } from "../../hooks/useTags";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ tags, onChange }: TagInputProps) {
  const { tags: allTags, normalizeTag, isValidTag } = useTags();
  const [inputValue, setInputValue] = useState("");

  const suggestions = allTags.map((t) => t.name);

  const commitTag = (value: string) => {
    if (!value.trim()) return;
    const normalized = normalizeTag(value.trim());
    if (isValidTag(value) && !tags.includes(normalized)) {
      onChange([...tags, normalized]);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && inputValue.trim()) {
      event.preventDefault();
      commitTag(inputValue);
      setInputValue("");
    }
  };

  const handleBlur = () => {
    // Commit any pending input when user clicks away
    if (inputValue.trim()) {
      commitTag(inputValue);
      setInputValue("");
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
          const normalized = newValue.map((v) => normalizeTag(v));
          onChange(normalized.filter((v, i, arr) => arr.indexOf(v) === i));
        }}
        onBlur={handleBlur}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={
              tags.length === 0 ? "Add tags (e.g., #provider-module)" : ""
            }
            onKeyDown={handleKeyDown}
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
    </Box>
  );
}
