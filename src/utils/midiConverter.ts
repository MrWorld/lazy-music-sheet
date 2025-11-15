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
  const tracks: Array<{ id: number; name: string; instrument?: string }> = [];
  
  // Get tempo from MIDI header (default to 120 BPM) - use first tempo for sheet tempo
  const tempo = midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120;
  
  // Build tempo map: time in seconds -> tempo at that time
  // @tonejs/midi already converts tempo change ticks to seconds in tempoEvent.ticks
  const tempoMap: Array<{ time: number; tempo: number }> = [];
  midi.header.tempos.forEach(tempoEvent => {
    // tempoEvent.ticks is already in seconds (from @tonejs/midi)
    tempoMap.push({
      time: tempoEvent.ticks,
      tempo: tempoEvent.bpm
    });
  });
  
  // Sort tempo map by time
  tempoMap.sort((a, b) => a.time - b.time);
  
  // If no tempo changes, use single tempo
  if (tempoMap.length === 0) {
    tempoMap.push({ time: 0, tempo });
  }
  
  // Function to convert seconds to quarter notes accounting for tempo changes
  const secondsToQuarterNotes = (seconds: number): number => {
    if (tempoMap.length === 1) {
      // Simple case: single tempo
      return seconds * (tempoMap[0].tempo / 60);
    }
    
    // Complex case: multiple tempos - calculate quarter notes accounting for tempo changes
    let quarterNotes = 0;
    let currentTime = 0;
    
    for (let i = 0; i < tempoMap.length; i++) {
      const tempoEvent = tempoMap[i];
      const nextTime = i < tempoMap.length - 1 ? tempoMap[i + 1].time : seconds;
      const segmentEnd = Math.min(nextTime, seconds);
      
      if (currentTime < segmentEnd) {
        const segmentDuration = segmentEnd - currentTime;
        const segmentTempo = tempoEvent.tempo;
        quarterNotes += segmentDuration * (segmentTempo / 60);
        currentTime = segmentEnd;
      }
      
      if (segmentEnd >= seconds) break;
    }
    
    return quarterNotes;
  };
  
  // Extract track information and notes from all tracks
  midi.tracks.forEach((track, trackIndex) => {
    // Get track name and instrument
    const trackName = track.name || `Track ${trackIndex + 1}`;
    const instrument = track.instrument?.name || undefined;
    
    // Only add track if it has notes
    if (track.notes.length > 0) {
      tracks.push({
        id: trackIndex,
        name: trackName,
        instrument,
      });
    }
    
    track.notes.forEach(midiNote => {
      // Filter out notes outside piano range (21-108 for 88-key piano)
      if (midiNote.midi < 21 || midiNote.midi > 108) {
        return;
      }
      
      // midiNote.time is in seconds (already accounting for tempo changes in @tonejs/midi)
      // Convert to quarter notes using tempo map
      const startTime = secondsToQuarterNotes(midiNote.time);
      const duration = secondsToQuarterNotes(midiNote.time + midiNote.duration) - startTime;
      
      // Validate and filter out invalid notes
      if (startTime < 0 || duration <= 0 || isNaN(startTime) || isNaN(duration) || !isFinite(startTime) || !isFinite(duration)) {
        return;
      }
      
      // Create unique key to prevent duplicates (trackId + pitch + startTime rounded to 4 decimal places)
      const noteKey = `${trackIndex}-${midiNote.midi}-${startTime.toFixed(4)}`;
      if (noteSet.has(noteKey)) {
        return; // Skip duplicate note
      }
      noteSet.add(noteKey);
      
      notes.push({
        pitch: midiNote.midi,
        startTime,
        duration: Math.max(0.25, duration), // Ensure minimum duration
        velocity: Math.round(Math.max(0, Math.min(127, midiNote.velocity * 127))), // Clamp 0-127
        trackId: trackIndex, // Assign track ID to note
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
    tracks: tracks.length > 0 ? tracks : undefined, // Only include tracks if there are multiple
  };
}

