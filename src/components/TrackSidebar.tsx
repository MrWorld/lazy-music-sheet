import { useState } from 'react';
import type { Track } from '../types/note';
import { getTrackColor } from '../utils/trackColors';

interface TrackSidebarProps {
  tracks: Track[];
  visibleTracks: Set<number>;
  mutedTracks: Set<number>;
  soloTrack: number | null;
  onToggleVisibility: (trackId: number) => void;
  onToggleMute: (trackId: number) => void;
  onToggleSolo: (trackId: number) => void;
}

export function TrackSidebar({
  tracks,
  visibleTracks,
  mutedTracks,
  soloTrack,
  onToggleVisibility,
  onToggleMute,
  onToggleSolo,
}: TrackSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (tracks.length <= 1) {
    return null; // Don't show sidebar if only one track
  }

  return (
    <div
      className={`bg-white border-l border-gray-300 transition-all duration-300 ${
        isCollapsed ? 'w-12' : 'w-64'
      } flex flex-col`}
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-300 flex items-center justify-between">
        <h3 className={`font-semibold text-gray-800 ${isCollapsed ? 'hidden' : ''}`}>
          Tracks ({tracks.length})
        </h3>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Track list */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-2">
          {tracks.map((track) => {
            const isVisible = visibleTracks.has(track.id);
            const isMuted = mutedTracks.has(track.id);
            const isSoloed = soloTrack === track.id;
            const trackColor = getTrackColor(track.id);
            
            // Determine opacity and border based on state
            let opacity = 1;
            let borderColor = 'rgba(0, 0, 0, 0.2)';
            if (!isVisible) {
              opacity = 0.4;
            } else if (isMuted) {
              opacity = 0.6;
            }
            if (isSoloed) {
              borderColor = 'rgba(255, 215, 0, 0.8)';
              opacity = 1;
            }

            return (
              <div
                key={track.id}
                className="mb-2 p-2 rounded border-2"
                style={{
                  backgroundColor: trackColor,
                  opacity: opacity,
                  borderColor: borderColor,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-white truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        {track.name}
                        {isSoloed && <span className="ml-1 text-yellow-200">(Solo)</span>}
                      </div>
                    </div>
                    {track.instrument && (
                      <div className="text-xs text-white/90 truncate ml-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                        {track.instrument}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => onToggleVisibility(track.id)}
                    className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                      isVisible
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                    }`}
                    title={isVisible ? 'Hide track' : 'Show track'}
                    disabled={isSoloed}
                  >
                    {isVisible ? '👁️ Hide' : '👁️‍🗨️ Show'}
                  </button>
                  <button
                    onClick={() => onToggleMute(track.id)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      isMuted
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                    }`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                    disabled={isSoloed}
                  >
                    {isMuted ? '🔇' : '🔊'}
                  </button>
                  <button
                    onClick={() => onToggleSolo(track.id)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      isSoloed
                        ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                        : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                    }`}
                    title={isSoloed ? 'Unsolo' : 'Solo this track'}
                  >
                    {isSoloed ? '🎯' : '🎵'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

