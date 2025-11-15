interface TimeGridProps {
  startTime: number;
  endTime: number;
  pixelsPerQuarter: number;
  currentPlaybackTime?: number;
  isVertical?: boolean;
}

export function TimeGrid({ startTime, endTime, pixelsPerQuarter }: TimeGridProps) {
  const bars = [];
  let currentBar = Math.floor(startTime / 4);
  const maxBar = Math.ceil(endTime / 4);
  
  while (currentBar <= maxBar) {
    bars.push(currentBar * 4);
    currentBar++;
  }

  return (
    <div className="absolute top-0 left-0 right-0 pointer-events-none z-30" style={{ height: '100%' }}>
      {/* Bar markers - vertical lines */}
      {bars.map((barTime, index) => {
        const left = (barTime - startTime) * pixelsPerQuarter;
        return (
          <div
            key={index}
            className="absolute top-0 bottom-0 border-l-2 border-blue-400 opacity-50"
            style={{ left: `${left}px` }}
          />
        );
      })}

      {/* Time labels */}
      {bars.map((barTime, index) => {
        const left = (barTime - startTime) * pixelsPerQuarter;
        return (
          <div
            key={`label-${index}`}
            className="absolute top-0 text-xs text-gray-500 bg-white px-1"
            style={{ left: `${left}px` }}
          >
            {barTime.toFixed(1)}
          </div>
        );
      })}
    </div>
  );
}
