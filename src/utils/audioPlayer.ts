import * as Tone from 'tone';
import type { Sheet } from '../types/note';

export class AudioPlayer {
  private sampler: Tone.Sampler;
  private isPlaying: boolean = false;
  private scheduledNotes: Tone.ToneEvent[] = [];
  private currentTime: number = 0;
  private sheet: Sheet | null = null;
  private onTimeUpdate?: (time: number) => void;

  constructor() {
    // Use Tone.Sampler with real piano samples (Salamander Grand Piano)
    // Sampler automatically repitches samples, so we only need a few samples
    this.sampler = new Tone.Sampler({
      urls: {
        C4: 'C4.mp3',
        'D#4': 'Ds4.mp3',
        'F#4': 'Fs4.mp3',
        A4: 'A4.mp3',
      },
      release: 1,
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
    }).toDestination();
    
    // Increase polyphony to prevent note cutoff
    // Tone.Sampler uses VoiceLimiter internally - we need to access it
    try {
      // Access the internal voice limiter and increase polyphony
      const samplerAny = this.sampler as any;
      if (samplerAny._voices) {
        samplerAny._voices.maxPolyphony = 256; // Much higher limit
      }
      // Also try setting polyphony directly if available
      if ('polyphony' in samplerAny) {
        samplerAny.polyphony = 256;
      }
    } catch (e) {
      // If setting polyphony fails, continue with default
      console.warn('Could not set polyphony:', e);
    }
    
    // Set volume
    this.sampler.volume.value = -6;
    
    // Load samples (removed console.log for performance)
  }

  async loadSheet(sheet: Sheet) {
    this.sheet = sheet;
    this.stop();
  }

  async play(sheet: Sheet, onTimeUpdate?: (time: number) => void) {
    if (this.isPlaying) {
      this.stop();
    }

    this.sheet = sheet;
    this.onTimeUpdate = onTimeUpdate; // Store the callback

    // Start audio context if not already started - MUST be called after user gesture
    try {
      await Tone.start();
      // Also ensure the context is running
      if (Tone.context.state !== 'running') {
        await Tone.context.resume();
      }
    } catch (error) {
      console.error('Failed to start audio context:', error);
      throw error;
    }

    // Clear previous scheduled notes
    this.scheduledNotes.forEach(event => {
      if (event && typeof event.dispose === 'function') {
        event.dispose();
      } else if (event && typeof event.stop === 'function') {
        event.stop();
      }
    });
    this.scheduledNotes = [];

    // Reset transport
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.seconds = 0;

    // Set tempo
    Tone.Transport.bpm.value = sheet.tempo;

    // Convert quarter notes to seconds (at current tempo)
    const secondsPerQuarter = 60 / sheet.tempo;

    // Use Part to schedule all notes
    interface NoteEvent {
      frequency: number;
      duration: number;
      velocity: number;
      pitch: number; // MIDI note number
    }
    
    const partEvents: Array<[number, NoteEvent]> = [];
    
    // Use a Set to track unique notes and prevent duplicates
    const noteSet = new Set<string>();
    
    // Prepare all notes - deduplicate by pitch + startTime
    sheet.notes.forEach((note) => {
      // Validate note data
      if (note.pitch < 21 || note.pitch > 108) return;
      if (note.startTime < 0 || note.duration <= 0) return;
      if (!isFinite(note.startTime) || !isFinite(note.duration)) return;
      
      // Create unique key for this note to prevent duplicates
      const noteKey = `${note.pitch}-${note.startTime.toFixed(4)}`;
      if (noteSet.has(noteKey)) {
        return; // Skip duplicate note
      }
      noteSet.add(noteKey);
      
      const startTimeSeconds = note.startTime * secondsPerQuarter;
      const durationSeconds = Math.max(0.1, note.duration * secondsPerQuarter); // Minimum 100ms for smoother playback
      const frequency = Tone.Frequency(note.pitch, 'midi').toFrequency();
      const velocity = Math.max(0.3, Math.min(1, note.velocity / 127)); // Velocity range 0.3-1.0 for better sound

      if (!isFinite(startTimeSeconds) || !isFinite(durationSeconds) || startTimeSeconds < 0) {
        return;
      }

      // Removed console.log for performance

      partEvents.push([startTimeSeconds, {
        frequency,
        duration: durationSeconds,
        velocity,
        pitch: note.pitch, // Store MIDI pitch for sampler
      }]);
    });

    if (partEvents.length === 0) {
      console.warn('No valid notes to play');
      this.isPlaying = false;
      return;
    }

    // Sort events by time to ensure correct order
    partEvents.sort((a, b) => a[0] - b[0]);

    // Create part with all events
    // The 'time' parameter is already in Transport time - use it directly
    // Tone.js handles lookahead internally for smooth scheduling
    const part = new Tone.Part((time: number, value: NoteEvent) => {
      // Convert MIDI note number to note name for sampler
      const noteName = Tone.Frequency(value.pitch, 'midi').toNote();
      // Use the time directly - Tone.js will handle scheduling
      this.sampler.triggerAttackRelease(noteName, value.duration, time, value.velocity);
    }, partEvents);

    // Store the part for cleanup
    this.scheduledNotes.push(part as any);
    
    // Ensure Transport is stopped and reset before starting
    if (Tone.Transport.state !== 'stopped') {
      Tone.Transport.stop();
    }
    Tone.Transport.cancel();
    Tone.Transport.seconds = 0;
    
    // Ensure audio context is running FIRST
    if (Tone.getContext().state !== 'running') {
      await Tone.getContext().resume();
    }
    
    // Start the part first
    part.start(0);
    
    // Start transport with lookahead for smooth audio scheduling (prevents choppy playback)
    Tone.Transport.start('+0.1');

    // Set playing state
    this.isPlaying = true;
    this.currentTime = 0;

    // Don't start update loop - SheetView reads directly from Transport to avoid React re-renders
    // Only update callback occasionally for time display (not for indicator/scroll)
    if (this.onTimeUpdate) {
      // Update once immediately, then use a slow interval for time display only
      const updateTimeDisplay = () => {
        if (!this.isPlaying || !this.sheet) return;
        const transportState = Tone.Transport.state;
        if (transportState === 'started') {
          const elapsed = Tone.Transport.seconds;
          const secondsPerQuarter = 60 / this.sheet.tempo;
          const quarterNotes = elapsed / secondsPerQuarter;
          this.currentTime = quarterNotes;
          if (this.onTimeUpdate) {
            this.onTimeUpdate(quarterNotes);
          }
        }
        if (this.isPlaying) {
          setTimeout(updateTimeDisplay, 200); // Only 5fps for time display
        }
      };
      setTimeout(updateTimeDisplay, 200);
    }
  }

