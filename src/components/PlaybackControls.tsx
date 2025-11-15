interface PlaybackControlsProps {
  isPlaying: boolean;
  tempo: number;
  currentTime?: number;
  totalDuration?: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onTempoChange: (tempo: number) => void;
  onSeek?: (quarterNotes: number) => void;
}

export function PlaybackControls({
  isPlaying,
  tempo,
  currentTime = 0,
  totalDuration = 0,
  onPlay,
  onPause,
  onStop,
  onTempoChange,
  onSeek,
}: PlaybackControlsProps) {
  const formatQuarterNotes = (quarters: number) => {
    const bars = Math.floor(quarters / 4);
    const beats = Math.floor(quarters % 4);
    const subBeats = Math.floor((quarters % 1) * 4);
    return `${bars}:${beats}.${subBeats}q`;
  };
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-100 border-b border-gray-300">
      <div className="flex items-center gap-2">
        {!isPlaying ? (
          <button
            onClick={onPlay}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            ▶ Play
          </button>
        ) : (
          <button
            onClick={onPause}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
          >
            ⏸ Pause
          </button>
        )}
        <button
          onClick={onStop}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          ⏹ Stop
        </button>
      </div>
      
      <div className="flex items-center gap-2">
        <label htmlFor="tempo" className="text-sm font-medium">
          Tempo:
        </label>
        <input
          id="tempo"
          type="range"
          min="40"
          max="200"
          value={tempo}
          onChange={(e) => onTempoChange(Number(e.target.value))}
          className="w-32"
        />
        <span className="text-sm w-12">{Number(tempo).toFixed(0)} BPM</span>
      </div>

      {/* Progress Bar */}
      {totalDuration > 0 && onSeek && (
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <span className="text-sm font-mono text-gray-600 w-20">
            {formatQuarterNotes(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={totalDuration}
            step="0.25"
            value={currentTime}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / totalDuration) * 100}%, #e5e7eb ${(currentTime / totalDuration) * 100}%, #e5e7eb 100%)`
            }}
          />
          <span className="text-sm font-mono text-gray-600 w-20 text-right">
            {formatQuarterNotes(totalDuration)}
          </span>
        </div>
      )}
      
      {/* Current playback time display */}
      {isPlaying && (
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm font-mono font-bold text-blue-600">
            Time: {formatQuarterNotes(currentTime)}
          </span>
        </div>
      )}
    </div>
  );
}

