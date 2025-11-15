import { useRef, useState, useEffect, useMemo } from 'react';
import { midiToSheet } from '../utils/midiConverter';
import type { Sheet } from '../types/note';

interface MusicItem {
  id: string;
  artist: string;
  title: string;
  path: string;
  filename: string;
}

interface FileUploadProps {
  onSheetLoaded: (sheet: Sheet) => void;
}

export function FileUpload({ onSheetLoaded }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [musicList, setMusicList] = useState<MusicItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMusicList, setShowMusicList] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Load music list on mount
  useEffect(() => {
    fetch('/music-list.json')
      .then(res => res.json())
      .then(data => setMusicList(data))
      .catch(err => {
        console.warn('Could not load music list:', err);
        // Continue without music list - user can still upload files
      });
  }, []);
  
  // Filter music list based on search query
  const filteredMusic = useMemo(() => {
    if (!searchQuery.trim()) {
      return musicList;
    }
    const query = searchQuery.toLowerCase();
    return musicList.filter(music => 
      music.artist.toLowerCase().includes(query) ||
      music.title.toLowerCase().includes(query)
    );
  }, [musicList, searchQuery]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    
    if (!file.name.toLowerCase().endsWith('.mid') && !file.name.toLowerCase().endsWith('.midi')) {
      alert('Please select a MIDI file (.mid or .midi)');
      return;
    }

    try {
      const sheet = await midiToSheet(file);
      if (!sheet || sheet.notes.length === 0) {
        alert('MIDI file loaded but contains no notes in the piano range (A0-C8).');
        return;
      }
      onSheetLoaded(sheet);
    } catch (error) {
      console.error('Error loading MIDI file:', error);
      alert(`Failed to load MIDI file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try another file.`);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    
    if (!file) {
      return;
    }
    
    if (!file.name.toLowerCase().endsWith('.mid') && !file.name.toLowerCase().endsWith('.midi')) {
      alert('Please drop a MIDI file (.mid or .midi)');
      return;
    }

    try {
      const sheet = await midiToSheet(file);
      if (!sheet || sheet.notes.length === 0) {
        alert('MIDI file loaded but contains no notes in the piano range (A0-C8).');
        return;
      }
      onSheetLoaded(sheet);
    } catch (error) {
      console.error('Error loading MIDI file:', error);
      alert(`Failed to load MIDI file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try another file.`);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleMusicSelect = async (music: MusicItem) => {
    setLoading(true);
    try {
      const response = await fetch(`/${music.path}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${music.path}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const sheet = await midiToSheet(arrayBuffer);
      if (!sheet || sheet.notes.length === 0) {
        alert('MIDI file loaded but contains no notes in the piano range (A0-C8).');
        return;
      }
      onSheetLoaded(sheet);
      setShowMusicList(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Error loading MIDI file:', error);
      alert(`Failed to load MIDI file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try another file.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Browse Section */}
      {musicList.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-300 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">
              Browse Music Library ({musicList.length} songs)
            </h2>
            <button
              onClick={() => setShowMusicList(!showMusicList)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
            >
              {showMusicList ? 'Hide' : 'Show'} Library
            </button>
          </div>
          
          {showMusicList && (
            <div className="space-y-3">
              {/* Search Input */}
              <input
                type="text"
                placeholder="Search by artist or song title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              {/* Music List */}
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                {loading && (
                  <div className="p-4 text-center text-gray-500">
                    Loading...
                  </div>
                )}
                {!loading && filteredMusic.length === 0 && (
                  <div className="p-4 text-center text-gray-500">
                    {searchQuery ? 'No songs found matching your search.' : 'No songs available.'}
                  </div>
                )}
                {!loading && filteredMusic.length > 0 && (
                  <div className="divide-y divide-gray-200">
                    {filteredMusic.map((music) => (
                      <button
                        key={music.id}
                        onClick={() => handleMusicSelect(music)}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors"
                        disabled={loading}
                      >
                        <div className="font-medium text-gray-900">{music.title}</div>
                        <div className="text-sm text-gray-500">{music.artist}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {searchQuery && (
                <div className="text-sm text-gray-500">
                  Showing {filteredMusic.length} of {musicList.length} songs
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Upload Section */}
      <div className="border-t border-gray-300 pt-4">
        <p className="text-sm text-gray-600 mb-3 text-center">Or upload your own MIDI file:</p>
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mid,.midi"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="space-y-2">
            <p className="text-lg font-medium">Upload MIDI File</p>
            <p className="text-sm text-gray-500">Click or drag and drop a MIDI file here</p>
          </div>
        </div>
      </div>
    </div>
  );
}

