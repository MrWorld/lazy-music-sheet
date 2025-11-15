interface ZoomControlsProps {
  pixelsPerQuarter: number;
  onZoomChange: (pixelsPerQuarter: number) => void;
}

export function ZoomControls({ pixelsPerQuarter, onZoomChange }: ZoomControlsProps) {
  const handleZoomIn = () => {
    onZoomChange(Math.min(pixelsPerQuarter + 10, 200));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(pixelsPerQuarter - 10, 20));
  };

  const handleZoomReset = () => {
    onZoomChange(50);
  };

  return (
    <div className="flex items-center gap-2 px-2">
      <button
        onClick={handleZoomOut}
        className="px-2 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
        title="Zoom Out"
      >
        −
      </button>
      <span className="text-sm w-20 text-center">
        {Math.round((pixelsPerQuarter / 50) * 100)}%
      </span>
      <button
        onClick={handleZoomIn}
        className="px-2 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
        title="Zoom In"
      >
        +
      </button>
      <button
        onClick={handleZoomReset}
        className="px-2 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
        title="Reset Zoom"
      >
        Reset
      </button>
    </div>
  );
}

