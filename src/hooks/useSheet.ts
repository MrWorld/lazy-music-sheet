import { useState, useCallback } from 'react';
import type { Sheet, Note } from '../types/note';

export function useSheet(initialSheet?: Sheet) {
  const [sheet, setSheet] = useState<Sheet | null>(initialSheet || null);

  const addNote = useCallback((note: Note) => {
    setSheet(prev => {
      if (!prev) return null;
      return {
        ...prev,
        notes: [...prev.notes, note],
      };
    });
  }, []);

  const removeNote = useCallback((index: number) => {
    setSheet(prev => {
      if (!prev) return null;
      return {
        ...prev,
        notes: prev.notes.filter((_, i) => i !== index),
      };
    });
  }, []);

  const updateNote = useCallback((index: number, note: Note) => {
    setSheet(prev => {
      if (!prev) return null;
      const newNotes = [...prev.notes];
      newNotes[index] = note;
      return {
        ...prev,
        notes: newNotes,
      };
    });
  }, []);

  const setSheetData = useCallback((newSheet: Sheet) => {
    setSheet(newSheet);
  }, []);

  const clearSheet = useCallback(() => {
    setSheet(null);
  }, []);

  return {
    sheet,
    addNote,
    removeNote,
    updateNote,
    setSheetData,
    clearSheet,
  };
}

