// Generate distinct colors for tracks
// Using a palette of distinct, vibrant colors that work well for music notation
const TRACK_COLORS = [
  'rgb(255, 99, 132)',   // Red/Pink
  'rgb(54, 162, 235)',   // Blue
  'rgb(255, 206, 86)',   // Yellow
  'rgb(75, 192, 192)',   // Teal
  'rgb(153, 102, 255)',  // Purple
  'rgb(255, 159, 64)',   // Orange
  'rgb(199, 199, 199)',  // Gray
  'rgb(83, 102, 255)',   // Indigo
  'rgb(255, 99, 255)',   // Magenta
  'rgb(99, 255, 132)',   // Green
  'rgb(255, 132, 99)',   // Coral
  'rgb(132, 99, 255)',   // Lavender
  'rgb(99, 255, 255)',   // Cyan
  'rgb(255, 255, 99)',   // Light Yellow
  'rgb(255, 99, 99)',    // Light Red
  'rgb(99, 99, 255)',    // Light Blue
];

/**
 * Get a color for a track ID
 * @param trackId - The track ID
 * @returns A color string in rgb format
 */
export function getTrackColor(trackId: number | undefined): string {
  if (trackId === undefined) {
    // Default color for notes without a track
    return 'rgb(100, 100, 100)';
  }
  return TRACK_COLORS[trackId % TRACK_COLORS.length];
}

/**
 * Get all track colors as a map
 * @param tracks - Array of tracks
 * @returns Map of track ID to color
 */
export function getTrackColorMap(tracks?: Array<{ id: number }>): Map<number, string> {
  const colorMap = new Map<number, string>();
  if (tracks) {
    tracks.forEach(track => {
      colorMap.set(track.id, getTrackColor(track.id));
    });
  }
  return colorMap;
}