  pause() {
    const state = Tone.Transport.state;
    if (state === 'started') {
      Tone.Transport.pause();
      this.isPlaying = false;
      // Don't reset currentTime - keep it for resume
    }
  }

  resume() {
    if (this.sheet) {
      const state = Tone.Transport.state;
      if (state === 'paused') {
        // Resume from where we paused
        Tone.Transport.start();
        this.isPlaying = true;
        // Restart time display updates
        if (this.onTimeUpdate) {
          const updateTimeDisplay = () => {
            if (!this.isPlaying || !this.sheet) return;
            const transportState = Tone.Transport.state;
            if (transportState === 'started') {
              const elapsed = Tone.Transport.seconds;
              const secondsPerQuarter = 60 / this.sheet.tempo;
              const quarterNotes = elapsed / secondsPerQuarter;
              this.currentTime = quarterNotes;
              if (this.onTimeUpdate) {
                this.onTimeUpdate(quarterNotes);
              }
            }
            if (this.isPlaying) {
              setTimeout(updateTimeDisplay, 200);
            }
          };
          setTimeout(updateTimeDisplay, 200);
        }
      } else if (state === 'stopped') {
        // If stopped, need to restart playback
        this.play(this.sheet, this.onTimeUpdate);
      }
    }
  }

  getTransportState(): string {
    return Tone.Transport.state;
  }

  stop() {
    this.isPlaying = false;
    Tone.Transport.stop();
    Tone.Transport.cancel();
    this.scheduledNotes.forEach(event => {
      if (event && typeof event.dispose === 'function') {
        event.dispose();
      } else if (event && typeof event.stop === 'function') {
        event.stop();
      }
    });
    this.scheduledNotes = [];
    this.currentTime = 0;
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  setTempo(tempo: number) {
    if (this.sheet) {
      this.sheet.tempo = tempo;
      Tone.Transport.bpm.value = tempo;
    }
  }

  dispose() {
    this.stop();
    this.sampler.dispose();
  }
}

