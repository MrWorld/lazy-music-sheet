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
    // Create a polyphonic synthesizer with piano-like sound
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'sine',
      },
      envelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.3,
        release: 0.5,
      },
    }).toDestination();
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

    // Start audio context if not already started
    await Tone.start();

    // Clear previous scheduled notes
    this.scheduledNotes.forEach(event => event.dispose());
    this.scheduledNotes = [];

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
    const part = new Tone.Part((time: number, value: NoteEvent) => {
      this.synth.triggerAttackRelease(value.frequency, value.duration, time, value.velocity);
    }, [] as Array<[number, NoteEvent]>);

    // Add all notes to the part
    sheet.notes.forEach(note => {
      // Validate note data
      if (note.pitch < 21 || note.pitch > 108) return;
      if (note.startTime < 0 || note.duration <= 0) return;
      if (!isFinite(note.startTime) || !isFinite(note.duration)) return;
      
      const startTimeSeconds = note.startTime * secondsPerQuarter;
      const durationSeconds = Math.max(0.01, note.duration * secondsPerQuarter);
      const frequency = Tone.Frequency(note.pitch, 'midi').toFrequency();
      const velocity = Math.max(0, Math.min(1, note.velocity / 127));

      if (!isFinite(startTimeSeconds) || !isFinite(durationSeconds) || startTimeSeconds < 0) {
        return;
      }

      part.add(startTimeSeconds, {
        frequency,
        duration: durationSeconds,
        velocity,
      });
    });

    // Store the part for cleanup
    this.scheduledNotes.push(part as any);
    part.start(0);

    // Start transport
    this.isPlaying = true;
    Tone.Transport.start(0);

    // Update current time for progress tracking
    this.updateTime();
  }

  private updateTime() {
    if (!this.isPlaying || !this.sheet) return;

    const elapsed = Tone.Transport.seconds;
    const secondsPerQuarter = 60 / this.sheet.tempo;
    const quarterNotes = elapsed / secondsPerQuarter;
    this.currentTime = quarterNotes;

    if (this.onTimeUpdate) {
      this.onTimeUpdate(quarterNotes);
    }

    if (this.isPlaying) {
      requestAnimationFrame(() => this.updateTime());
    }
  }

  pause() {
    if (this.isPlaying) {
      Tone.Transport.pause();
      this.isPlaying = false;
    }
  }

  resume() {
    if (!this.isPlaying && this.sheet) {
      Tone.Transport.start();
      this.isPlaying = true;
      this.updateTime();
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

