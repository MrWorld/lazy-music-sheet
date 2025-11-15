import * as Tone from 'tone';
import type { Sheet } from '../types/note';
import { getInstrumentCategory, getInstrumentSamples, InstrumentCategory } from './instrumentMapper';

export class AudioPlayer {
  private samplers: Map<InstrumentCategory, Tone.Sampler> = new Map();
  private drumPlayers: Tone.Players | null = null;
  private isPlaying: boolean = false;
  private scheduledNotes: Tone.ToneEvent[] = [];
  private currentTime: number = 0;
  private sheet: Sheet | null = null;
  private onTimeUpdate?: (time: number) => void;

  constructor() {
    // Initialize samplers will be created on-demand
    // Initialize drum players
    this.initDrumPlayers();
  }

  /**
   * Initialize drum players
   * Uses actual drum samples from Tone.js audio repository
   * Based on: https://github.com/Tonejs/audio/tree/master/drum-samples/CR78
   */
  private initDrumPlayers() {
    // Use Tone.Players for drums - each drum sound is a specific sample
    // No pitch shifting needed for drums
    // Using CR78 drum kit samples from the repository
    this.drumPlayers = new Tone.Players({
      kick: 'https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3',
      snare: 'https://tonejs.github.io/audio/drum-samples/CR78/snare.mp3',
      hihat: 'https://tonejs.github.io/audio/drum-samples/CR78/hihat.mp3',
      crash: 'https://tonejs.github.io/audio/drum-samples/CR78/hihat.mp3', // Use hihat for crash (no crash in CR78)
      tom: 'https://tonejs.github.io/audio/drum-samples/CR78/tom1.mp3',
    }, {
      onload: () => {
        // Samples loaded successfully
      },
      onerror: (error) => {
        console.warn('Error loading drum samples:', error);
      }
    }).toDestination();
    
    this.drumPlayers.volume.value = -6;
  }

  /**
   * Get or create a sampler for an instrument category
   */
  private getSampler(category: InstrumentCategory): Tone.Sampler {
    if (!this.samplers.has(category)) {
      const samples = getInstrumentSamples(category);
      const sampler = new Tone.Sampler({
        urls: samples.urls,
        release: 1,
        baseUrl: samples.baseUrl,
      }).toDestination();
      
      // Increase polyphony to prevent note cutoff
      try {
        const samplerAny = sampler as any;
        if (samplerAny._voices) {
          samplerAny._voices.maxPolyphony = 256;
        }
        if ('polyphony' in samplerAny) {
          samplerAny.polyphony = 256;
        }
      } catch (e) {
        console.warn('Could not set polyphony:', e);
      }
      
      // Set volume
      sampler.volume.value = -6;
      
      this.samplers.set(category, sampler);
    }
    return this.samplers.get(category)!;
  }

  /**
   * Play a drum sound based on MIDI note number using drum samples
   * Uses actual drum samples from Tone.js audio repository
   */
  private playDrumSound(midiNote: number, time: number, velocity: number) {
    if (!this.drumPlayers) {
      this.initDrumPlayers();
    }
    
    // Map MIDI drum notes to drum sample names
    // General MIDI drum map: https://en.wikipedia.org/wiki/General_MIDI#Percussion
    const drumNoteMap: { [key: number]: 'kick' | 'snare' | 'hihat' | 'crash' | 'tom' } = {
      35: 'kick',   // Acoustic Bass Drum
      36: 'kick',   // Bass Drum 1
      38: 'snare',  // Acoustic Snare
      40: 'snare',  // Electric Snare
      42: 'hihat',  // Closed Hi-Hat
      44: 'hihat',  // Pedal Hi-Hat
      46: 'hihat',  // Open Hi-Hat
      47: 'tom',    // Low-Mid Tom
      48: 'tom',    // Hi-Mid Tom
      49: 'crash',  // Crash Cymbal 1
      51: 'crash',  // Ride Cymbal 1
      57: 'crash',  // Crash Cymbal 2
    };

    // Get the drum sample name for this MIDI drum note, default to kick
    const drumType = drumNoteMap[midiNote] || 'kick';
    
    try {
      // Get the player for this drum type
      const player = this.drumPlayers!.player(drumType);
      if (player) {
        // Set volume based on velocity
        player.volume.value = -6 + (velocity * 0.3);
        // Start the sample at the specified time (use Transport time)
        // Tone.Player will handle loading automatically
        player.start(time);
      } else {
        console.warn(`Drum player not found for type: ${drumType}`);
      }
    } catch (error) {
      console.warn(`Error playing drum sound ${drumType}:`, error);
    }
  }

  /**
   * Get the instrument category for a track
   */
  private getTrackCategory(trackId?: number): InstrumentCategory {
    if (!this.sheet?.tracks || trackId === undefined) {
      return 'piano'; // Default
    }
    
    const track = this.sheet.tracks.find(t => t.id === trackId);
    if (!track) {
      return 'piano';
    }
    
    return getInstrumentCategory(track.programNumber, track.channel);
  }

  async loadSheet(sheet: Sheet) {
    this.sheet = sheet;
    this.stop();
  }

  async play(sheet: Sheet, onTimeUpdate?: (time: number) => void, mutedTracks?: Set<number>) {
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
    
    // Ensure drum samples are loaded before playing
    if (this.drumPlayers) {
      try {
        await Tone.loaded();
      } catch (error) {
        console.warn('Drum samples may not be fully loaded:', error);
      }
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
      trackId?: number; // Track ID for instrument routing
    }
    
    const partEvents: Array<[number, NoteEvent]> = [];
    
    // Use a Set to track unique notes and prevent duplicates
    const noteSet = new Set<string>();
    
    // Prepare all notes - deduplicate by pitch + startTime
    sheet.notes.forEach((note) => {
      // Skip muted tracks
      if (mutedTracks && note.trackId !== undefined && mutedTracks.has(note.trackId)) {
        return;
      }
      
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
        trackId: note.trackId, // Store track ID for instrument routing
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
    const part = new Tone.Part((time: number, value: NoteEvent & { trackId?: number }) => {
      // Get the appropriate sampler for this track's instrument
      const category = this.getTrackCategory(value.trackId);
      
      // Drums need special handling - use drum sounds instead of pitched samples
      if (category === 'drums') {
        this.playDrumSound(value.pitch, time, value.velocity);
      } else {
        const sampler = this.getSampler(category);
        // Convert MIDI note number to note name for sampler
        const noteName = Tone.Frequency(value.pitch, 'midi').toNote();
        // Use the time directly - Tone.js will handle scheduling
        sampler.triggerAttackRelease(noteName, value.duration, time, value.velocity);
      }
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
    // Dispose all samplers
    this.samplers.forEach(sampler => sampler.dispose());
    this.samplers.clear();
    // Dispose drum players
    if (this.drumPlayers) {
      this.drumPlayers.dispose();
    }
  }
}

