import { Midi } from '@tonejs/midi';
import type { Note, Sheet } from '../types/note';

export async function midiToSheet(midiFile: File | ArrayBuffer): Promise<Sheet> {
  let midi: Midi;
  
  if (midiFile instanceof File) {
    const arrayBuffer = await midiFile.arrayBuffer();
    midi = new Midi(arrayBuffer);
  } else {
    midi = new Midi(midiFile);
  }
  
  const notes: Note[] = [];
  const noteSet = new Set<string>(); // Track unique notes to prevent duplicates
  
  // Get tempo from MIDI header (default to 120 BPM)
  const tempo = midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120;
  
  // Convert seconds to quarter notes
  const secondsPerQuarter = 60 / tempo;
  
  // Extract notes from all tracks
  midi.tracks.forEach(track => {
    track.notes.forEach(midiNote => {
      // Filter out notes outside piano range (21-108 for 88-key piano)
      if (midiNote.midi < 21 || midiNote.midi > 108) {
        return;
      }
      
      // midiNote.time is in seconds, convert to quarter notes
      const startTime = midiNote.time / secondsPerQuarter;
      const duration = midiNote.duration / secondsPerQuarter;
      
      // Validate and filter out invalid notes
      if (startTime < 0 || duration <= 0 || isNaN(startTime) || isNaN(duration) || !isFinite(startTime) || !isFinite(duration)) {
        return;
      }
      
      // Create unique key to prevent duplicates (pitch + startTime rounded to 4 decimal places)
      const noteKey = `${midiNote.midi}-${startTime.toFixed(4)}`;
      if (noteSet.has(noteKey)) {
        return; // Skip duplicate note
      }
      noteSet.add(noteKey);
      
      notes.push({
        pitch: midiNote.midi,
        startTime,
        duration: Math.max(0.25, duration), // Ensure minimum duration
        velocity: Math.round(Math.max(0, Math.min(127, midiNote.velocity * 127))), // Clamp 0-127
      });
    });
  });
  
  // Sort notes by start time for better rendering
  notes.sort((a, b) => a.startTime - b.startTime);
  
  // Get time signature from MIDI header (default to 4/4)
  const timeSignature = midi.header.timeSignatures.length > 0
    ? {
        numerator: midi.header.timeSignatures[0].timeSignature[0],
        denominator: midi.header.timeSignatures[0].timeSignature[1],
      }
    : { numerator: 4, denominator: 4 };
  
  return {
    notes,
    tempo,
    timeSignature,
  };
}

