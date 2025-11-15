import { useState, useEffect, useRef } from 'react';
import { AudioPlayer } from '../utils/audioPlayer';
import type { Sheet } from '../types/note';

export function usePlayback(sheet: Sheet | null) {
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
    
    setIsPlaying(true);
    await playerRef.current.play(sheet, (time) => {
      setCurrentTime(time);
    });
  };

  const pause = () => {
    playerRef.current?.pause();
    setIsPlaying(false);
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

