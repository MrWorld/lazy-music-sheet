import { useState, useRef, useMemo, useCallback, useEffect, memo } from 'react';
import * as Tone from 'tone';
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
  pixelsPerQuarter?: number;
  visibleTracks?: Set<number>; // Tracks to show in the view
}

export const SheetView = memo(function SheetView({
  sheet,
  currentPlaybackTime,
  isPlaying = false,
  onNoteSelect,
  onNoteUpdate,
  onNoteDelete,
  selectedNote,
  pixelsPerQuarter = 50,
  visibleTracks,
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

  // Handle click to deselect note
  const handleRowClick = useCallback(() => {
    if (!sheet) return;
    // Deselect when clicking empty space
    onNoteSelect?.(null);
  }, [sheet, onNoteSelect]);

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
  const currentTimeRef = useRef<number>(0);
  const pixelsPerQuarterRef = useRef<number>(pixelsPerQuarter);
  const isPlayingRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  const userScrollingRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Keep refs updated
  useEffect(() => {
    currentTimeRef.current = currentPlaybackTime ?? 0;
  }, [currentPlaybackTime]);

  useEffect(() => {
    pixelsPerQuarterRef.current = pixelsPerQuarter;
  }, [pixelsPerQuarter]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Reset scroll to top when playback starts
  useEffect(() => {
    if (isPlaying && !prevIsPlayingRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      currentTimeRef.current = 0;
    }
    prevIsPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Combined indicator and scroll update - single loop for better performance
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const [showIndicator, setShowIndicator] = useState(false);
  const sheetRef = useRef(sheet);
  const pixelsPerQuarterForIndicatorRef = useRef(pixelsPerQuarter);
  
  // Viewport-based rendering - only render visible bars for performance
  const [visibleBarRange, setVisibleBarRange] = useState({ start: 0, end: 10 });
  
  // Keep refs in sync
  useEffect(() => {
    sheetRef.current = sheet;
    pixelsPerQuarterForIndicatorRef.current = pixelsPerQuarter;
  }, [sheet, pixelsPerQuarter]);
  
  // Update visible bar range based on scroll position
  useEffect(() => {
    if (!scrollContainerRef.current || !sheet) return;
    
    const updateVisibleBars = () => {
      const container = scrollContainerRef.current;
      if (!container) return;
      
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const viewportTop = scrollTop;
      const viewportBottom = scrollTop + containerHeight;
      
      // Calculate which bars are visible (with padding)
      const barHeight = 4 * pixelsPerQuarter;
      const padding = 2; // Render 2 extra bars above and below
      const startBar = Math.max(0, Math.floor(viewportTop / barHeight) - padding);
      const endBar = Math.min(numBars, Math.ceil(viewportBottom / barHeight) + padding);
      
      setVisibleBarRange({ start: startBar, end: endBar });
    };
    
    const container = scrollContainerRef.current;
    container.addEventListener('scroll', updateVisibleBars, { passive: true });
    updateVisibleBars(); // Initial calculation
    
    return () => {
      container.removeEventListener('scroll', updateVisibleBars);
    };
  }, [sheet, pixelsPerQuarter, numBars]);

  // Track manual scrolling - detect when user scrolls manually
  const isAutoScrollingRef = useRef<boolean>(false);
  
  const handleScroll = useCallback(() => {
    if (!isPlaying) return; // Allow manual scroll when not playing
    
    // If we just auto-scrolled, ignore this event
    if (isAutoScrollingRef.current) {
      isAutoScrollingRef.current = false;
      return;
    }
    
    // User is manually scrolling
    userScrollingRef.current = true;
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Reset user scrolling flag after 1.5 seconds of no scrolling
    scrollTimeoutRef.current = window.setTimeout(() => {
      userScrollingRef.current = false;
    }, 50);
  }, [isPlaying]);

  // Combined indicator and scroll update loop - single loop for better performance
  useEffect(() => {
    if (!isPlaying || !scrollContainerRef.current || !sheet) {
      setShowIndicator(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const container = scrollContainerRef.current;
    container.addEventListener('scroll', handleScroll, { passive: true });
    setShowIndicator(true);

    // Combined update function - updates both indicator and scroll in one loop
    // Throttle to 30fps (33ms) for better performance
    let lastUpdateTime = 0;
    const update = () => {
      if (!isPlayingRef.current || !container) {
        return;
      }

      const now = performance.now();
      // Throttle to 15fps (66ms) to prevent performance issues
      if (now - lastUpdateTime < 66) {
        animationFrameRef.current = requestAnimationFrame(update);
        return;
      }
      lastUpdateTime = now;

      const transportState = Tone.Transport.state;
      if (transportState !== 'started') {
        animationFrameRef.current = requestAnimationFrame(update);
        return;
      }

      // Cache Transport.seconds read - it's expensive
      const elapsed = Tone.Transport.seconds;
      const secondsPerQuarter = 60 / (sheetRef.current?.tempo || 120);
      const quarterNotes = elapsed / secondsPerQuarter;
      const ppq = pixelsPerQuarterForIndicatorRef.current;
      
      // Update indicator position using transform for better performance
      if (indicatorRef.current) {
        const position = quarterNotes * ppq;
        // Use transform instead of top for better performance (GPU accelerated)
        indicatorRef.current.style.transform = `translateY(${position}px)`;
      }

      // Update scroll position (only if not manually scrolling)
      if (!userScrollingRef.current) {
        const containerHeight = container.clientHeight;
        if (containerHeight > 0) {
          const absolutePosition = quarterNotes * ppq;
          const targetFixedPosition = containerHeight * 0.2;
          
          let targetScrollTop: number;
          if (absolutePosition < targetFixedPosition) {
            targetScrollTop = 0;
          } else {
            targetScrollTop = absolutePosition - targetFixedPosition;
          }
          
          const currentScroll = container.scrollTop;
          // Only update if difference is significant to reduce DOM writes
          if (Math.abs(currentScroll - targetScrollTop) > 1) {
            isAutoScrollingRef.current = true;
            container.scrollTop = targetScrollTop;
            
            // Update visible bar range after scroll (throttled)
            const barHeight = 4 * pixelsPerQuarterForIndicatorRef.current;
            const padding = 2;
            const startBar = Math.max(0, Math.floor(targetScrollTop / barHeight) - padding);
            const endBar = Math.min(numBars, Math.ceil((targetScrollTop + containerHeight) / barHeight) + padding);
            setVisibleBarRange(prev => {
              // Only update if range changed significantly to avoid unnecessary re-renders
              if (Math.abs(prev.start - startBar) > 1 || Math.abs(prev.end - endBar) > 1) {
                return { start: startBar, end: endBar };
              }
              return prev;
            });
          }
        }
      }

      // Continue loop
      if (isPlayingRef.current) {
        animationFrameRef.current = requestAnimationFrame(update);
      }
    };

    animationFrameRef.current = requestAnimationFrame(update);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isPlaying, sheet, handleScroll]);

  if (!sheet) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>No sheet loaded. Upload a MIDI file to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Time grid header with note names and octave labels */}
      <div className="relative bg-gray-200 border-b border-gray-300 overflow-x-auto">
        {/* Octave labels row */}
        <div className="relative h-6" style={{ width: `${pianoWidth}px` }}>
          {(() => {
            const octaveGroups: { [octave: number]: { startOffset: number; endOffset: number } } = {};
            let currentOffset = 0;
            
            keys.forEach((keyInfo) => {
              if (!keyInfo.isBlack) {
                const keyWidth = 20;
                if (!octaveGroups[keyInfo.octave]) {
                  octaveGroups[keyInfo.octave] = { startOffset: currentOffset, endOffset: currentOffset };
                }
                octaveGroups[keyInfo.octave].endOffset = currentOffset + keyWidth;
                currentOffset += keyWidth;
              } else {
                currentOffset += 12;
              }
            });
            
            return Object.entries(octaveGroups).map(([octave, range]) => {
              const octaveNum = parseInt(octave);
              const octaveColors = [
                'rgba(255, 200, 200, 0.8)', // Octave 0 - light red
                'rgba(200, 255, 200, 0.8)', // Octave 1 - light green
                'rgba(200, 200, 255, 0.8)', // Octave 2 - light blue
                'rgba(255, 255, 200, 0.8)', // Octave 3 - light yellow
                'rgba(255, 200, 255, 0.8)', // Octave 4 - light magenta
                'rgba(200, 255, 255, 0.8)', // Octave 5 - light cyan
                'rgba(255, 220, 200, 0.8)', // Octave 6 - light orange
                'rgba(220, 200, 255, 0.8)', // Octave 7 - light purple
                'rgba(200, 220, 255, 0.8)', // Octave 8 - light blue-purple
              ];
              const octaveColor = octaveColors[Math.min(octaveNum, octaveColors.length - 1)] || 'rgba(200, 200, 200, 0.5)';
              
              return (
                <div
                  key={`octave-${octave}`}
                  className="absolute top-0 flex items-center justify-center text-xs font-bold text-gray-800"
                  style={{
                    left: `${range.startOffset}px`,
                    width: `${range.endOffset - range.startOffset}px`,
                    height: '100%',
                    backgroundColor: octaveColor,
                  }}
                >
                  Octave {octave}
                </div>
              );
            });
          })()}
        </div>
        
        {/* Note names row */}
        <div className="relative h-8" style={{ width: `${pianoWidth}px` }}>
          {keys.map((keyInfo, keyIndex) => {
            let leftOffset = 0;
            // Calculate left offset for this key (same calculation as in bar rendering)
            for (let i = 0; i < keyIndex; i++) {
              if (keys[i].isBlack) {
                leftOffset += 12;
              } else {
                leftOffset += 20;
              }
            }
            
            const keyWidth = keyInfo.isBlack ? 12 : 20;
            // Only show note names on white keys (black keys are too narrow)
            if (!keyInfo.isBlack) {
              // Octave colors with 50% opacity
              const octaveColors = [
                'rgba(255, 200, 200, 0.8)', // Octave 0 - light red
                'rgba(200, 255, 200, 0.8)', // Octave 1 - light green
                'rgba(200, 200, 255, 0.8)', // Octave 2 - light blue
                'rgba(255, 255, 200, 0.8)', // Octave 3 - light yellow
                'rgba(255, 200, 255, 0.8)', // Octave 4 - light magenta
                'rgba(200, 255, 255, 0.8)', // Octave 5 - light cyan
                'rgba(255, 220, 200, 0.8)', // Octave 6 - light orange
                'rgba(220, 200, 255, 0.8)', // Octave 7 - light purple
                'rgba(200, 220, 255, 0.8)', // Octave 8 - light blue-purple
              ];
              const octaveColor = octaveColors[Math.min(keyInfo.octave, octaveColors.length - 1)] || 'rgba(0, 0, 0, 1)';
              
              return (
                <div
                  key={keyInfo.midiNote}
                  className="absolute top-0 flex items-center justify-center text-xs font-bold text-gray-700"
                  style={{
                    left: `${leftOffset}px`,
                    width: `${keyWidth}px`,
                    height: '100%',
                    backgroundColor: octaveColor,
                  }}
                >
                  {keyInfo.name} <span className="font-light text-gray-900 text-[8px]">{keyInfo.octave}</span>
                </div>
              );
            }
            return null;
          })}
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
        <div
          style={{
            height: `${totalDuration * pixelsPerQuarter}px`,
            width: `${pianoWidth}px`,
            position: 'relative',
          }}
        >
          {/* Playback indicator - positioned at actual playback time on the sheet */}
          {showIndicator && (
            <div
              ref={indicatorRef}
              className="absolute left-0 right-0 h-[2px] bg-red-600 z-50 pointer-events-none"
              style={{
                top: '0px',
                willChange: 'transform', // Hint to browser for GPU acceleration
              }}
            />
          )}
          {/* Render only visible bars for performance (viewport-based rendering) */}
          {Array.from({ length: visibleBarRange.end - visibleBarRange.start }, (_, i) => {
            const barIndex = visibleBarRange.start + i;
            
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
                    // Calculate left offset for this key (memoize this calculation)
                    for (let i = 0; i < keyIndex; i++) {
                      if (keys[i].isBlack) {
                        leftOffset += 12;
                      } else {
                        leftOffset += 20;
                      }
                    }
                    
                    // Filter notes for this key and visible tracks
                    const filteredNotes = visibleTracks && visibleTracks.size > 0
                      ? sheet.notes.filter(note => 
                          note.pitch === keyInfo.midiNote &&
                          (!note.trackId || visibleTracks.has(note.trackId))
                        )
                      : sheet.notes.filter(note => note.pitch === keyInfo.midiNote);
                    
                    return (
                      <PianoKeyRow
                        key={keyInfo.midiNote}
                        keyInfo={keyInfo}
                        notes={filteredNotes}
                        pixelsPerQuarter={pixelsPerQuarter}
                        onNoteSelect={onNoteSelect}
                        onNoteUpdate={handleNoteUpdate}
                        onNoteDelete={handleNoteDelete}
                        selectedNote={selectedNote}
                        onRowClick={handleRowClick}
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
});

