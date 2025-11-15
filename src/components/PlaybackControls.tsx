interface PlaybackControlsProps {
  isPlaying: boolean;
  tempo: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onTempoChange: (tempo: number) => void;
}

export function PlaybackControls({
  isPlaying,
  tempo,
  onPlay,
  onPause,
  onStop,
  onTempoChange,
}: PlaybackControlsProps) {
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
        <span className="text-sm w-12">{tempo} BPM</span>
      </div>
    </div>
  );
}

