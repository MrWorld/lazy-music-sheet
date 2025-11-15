import { useState } from 'react';
import { useSheet } from './hooks/useSheet';
import { usePlayback } from './hooks/usePlayback';
import { SheetView } from './components/SheetView';
import { FileUpload } from './components/FileUpload';
import { PlaybackControls } from './components/PlaybackControls';
import { EditToolbar } from './components/EditToolbar';
import { ZoomControls } from './components/ZoomControls';
import type { Note } from './types/note';
import { useEffect } from 'react';

function App() {
  const { sheet, addNote, updateNote, removeNote, setSheetData } = useSheet();
  const { isPlaying, currentTime, tempo, play, pause, stop, updateTempo } = usePlayback(sheet);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [editMode, setEditMode] = useState<'select' | 'add' | 'delete'>('select');
  const [pixelsPerQuarter, setPixelsPerQuarter] = useState(50);

  const handleNoteDelete = (note: Note) => {
    if (!sheet) return;
    const noteIndex = sheet.notes.findIndex(
      n => n.pitch === note.pitch && 
           n.startTime === note.startTime &&
           n.duration === note.duration
    );
    if (noteIndex !== -1) {
      removeNote(noteIndex);
      if (selectedNote === note) {
        setSelectedNote(null);
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Space bar to play/pause
      if (e.code === 'Space' && sheet) {
        e.preventDefault();
        if (isPlaying) {
          pause();
        } else {
          play();
        }
      }
      // Delete key to delete selected note
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNote && sheet) {
        e.preventDefault();
        handleNoteDelete(selectedNote);
      }
      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedNote(null);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [sheet, isPlaying, selectedNote, play, pause, removeNote]);

  const handleSheetLoaded = (newSheet: typeof sheet) => {
    if (newSheet) {
      setSheetData(newSheet);
      updateTempo(newSheet.tempo);
    }
  };

  const handlePlay = () => {
    if (sheet) {
      play();
    }
  };

  const handleNoteAdd = (note: Note) => {
    addNote(note);
  };

  const handleNoteSelect = (note: Note | null) => {
    setSelectedNote(note);
  };

  const handleNoteUpdate = (oldNote: Note, newNote: Note) => {
    if (!sheet) return;
    const noteIndex = sheet.notes.findIndex(
      n => n.pitch === oldNote.pitch && 
           n.startTime === oldNote.startTime &&
           n.duration === oldNote.duration
    );
    if (noteIndex !== -1) {
      updateNote(noteIndex, newNote);
      if (selectedNote && selectedNote === oldNote) {
        setSelectedNote(newNote);
      }
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-300 p-4">
        <h1 className="text-2xl font-bold text-gray-800">Piano Sheet Alternative</h1>
        <p className="text-sm text-gray-600">Visual music notation with 88-key piano rows</p>
      </div>

      {/* Controls */}
      {sheet && (
        <>
          <div className="flex items-center justify-between bg-gray-100 border-b border-gray-300">
            <EditToolbar mode={editMode} onModeChange={setEditMode} />
            <ZoomControls pixelsPerQuarter={pixelsPerQuarter} onZoomChange={setPixelsPerQuarter} />
          </div>
          <PlaybackControls
            isPlaying={isPlaying}
            tempo={tempo}
            onPlay={handlePlay}
            onPause={pause}
            onStop={stop}
            onTempoChange={updateTempo}
          />
        </>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {!sheet ? (
          <div className="h-full flex items-center justify-center p-8">
            <div className="w-full max-w-md">
              <FileUpload onSheetLoaded={handleSheetLoaded} />
            </div>
          </div>
        ) : (
          <SheetView
            sheet={sheet}
            currentPlaybackTime={currentTime}
            onNoteSelect={handleNoteSelect}
            onNoteUpdate={handleNoteUpdate}
            onNoteDelete={handleNoteDelete}
            selectedNote={selectedNote}
            onNoteAdd={handleNoteAdd}
            pixelsPerQuarter={pixelsPerQuarter}
            editMode={editMode}
          />
        )}
      </div>
    </div>
  );
}

export default App;
