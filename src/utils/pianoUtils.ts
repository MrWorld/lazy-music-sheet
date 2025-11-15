// Piano key utilities for 88-key piano (A0 to C8)

export interface PianoKey {
  midiNote: number; // MIDI note number (21-108)
  name: string; // Note name (e.g., "C", "C#", "D")
  octave: number; // Octave number (0-8)
  isBlack: boolean; // Whether it's a black key
}

// Generate all 88 piano keys
export function generatePianoKeys(): PianoKey[] {
  const keys: PianoKey[] = [];
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // 88-key piano starts at A0 (MIDI 21) and ends at C8 (MIDI 108)
  // Standard MIDI: note % 12 gives note name (0=C, 1=C#, 2=D, ..., 9=A, 10=A#, 11=B)
  for (let midiNote = 21; midiNote <= 108; midiNote++) {
    const octave = Math.floor((midiNote - 12) / 12);
    const noteIndex = midiNote % 12; // Use standard MIDI note to name conversion
    const name = noteNames[noteIndex];
    const isBlack = name.includes('#');
    
    keys.push({
      midiNote,
      name,
      octave,
      isBlack,
    });
  }
  
  return keys;
}

// Get piano key for a MIDI note
export function getPianoKey(midiNote: number): PianoKey | null {
  if (midiNote < 21 || midiNote > 108) return null;
  const keys = generatePianoKeys();
  return keys[midiNote - 21];
}

// Calculate bar number from quarter notes
export function getBarNumber(quarterNotes: number, timeSignature: { numerator: number; denominator: number }): number {
  return Math.floor(quarterNotes / timeSignature.numerator);
}

// Calculate position within bar (0-1)
export function getPositionInBar(quarterNotes: number, timeSignature: { numerator: number; denominator: number }): number {
  return (quarterNotes % timeSignature.numerator) / timeSignature.numerator;
}

