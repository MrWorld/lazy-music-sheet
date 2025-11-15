import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { generatePianoKeys } from '../utils/pianoUtils';
import type { Note, Sheet } from '../types/note';
import { PianoKeyRow } from './PianoKeyRow';

interface SheetViewProps {
  sheet: Sheet | null;
  currentPlaybackTime?: number;
  isPlaying?: boolean;
  onNoteSelect?: (note: Note | null) => void;
  onNoteUpdate?: (oldNote: Note, newNote: Note) => void;
  onNoteDelete?: (note: Note) => void;
  selectedNote?: Note | null;
  onNoteAdd?: (note: Note) => void;
  pixelsPerQuarter?: number;
  editMode?: 'select' | 'add' | 'delete';
}

export function SheetView({
  sheet,
  currentPlaybackTime,
  isPlaying = false,
  onNoteSelect,
  onNoteUpdate,
  onNoteDelete,
  selectedNote,
  onNoteAdd,
  pixelsPerQuarter = 50,
  editMode = 'select',
}: SheetViewProps) {
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const keys = useMemo(() => generatePianoKeys(), []);

  // Calculate total duration
  const totalDuration = useMemo(() => {
    if (!sheet || sheet.notes.length === 0) return 16; // Default 4 bars
    const maxTime = Math.max(...sheet.notes.map(n => {
      const endTime = n.startTime + n.duration;
      return isFinite(endTime) && endTime > 0 ? endTime : 0;
    }));
    return Math.max(16, maxTime + 4); // Ensure minimum and add padding
  }, [sheet]);
  
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        if (height > 0 && height !== containerHeight) {
          setContainerHeight(height);
        }
      }
    };
    
    updateHeight();
    
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [containerHeight]);

  // const viewEndTime = viewStartTime + visibleDuration; // Not used in current implementation

  // Calculate how many 4/4 bars we need
  const numBars = useMemo(() => {
    return Math.ceil(totalDuration / 4);
  }, [totalDuration]);

  // Height of one bar (4 quarter notes)
  const barHeight = 4 * pixelsPerQuarter;

  // Width of one 88-key piano
  const pianoWidth = useMemo(() => {
    const whiteKeys = keys.filter(k => !k.isBlack).length;
    const blackKeys = keys.filter(k => k.isBlack).length;
    return whiteKeys * 20 + blackKeys * 12;
  }, [keys]);

  // Handle click to add note
  const handleRowClick = useCallback((event: React.MouseEvent<HTMLDivElement>, keyInfo: { midiNote: number }, barIndex: number) => {
    if (!sheet) return;

    if (editMode === 'add' && onNoteAdd) {
      const rect = event.currentTarget.getBoundingClientRect();
      const clickY = event.clientY - rect.top;
      const barStartTime = barIndex * 4;
      const clickTime = barStartTime + (clickY / pixelsPerQuarter);
      const roundedTime = Math.round(clickTime * 4) / 4;

      const newNote: Note = {
        pitch: keyInfo.midiNote,
        startTime: roundedTime,
        duration: 1,
        velocity: 100,
      };

      onNoteAdd(newNote);
    } else if (editMode === 'select') {
      onNoteSelect?.(null);
    }
  }, [sheet, onNoteAdd, onNoteSelect, pixelsPerQuarter, editMode]);

  const handleNoteUpdate = useCallback((updatedNote: Note) => {
    if (!sheet || !onNoteUpdate) return;
    
    let originalNote: Note | undefined;
    if (selectedNote && selectedNote.pitch === updatedNote.pitch) {
      originalNote = sheet.notes.find(
        n => n.pitch === selectedNote.pitch &&
             Math.abs(n.startTime - selectedNote.startTime) < 0.01 &&
             Math.abs(n.duration - selectedNote.duration) < 0.01
      );
    }
    
    if (!originalNote) {
      originalNote = sheet.notes.find(
        n => n.pitch === updatedNote.pitch &&
             ((Math.abs(n.startTime - (updatedNote.startTime - 0.1)) < 1.0) ||
              (Math.abs(n.startTime - updatedNote.startTime) < 0.5))
      );
    }
    
    if (originalNote) {
      onNoteUpdate(originalNote, updatedNote);
    }
  }, [sheet, onNoteUpdate, selectedNote]);

  const handleNoteDelete = useCallback((note: Note) => {
    onNoteDelete?.(note);
    if (selectedNote === note) {
      onNoteSelect?.(null);
    }
  }, [onNoteDelete, onNoteSelect, selectedNote]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevIsPlayingRef = useRef(false);

  // Reset scroll to top when playback starts
  useEffect(() => {
    if (isPlaying && !prevIsPlayingRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    prevIsPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Simple update on time change - just scroll, indicator is always at 20%
  useEffect(() => {
    if (!isPlaying || currentPlaybackTime === undefined || !scrollContainerRef.current || !sheet) {
      return;
    }

    const container = scrollContainerRef.current;
    const containerHeight = container.clientHeight;
    if (containerHeight === 0) return;

    const time = currentPlaybackTime;
    const ppq = pixelsPerQuarter;
    
    // Simple calculation: time * pixelsPerQuarter = absolute position
    const absoluteIndicatorPosition = time * ppq;
    const targetFixedPosition = containerHeight * 0.2;

    if (absoluteIndicatorPosition < targetFixedPosition) {
      // Phase 1: Keep scroll at 0
      if (container.scrollTop > 0) {
        container.scrollTop = 0;
      }
    } else {
      // Phase 2: Scroll to keep current time at 20% from top
      const targetScrollTop = absoluteIndicatorPosition - targetFixedPosition;
      // Update scroll smoothly - smaller threshold for smoother scrolling
      if (Math.abs(container.scrollTop - targetScrollTop) > 2) {
        container.scrollTop = targetScrollTop;
      }
    }
  }, [isPlaying, currentPlaybackTime, pixelsPerQuarter, sheet]);

  if (!sheet) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>No sheet loaded. Upload a MIDI file to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Time grid header */}
      <div className="relative h-8 bg-gray-200 border-b border-gray-300 overflow-x-auto">
        <div className="flex" style={{ width: `${pianoWidth}px` }}>
          <div className="px-2">
            <span className="text-xs text-gray-600">Time →</span>
          </div>
        </div>
      </div>

      {/* Scrollable sheet area - bars stack vertically */}
      <div
        ref={(node) => {
          containerRef.current = node;
          scrollContainerRef.current = node;
        }}
        className="flex-1 overflow-y-auto overflow-x-auto relative"
      >
        {/* Playback indicator - fixed at 20% from top of viewport */}
        {isPlaying && (
          <div
            className="absolute left-0 right-0 h-1 bg-red-500 z-50 pointer-events-none"
            style={{
              top: '20%',
              position: 'sticky',
            }}
          />
        )}
        
        <div
          style={{
            height: `${totalDuration * pixelsPerQuarter}px`,
            width: `${pianoWidth}px`,
            position: 'relative',
          }}
        >
          {/* Render each 4/4 bar as a row */}
          {Array.from({ length: numBars }).map((_, barIndex) => {
            const barStartTime = barIndex * 4;
            const barEndTime = (barIndex + 1) * 4;
            const barTop = barIndex * barHeight;
            
            return (
              <div
                key={barIndex}
                className="absolute left-0 right-0 border-b-2 border-blue-400"
                style={{
                  top: `${barTop}px`,
                  height: `${barHeight}px`,
                  width: `${pianoWidth}px`,
                }}
              >
                {/* Render all 88 keys horizontally within this bar */}
                <div className="relative h-full" style={{ width: `${pianoWidth}px` }}>
                  {keys.map((keyInfo, keyIndex) => {
                    let leftOffset = 0;
                    // Calculate left offset for this key
                    for (let i = 0; i < keyIndex; i++) {
                      if (keys[i].isBlack) {
                        leftOffset += 12;
                      } else {
                        leftOffset += 20;
                      }
                    }
                    
                    return (
                      <PianoKeyRow
                        key={keyInfo.midiNote}
                        keyInfo={keyInfo}
                        notes={sheet.notes}
                        pixelsPerQuarter={pixelsPerQuarter}
                        onNoteSelect={onNoteSelect}
                        onNoteUpdate={handleNoteUpdate}
                        onNoteDelete={handleNoteDelete}
                        selectedNote={selectedNote}
                        editMode={editMode}
                        onRowClick={(e) => handleRowClick(e, keyInfo, barIndex)}
                        leftOffset={leftOffset}
                        barStartTime={barStartTime}
                        barEndTime={barEndTime}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

