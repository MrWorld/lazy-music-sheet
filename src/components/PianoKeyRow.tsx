import { useMemo, memo } from 'react';
import type { Note } from '../types/note';
import type { PianoKey } from '../utils/pianoUtils';
import { NoteLine } from './NoteLine';

interface PianoKeyRowProps {
  keyInfo: PianoKey;
  notes: Note[];
  pixelsPerQuarter: number;
  onNoteSelect?: (note: Note) => void;
  onNoteUpdate?: (note: Note) => void;
  onNoteDelete?: (note: Note) => void;
  selectedNote?: Note | null;
  editMode?: 'select' | 'add' | 'delete';
  onRowClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  leftOffset: number;
  barStartTime: number;
  barEndTime: number;
}

export const PianoKeyRow = memo(function PianoKeyRow({
  keyInfo,
  notes,
  pixelsPerQuarter,
  onNoteSelect,
  onNoteUpdate,
  onNoteDelete,
  selectedNote,
  editMode = 'select',
  onRowClick,
  leftOffset,
  barStartTime,
  barEndTime,
}: PianoKeyRowProps) {
  // Filter notes for this key that fall within this bar
  const keyNotes = useMemo(() => {
    return notes.filter(note => 
      note.pitch === keyInfo.midiNote &&
      note.startTime < barEndTime &&
      (note.startTime + note.duration) > barStartTime
    );
  }, [notes, keyInfo.midiNote, barStartTime, barEndTime]);

  const isBlack = keyInfo.isBlack;
  const keyWidth = isBlack ? 12 : 20;

  return (
    <div
      className={`absolute border-r border-gray-300 ${
        isBlack ? 'bg-gray-800 h-8' : 'bg-white h-12'
      }`}
      onClick={onRowClick}
      style={{
        width: `${keyWidth}px`,
        left: `${leftOffset}px`,
        top: 0,
        bottom: 0,
        zIndex: isBlack ? 10 : 1,
      }}
    >
      {/* Faded piano key background pattern for 4/4 bar */}
      <div
        className="absolute top-0 bottom-0 left-0 right-0 opacity-20"
        style={{
          backgroundImage: isBlack
            ? 'repeating-linear-gradient(0deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'
            : 'repeating-linear-gradient(0deg, transparent, transparent 10px, rgba(0,0,0,0.05) 10px, rgba(0,0,0,0.05) 20px)',
        }}
      />

      {/* Quarter note grid lines - horizontal lines (time flows top to bottom) - further reduced for performance */}
      {(() => {
        // Only render grid lines every whole note (4 quarter notes) to reduce memory usage
        const numLines = Math.min(Math.ceil((barEndTime - barStartTime) / 1) + 1, 5); // Only every whole note, max 5 lines per bar
        return Array.from({ length: numLines }).map((_, i) => {
          const lineTime = barStartTime + i * 1;
          const lineTop = (lineTime - barStartTime) * pixelsPerQuarter;
          
          if (!isFinite(lineTop) || lineTop < 0 || lineTop > 4 * pixelsPerQuarter) {
            return null;
          }
          
          return (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-gray-200"
              style={{
                top: `${lineTop}px`,
                opacity: 0.2,
              }}
            />
          );
        });
      })()}

      {/* Note lines - vertical lines (time flows top to bottom) */}
      {keyNotes.map((note, index) => (
        <NoteLine
          key={index}
          note={note}
          pixelsPerQuarter={pixelsPerQuarter}
          onSelect={onNoteSelect}
          onUpdate={onNoteUpdate}
          onDelete={onNoteDelete}
          isSelected={selectedNote === note}
          editMode={editMode}
          barStartTime={barStartTime}
          barEndTime={barEndTime}
        />
      ))}
    </div>
  );
});
