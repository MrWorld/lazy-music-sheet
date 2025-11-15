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
    
    // Set volume
    this.sampler.volume.value = -6;
    
    // Load samples
    Tone.loaded().then(() => {
      console.log('Piano samples loaded successfully');
    });
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
    this.onTimeUpdate = onTimeUpdate;

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
    sheet.notes.forEach((note, index) => {
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
      const durationSeconds = Math.max(0.05, note.duration * secondsPerQuarter); // Minimum 50ms
      const frequency = Tone.Frequency(note.pitch, 'midi').toFrequency();
      const velocity = Math.max(0.2, Math.min(1, note.velocity / 127)); // Velocity range 0.2-1.0

      if (!isFinite(startTimeSeconds) || !isFinite(durationSeconds) || startTimeSeconds < 0) {
        return;
      }

      // Log first few notes for debugging
      if (index < 3) {
        console.log(`Note ${index}: pitch=${note.pitch}, startTime=${note.startTime.toFixed(2)}q, duration=${note.duration.toFixed(2)}q`);
      }

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
    
    console.log(`Scheduling ${partEvents.length} notes. First note at ${partEvents[0]?.[0]?.toFixed(2)}s, Last note at ${partEvents[partEvents.length - 1]?.[0]?.toFixed(2)}s`);

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
    
    // Start transport with small lookahead for smooth audio scheduling
    Tone.Transport.start('+0.05');
    
    // Verify transport started
    console.log(`Transport started. State: ${Tone.Transport.state}, BPM: ${Tone.Transport.bpm.value}`);

    // Set playing state and start time tracking
    this.isPlaying = true;
    this.currentTime = 0;
    this.lastUpdateTime = 0;

    // Update current time for progress tracking
    this.updateTime();
  }

  private lastUpdateTime: number = 0;
  private updateTime() {
    // Check if actually playing (Transport state is the source of truth)
    const transportState = Tone.Transport.state;
    const actuallyPlaying = transportState === 'started';
    
    if (!actuallyPlaying || !this.sheet) {
      this.isPlaying = false;
      return; // Stop the loop when not playing
    }

    const now = performance.now();
    // Throttle updates to ~20fps (every ~50ms) - good balance between smoothness and performance
    if (now - this.lastUpdateTime < 50) {
      requestAnimationFrame(() => this.updateTime());
      return;
    }
    this.lastUpdateTime = now;

    const elapsed = Tone.Transport.seconds;
    const secondsPerQuarter = 60 / this.sheet.tempo;
    const quarterNotes = elapsed / secondsPerQuarter;
    
    // Always update currentTime and callback when playing (for smooth indicator)
    this.currentTime = quarterNotes;
    if (this.onTimeUpdate) {
      this.onTimeUpdate(quarterNotes);
    }

    // Continue updating only when playing - use requestAnimationFrame for smooth updates
    if (actuallyPlaying) {
      requestAnimationFrame(() => this.updateTime());
    }
  }

  pause() {
    const state = Tone.Transport.state;
    if (state === 'started') {
      Tone.Transport.pause();
      // Keep isPlaying true so time tracking continues (but will stop due to Transport state check)
    }
  }

  resume() {
    if (this.sheet) {
      const state = Tone.Transport.state;
      if (state === 'paused') {
        Tone.Transport.start();
        this.isPlaying = true;
        // Time tracking will resume automatically via updateTime loop
      } else if (state === 'stopped') {
        // If stopped, need to restart playback
        this.play(this.sheet, this.onTimeUpdate);
      }
    }
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

