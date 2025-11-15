export interface Note {
  pitch: number; // MIDI pitch (0-127)
  startTime: number; // Start time in quarter notes
  duration: number; // Duration in quarter notes
  velocity: number; // MIDI velocity (0-127)
}

export interface Sheet {
  notes: Note[];
  tempo: number; // BPM
  timeSignature: {
    numerator: number; // Beats per bar (default 4)
    denominator: number; // Beat unit (default 4)
  };
}

