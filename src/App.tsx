import { useState, useRef } from 'react';
import { useSheet } from './hooks/useSheet';
import { usePlayback } from './hooks/usePlayback';
import { SheetView } from './components/SheetView';
import { FileUpload } from './components/FileUpload';
import { PlaybackControls } from './components/PlaybackControls';
import { MusicSearch } from './components/MusicSearch';
import { ZoomControls } from './components/ZoomControls';
import { TrackSidebar } from './components/TrackSidebar';
import type { Note } from './types/note';
import { useEffect } from 'react';

function App() {
  const { sheet, updateNote, removeNote, setSheetData } = useSheet();
  const [mutedTracks, setMutedTracks] = useState<Set<number>>(new Set());
  const { isPlaying, currentTime, tempo, play, pause, stop, updateTempo } = usePlayback(sheet, mutedTracks);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [pixelsPerQuarter, setPixelsPerQuarter] = useState(50);
  
  // Track visibility state
  const [visibleTracks, setVisibleTracks] = useState<Set<number>>(new Set());
  const [soloTrack, setSoloTrack] = useState<number | null>(null);
  const prevStateRef = useRef<{ visible: Set<number>; muted: Set<number> } | null>(null);
  
  // Initialize visible tracks when sheet loads
  useEffect(() => {
    if (sheet?.tracks && sheet.tracks.length > 0) {
      // Show all tracks by default
      setVisibleTracks(new Set(sheet.tracks.map(t => t.id)));
      setMutedTracks(new Set());
      setSoloTrack(null);
      prevStateRef.current = null;
    } else {
      setVisibleTracks(new Set());
      setMutedTracks(new Set());
      setSoloTrack(null);
      prevStateRef.current = null;
    }
  }, [sheet]);
  
  // Handle solo toggle
  const handleToggleSolo = (trackId: number) => {
    if (soloTrack === trackId) {
      // Unsolo: restore previous state
      if (prevStateRef.current) {
        setVisibleTracks(new Set(prevStateRef.current.visible));
        setMutedTracks(new Set(prevStateRef.current.muted));
      } else {
        // If no previous state, show all tracks
        if (sheet?.tracks) {
          setVisibleTracks(new Set(sheet.tracks.map(t => t.id)));
          setMutedTracks(new Set());
        }
      }
      setSoloTrack(null);
      prevStateRef.current = null;
    } else {
      // Solo this track: save current state and solo
      prevStateRef.current = {
        visible: new Set(visibleTracks),
        muted: new Set(mutedTracks),
      };
      setSoloTrack(trackId);
      // Solo behavior: hide and mute all other tracks, show and unmute only the soloed track
      if (sheet?.tracks) {
        const allTrackIds = new Set(sheet.tracks.map(t => t.id));
        const otherTrackIds = new Set(allTrackIds);
        otherTrackIds.delete(trackId);
        
        // Hide all other tracks (only show the soloed track)
        setVisibleTracks(new Set([trackId]));
        // Mute all other tracks (only the soloed track will play)
        setMutedTracks(otherTrackIds);
      }
    }
  };
  
  // Restart playback if muted tracks change during playback
  const prevMutedTracksRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    // Check if muted tracks actually changed
    const mutedChanged = 
      prevMutedTracksRef.current.size !== mutedTracks.size ||
      Array.from(prevMutedTracksRef.current).some(id => !mutedTracks.has(id)) ||
      Array.from(mutedTracks).some(id => !prevMutedTracksRef.current.has(id));
    
    if (mutedChanged && isPlaying && sheet) {
      // Restart playback with new muted tracks
      const wasPlaying = isPlaying;
      stop();
      if (wasPlaying) {
        setTimeout(() => {
          play();
        }, 100);
      }
    }
    prevMutedTracksRef.current = new Set(mutedTracks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutedTracks, isPlaying, sheet]);

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
      // Don't handle shortcuts if user is typing in an input field
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).isContentEditable
      );
      
      if (isInputFocused) {
        return; // Let the input handle the key
      }
      
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
      {/* <div className="bg-white border-b border-gray-300 p-4">
        <h1 className="text-2xl font-bold text-gray-800">Piano Sheet Alternative</h1>
        <p className="text-sm text-gray-600">Visual music notation with 88-key piano rows</p>
      </div> */}

      {/* Controls */}
      {sheet && (
        <>
          <div className="flex items-center justify-between bg-gray-100 border-b border-gray-300">
            <div className="flex-1 flex justify-center">
              <MusicSearch onSheetLoaded={handleSheetLoaded} />
            </div>
            <ZoomControls pixelsPerQuarter={pixelsPerQuarter} onZoomChange={setPixelsPerQuarter} />
          </div>
          <PlaybackControls
            isPlaying={isPlaying}
            tempo={tempo}
            currentTime={currentTime}
            onPlay={handlePlay}
            onPause={pause}
            onStop={stop}
            onTempoChange={updateTempo}
          />
        </>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex">
        {!sheet ? (
          <div className="h-full flex items-center justify-center p-8 flex-1">
            <div className="w-full max-w-md">
              <FileUpload onSheetLoaded={handleSheetLoaded} />
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-hidden">
              <SheetView
                sheet={sheet}
                currentPlaybackTime={currentTime}
                isPlaying={isPlaying}
                onNoteSelect={handleNoteSelect}
                onNoteUpdate={handleNoteUpdate}
                onNoteDelete={handleNoteDelete}
                selectedNote={selectedNote}
                pixelsPerQuarter={pixelsPerQuarter}
                visibleTracks={visibleTracks.size > 0 ? visibleTracks : undefined}
              />
            </div>
            {sheet.tracks && sheet.tracks.length > 1 && (
              <TrackSidebar
                tracks={sheet.tracks}
                visibleTracks={visibleTracks}
                mutedTracks={mutedTracks}
                soloTrack={soloTrack}
                onToggleVisibility={(trackId) => {
                  if (soloTrack !== null) return; // Don't allow visibility changes when soloed
                  setVisibleTracks(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(trackId)) {
                      newSet.delete(trackId);
                    } else {
                      newSet.add(trackId);
                    }
                    return newSet;
                  });
                }}
                onToggleMute={(trackId) => {
                  if (soloTrack !== null) return; // Don't allow mute changes when soloed
                  setMutedTracks(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(trackId)) {
                      newSet.delete(trackId);
                    } else {
                      newSet.add(trackId);
                    }
                    return newSet;
                  });
                }}
                onToggleSolo={handleToggleSolo}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
