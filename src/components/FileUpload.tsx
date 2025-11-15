import { useRef } from 'react';
import { midiToSheet } from '../utils/midiConverter';
import type { Sheet } from '../types/note';

interface FileUploadProps {
  onSheetLoaded: (sheet: Sheet) => void;
}

export function FileUpload({ onSheetLoaded }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    
    if (!file.name.toLowerCase().endsWith('.mid') && !file.name.toLowerCase().endsWith('.midi')) {
      alert('Please select a MIDI file (.mid or .midi)');
      return;
    }

    try {
      const sheet = await midiToSheet(file);
      if (!sheet || sheet.notes.length === 0) {
        alert('MIDI file loaded but contains no notes in the piano range (A0-C8).');
        return;
      }
      onSheetLoaded(sheet);
    } catch (error) {
      console.error('Error loading MIDI file:', error);
      alert(`Failed to load MIDI file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try another file.`);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    
    if (!file) {
      return;
    }
    
    if (!file.name.toLowerCase().endsWith('.mid') && !file.name.toLowerCase().endsWith('.midi')) {
      alert('Please drop a MIDI file (.mid or .midi)');
      return;
    }

    try {
      const sheet = await midiToSheet(file);
      if (!sheet || sheet.notes.length === 0) {
        alert('MIDI file loaded but contains no notes in the piano range (A0-C8).');
        return;
      }
      onSheetLoaded(sheet);
    } catch (error) {
      console.error('Error loading MIDI file:', error);
      alert(`Failed to load MIDI file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try another file.`);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div
      className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".mid,.midi"
        onChange={handleFileSelect}
        className="hidden"
      />
      <div className="space-y-2">
        <p className="text-lg font-medium">Upload MIDI File</p>
        <p className="text-sm text-gray-500">Click or drag and drop a MIDI file here</p>
      </div>
    </div>
  );
}

