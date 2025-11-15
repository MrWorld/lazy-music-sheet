import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const archivePath = path.join(__dirname, '../public/archive');
const outputPath = path.join(__dirname, '../public/music-list.json');

function generateMusicList() {
  const musicList = [];
  
  // Check if archive folder exists
  if (!fs.existsSync(archivePath)) {
    console.error(`Archive folder not found at: ${archivePath}`);
    return;
  }
  
  // Get all folders in archive (producers/artists)
  const folders = fs.readdirSync(archivePath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  console.log(`Found ${folders.length} artist folders`);
  
  // Process each folder
  folders.forEach((folderName, folderIndex) => {
    const folderPath = path.join(archivePath, folderName);
    
    // Get all MIDI files in this folder
    const files = fs.readdirSync(folderPath)
      .filter(file => {
        const lower = file.toLowerCase();
        return lower.endsWith('.mid') || lower.endsWith('.midi');
      });
    
    files.forEach((fileName) => {
      // Remove .mid or .midi extension for display name
      const musicName = fileName.replace(/\.(mid|midi)$/i, '');
      const filePath = `archive/${folderName}/${fileName}`;
      
      // Replace underscores with spaces for easier searching
      const displayArtist = folderName.replace(/_/g, ' ');
      const displayTitle = musicName.replace(/_/g, ' ');
      
      musicList.push({
        id: `${folderName}-${musicName}-${folderIndex}-${files.indexOf(fileName)}`,
        artist: displayArtist,
        title: displayTitle,
        path: filePath,
        filename: fileName
      });
    });
    
    console.log(`  ${folderName}: ${files.length} files`);
  });
  
  // Sort by artist, then by title
  musicList.sort((a, b) => {
    if (a.artist !== b.artist) {
      return a.artist.localeCompare(b.artist);
    }
    return a.title.localeCompare(b.title);
  });
  
  // Write to JSON file
  fs.writeFileSync(outputPath, JSON.stringify(musicList, null, 2), 'utf-8');
  
  console.log(`\n✅ Generated music list with ${musicList.length} songs`);
  console.log(`📁 Output: ${outputPath}`);
  
  return musicList;
}

// Run the script
generateMusicList();

