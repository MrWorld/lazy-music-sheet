import { useState, useRef, useEffect, useCallback } from 'react';
import type { Note } from '../types/note';

interface NoteLineProps {
  note: Note;
  pixelsPerQuarter: number;
  onSelect?: (note: Note) => void;
  onUpdate?: (note: Note) => void;
  onDelete?: (note: Note) => void;
  isSelected?: boolean;
  editMode?: 'select' | 'add' | 'delete';
  barStartTime: number;
  barEndTime: number;
}

export function NoteLine({
  note,
  pixelsPerQuarter,
  onSelect,
  onUpdate,
  onDelete,
  isSelected,
  editMode = 'select',
  barStartTime,
  barEndTime,
}: NoteLineProps) {
  // ALL HOOKS MUST BE CALLED FIRST
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'move' | 'resize-end' | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; note: Note } | null>(null);
  const dragTypeRef = useRef<'move' | 'resize-end' | null>(null);
  
  useEffect(() => {
    dragTypeRef.current = dragType;
  }, [dragType]);

  // Calculate position - time flows top to bottom, so top = startTime, height = duration
  const noteStart = note.startTime;
  const noteEnd = note.startTime + note.duration;
  
  // Only show if note is in this bar
  if (noteEnd <= barStartTime || noteStart >= barEndTime) {
    return null;
  }
  
  const visibleStart = Math.max(noteStart, barStartTime);
  const visibleEnd = Math.min(noteEnd, barEndTime);
  const visibleDuration = visibleEnd - visibleStart;
  
  // Top position relative to bar start (time flows vertically)
  const top = (visibleStart - barStartTime) * pixelsPerQuarter;
  const height = Math.max(2, visibleDuration * pixelsPerQuarter);
  
  const isVisible = noteEnd > barStartTime && noteStart < barEndTime;
  const isValid = isFinite(top) && isFinite(height) && top >= -10000 && top <= 100000 && height >= 0 && height <= 100000;
  
  const intensity = note.velocity / 127;
  const color = isSelected 
    ? 'rgb(59, 130, 246)'
    : `rgb(${Math.floor(100 + intensity * 100)}, ${Math.floor(150 + intensity * 50)}, ${Math.floor(200 + intensity * 55)})`;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editMode === 'delete') {
      onDelete?.(note);
      return;
    }

    if (editMode === 'add' || !onUpdate) {
      onSelect?.(note);
      return;
    }

    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const isNearEnd = clickY > height - 10;
    
    const newDragType = isNearEnd ? 'resize-end' : 'move';
    setIsDragging(true);
    setDragType(newDragType);
    dragTypeRef.current = newDragType;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      note: { ...note },
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStartRef.current || !onUpdate) return;

    const deltaY = (e.clientY - dragStartRef.current.y) / pixelsPerQuarter;
    const deltaTime = deltaY;
    const originalNote = dragStartRef.current.note;
    const currentDragType = dragTypeRef.current;

    if (currentDragType === 'resize-end') {
      const newDuration = Math.max(0.25, originalNote.duration + deltaTime);
      onUpdate({
        ...originalNote,
        duration: Math.round(newDuration * 4) / 4,
      });
    } else if (currentDragType === 'move') {
      const newStartTime = originalNote.startTime + deltaTime;
      onUpdate({
        ...originalNote,
        startTime: Math.max(0, Math.round(newStartTime * 4) / 4),
      });
    }
  }, [isDragging, pixelsPerQuarter, onUpdate]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragType(null);
    dragStartRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (editMode === 'delete' || editMode === 'select') {
      onDelete?.(note);
    }
  };
  
  if (!isVisible || !isValid) {
    return null;
  }
  
  return (
    <div
      className={`absolute left-0 right-0 transition-opacity ${
        editMode === 'delete' ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
      } ${isSelected ? 'z-20' : 'z-10'}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor: color,
        opacity: isSelected ? 0.9 : 0.7,
        borderLeft: '2px solid rgba(0, 0, 0, 0.3)',
        borderRight: '2px solid rgba(0, 0, 0, 0.3)',
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      title={`Note: ${note.pitch}, Duration: ${note.duration.toFixed(2)} quarters`}
    >
      {isSelected && editMode === 'select' && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2 bg-blue-600 cursor-ns-resize opacity-50 hover:opacity-100"
          style={{ height: '10px' }}
        />
      )}
    </div>
  );
}
