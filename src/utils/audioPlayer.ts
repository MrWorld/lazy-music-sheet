import * as Tone from 'tone';
import type { Sheet } from '../types/note';

export class AudioPlayer {
  private synth: Tone.PolySynth;
  private isPlaying: boolean = false;
  private scheduledNotes: Tone.ToneEvent[] = [];
  private currentTime: number = 0;
  private sheet: Sheet | null = null;
  private onTimeUpdate?: (time: number) => void;

  constructor() {
    // Create a polyphonic synthesizer with better piano-like sound using AMSynth
    // AMSynth (Amplitude Modulation) produces a richer, more musical sound than FMSynth
    this.synth = new Tone.PolySynth({
      maxPolyphony: 128, // Allow many simultaneous notes
      voice: Tone.AMSynth,
      options: {
        harmonicity: 3,
        detune: 0,
        oscillator: {
          type: 'triangle', // Triangle wave for smoother sound
        },
        envelope: {
          attack: 0.01,
          decay: 0.2,
          sustain: 0.3,
          release: 0.8, // Longer release for more natural decay
        },
        modulation: {
          type: 'sine',
        },
        modulationEnvelope: {
          attack: 0.01,
          decay: 0.01,
          sustain: 1,
          release: 0.5,
        },
      },
    }).toDestination();
    
    // Set volume to a reasonable level
    this.synth.volume.value = -3; // -3 dB for better volume
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
      const durationSeconds = Math.max(0.1, note.duration * secondsPerQuarter); // Minimum 100ms for smoother, more musical sound
      const frequency = Tone.Frequency(note.pitch, 'midi').toFrequency();
      const velocity = Math.max(0.3, Math.min(1, note.velocity / 127)); // Higher minimum velocity (0.3) for better sound quality

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
    // The 'time' parameter is already in Transport time (seconds from Transport start)
    const part = new Tone.Part((time: number, value: NoteEvent) => {
      // 'time' is the correct Transport time - use it directly
      // Tone.js handles the scheduling internally, so we don't need to add lookahead here
      this.synth.triggerAttackRelease(value.frequency, value.duration, time, value.velocity);
    }, partEvents);

    // Store the part for cleanup
    this.scheduledNotes.push(part as any);
    
    // Ensure Transport is stopped and reset before starting
    if (Tone.Transport.state !== 'stopped') {
      Tone.Transport.stop();
    }
    Tone.Transport.cancel();
    Tone.Transport.seconds = 0;
    
    // Start the part first (scheduled relative to transport time 0)
    part.start(0);
    
    // Ensure audio context is running
    if (Tone.getContext().state !== 'running') {
      await Tone.getContext().resume();
    }
    
    // Start transport with a small lookahead to ensure smooth scheduling
    // This helps prevent choppy playback by giving the audio engine time to prepare
    Tone.Transport.start('+0.1');
    
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
    // Throttle updates to ~30fps (every ~33ms) to reduce CPU usage
    if (now - this.lastUpdateTime < 33) {
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
    this.synth.dispose();
  }
}

