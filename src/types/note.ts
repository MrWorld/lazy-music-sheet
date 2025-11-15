export interface Note {
  pitch: number; // MIDI pitch (0-127)
  startTime: number; // Start time in quarter notes
  duration: number; // Duration in quarter notes
  velocity: number; // MIDI velocity (0-127)
  trackId?: number; // Track/instrument ID (optional for backward compatibility)
}

export interface Track {
  id: number;
  name: string;
  instrument?: string;
  programNumber?: number; // MIDI program number (0-127)
  channel?: number; // MIDI channel (0-15)
}

export interface Sheet {
  notes: Note[];
  tempo: number; // BPM
  timeSignature: {
    numerator: number; // Beats per bar (default 4)
    denominator: number; // Beat unit (default 4)
  };
  tracks?: Track[]; // Track/instrument information
}

