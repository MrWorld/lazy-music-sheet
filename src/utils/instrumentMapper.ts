// MIDI General MIDI (GM) Program Numbers
// Channel 10 (9 in 0-indexed) is reserved for percussion
export const GM_DRUM_CHANNEL = 9;

// Instrument categories based on MIDI program numbers
export type InstrumentCategory = 
  | 'piano'
  | 'drums'
  | 'strings'
  | 'brass'
  | 'woodwind'
  | 'guitar'
  | 'bass'
  | 'synth'
  | 'organ'
  | 'other';

export const InstrumentCategory = {
  PIANO: 'piano' as InstrumentCategory,
  DRUMS: 'drums' as InstrumentCategory,
  STRINGS: 'strings' as InstrumentCategory,
  BRASS: 'brass' as InstrumentCategory,
  WOODWIND: 'woodwind' as InstrumentCategory,
  GUITAR: 'guitar' as InstrumentCategory,
  BASS: 'bass' as InstrumentCategory,
  SYNTH: 'synth' as InstrumentCategory,
  ORGAN: 'organ' as InstrumentCategory,
  OTHER: 'other' as InstrumentCategory,
};

/**
 * Map MIDI program number to instrument category
 * @param programNumber - MIDI program number (0-127)
 * @param channel - MIDI channel (0-15, channel 9 is drums)
 * @returns Instrument category
 */
export function getInstrumentCategory(programNumber?: number, channel?: number): InstrumentCategory {
  // Channel 9 (10 in 1-indexed) is always drums in GM standard
  if (channel === 9) {
    return 'drums';
  }

  if (programNumber === undefined) {
    return 'piano'; // Default to piano
  }

  // General MIDI program number ranges
  if (programNumber >= 0 && programNumber <= 7) {
    return 'piano';
  } else if (programNumber >= 8 && programNumber <= 15) {
    return 'organ';
  } else if (programNumber >= 24 && programNumber <= 31) {
    return 'guitar';
  } else if (programNumber >= 32 && programNumber <= 39) {
    return 'bass';
  } else if (programNumber >= 40 && programNumber <= 47) {
    return 'strings';
  } else if (programNumber >= 48 && programNumber <= 55) {
    return 'strings'; // Ensemble strings
  } else if (programNumber >= 56 && programNumber <= 63) {
    return 'brass';
  } else if (programNumber >= 64 && programNumber <= 71) {
    return 'woodwind';
  } else if (programNumber >= 80 && programNumber <= 87) {
    return 'synth';
  } else if (programNumber >= 88 && programNumber <= 95) {
    return 'synth'; // Lead synth
  } else if (programNumber >= 104 && programNumber <= 111) {
    return 'synth'; // Synth effects
  } else if (programNumber >= 112 && programNumber <= 119) {
    return 'other'; // Ethnic
  } else if (programNumber >= 120 && programNumber <= 127) {
    return 'other'; // Percussive
  }

  return 'other';
}

/**
 * Get sample URLs for an instrument category
 * @param category - Instrument category
 * @returns Object with sample URLs and base URL
 */
export function getInstrumentSamples(category: InstrumentCategory): {
  urls: { [key: string]: string };
  baseUrl: string;
} {
  switch (category) {
    case 'piano':
      return {
        urls: {
          C4: 'C4.mp3',
          'D#4': 'Ds4.mp3',
          'F#4': 'Fs4.mp3',
          A4: 'A4.mp3',
        },
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
      };
    
    case 'drums':
      // For drums, we'll use a simple synth since we don't have drum samples
      // In a real implementation, you'd use a drum machine or drum samples
      return {
        urls: {
          C4: 'C4.mp3',
          'D#4': 'Ds4.mp3',
          'F#4': 'Fs4.mp3',
          A4: 'A4.mp3',
        },
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
      };
    
    case 'strings':
      // Use piano samples as fallback for strings
      return {
        urls: {
          C4: 'C4.mp3',
          'D#4': 'Ds4.mp3',
          'F#4': 'Fs4.mp3',
          A4: 'A4.mp3',
        },
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
      };
    
    case 'brass':
    case 'woodwind':
    case 'guitar':
    case 'bass':
    case 'organ':
    case 'synth':
    case 'other':
    default:
      // For now, use piano samples as fallback
      // In a full implementation, you'd have specific samples for each category
      return {
        urls: {
          C4: 'C4.mp3',
          'D#4': 'Ds4.mp3',
          'F#4': 'Fs4.mp3',
          A4: 'A4.mp3',
        },
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
      };
  }
}

