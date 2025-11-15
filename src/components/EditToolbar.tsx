interface EditToolbarProps {
  mode: 'select' | 'add' | 'delete';
  onModeChange: (mode: 'select' | 'add' | 'delete') => void;
}

export function EditToolbar({ mode, onModeChange }: EditToolbarProps) {
  return (
    <div className="flex items-center gap-2 p-2">
      <span className="text-sm font-medium mr-2">Edit Mode:</span>
      <button
        onClick={() => onModeChange('select')}
        className={`px-3 py-1 rounded text-sm transition-colors ${
          mode === 'select'
            ? 'bg-blue-500 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-200'
        }`}
      >
        ✏️ Select
      </button>
      <button
        onClick={() => onModeChange('add')}
        className={`px-3 py-1 rounded text-sm transition-colors ${
          mode === 'add'
            ? 'bg-green-500 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-200'
        }`}
      >
        ➕ Add Note
      </button>
      <button
        onClick={() => onModeChange('delete')}
        className={`px-3 py-1 rounded text-sm transition-colors ${
          mode === 'delete'
            ? 'bg-red-500 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-200'
        }`}
      >
        🗑️ Delete
      </button>
    </div>
  );
}

