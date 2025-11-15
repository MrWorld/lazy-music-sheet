import { useState, useEffect, useMemo } from 'react';
import { midiToSheet } from '../utils/midiConverter';
import type { Sheet } from '../types/note';

interface MusicItem {
  id: string;
  artist: string;
  title: string;
  path: string;
  filename: string;
}

interface MusicSearchProps {
  onSheetLoaded: (sheet: Sheet) => void;
}

export function MusicSearch({ onSheetLoaded }: MusicSearchProps) {
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
    <div className="flex items-center justify-center w-full p-1">
      <div className="relative w-full max-w-2xl">
        <input
          type="text"
          placeholder="Search music by artist or title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setShowMusicList(true)}
          className="w-full px-6 py-2 text-md border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 "
        />
        
        {/* Dropdown Music List */}
        {showMusicList && musicList.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
            {loading && (
              <div className="p-4 text-center text-gray-500 text-sm">
                Loading...
              </div>
            )}
            {!loading && filteredMusic.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                {searchQuery ? 'No songs found matching your search.' : 'No songs available.'}
              </div>
            )}
            {!loading && filteredMusic.length > 0 && (
              <div className="divide-y divide-gray-200">
                {filteredMusic.map((music) => (
                  <button
                    key={music.id}
                    onClick={() => handleMusicSelect(music)}
                    className="w-full px-6 py-3 text-left hover:bg-blue-50 transition-colors"
                    disabled={loading}
                  >
                    <div className="font-medium text-gray-900 text-base">{music.title}</div>
                    <div className="text-sm text-gray-500">{music.artist}</div>
                  </button>
                ))}
              </div>
            )}
            {searchQuery && filteredMusic.length > 0 && (
              <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-200">
                Showing {filteredMusic.length} of {musicList.length} songs
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Click outside to close */}
      {showMusicList && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMusicList(false)}
        />
      )}
    </div>
  );
}

