import { useState, useEffect, useRef } from 'react';
import { AudioPlayer } from '../utils/audioPlayer';
import type { Sheet } from '../types/note';

export function usePlayback(sheet: Sheet | null, mutedTracks?: Set<number>) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [tempo, setTempo] = useState(120);
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    playerRef.current = new AudioPlayer();
    return () => {
      playerRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (sheet) {
      playerRef.current?.loadSheet(sheet);
      setTempo(sheet.tempo);
    }
  }, [sheet]);

  const play = async () => {
    if (!sheet || !playerRef.current) return;
    
    try {
      // Check if already paused - if so, resume instead of restarting
      const state = playerRef.current.getTransportState();
      if (state === 'paused') {
        // Resume from where we paused
        playerRef.current.resume();
        setIsPlaying(true);
      } else {
        // Start from beginning
        setIsPlaying(true);
        await playerRef.current.play(sheet, (time) => {
          setCurrentTime(time);
        }, mutedTracks);
      }
    } catch (error) {
      console.error('Playback error:', error);
      setIsPlaying(false);
      alert('Failed to start playback. Please try clicking Play again.');
    }
  };

  const pause = () => {
    playerRef.current?.pause();
    setIsPlaying(false);
    // Don't reset currentTime - keep it so we can resume from here
  };

  const stop = () => {
    playerRef.current?.stop();
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const updateTempo = (newTempo: number) => {
    setTempo(newTempo);
    playerRef.current?.setTempo(newTempo);
  };

  return {
    isPlaying,
    currentTime,
    tempo,
    play,
    pause,
    stop,
    updateTempo,
  };
}

