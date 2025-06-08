import React, { useState, useEffect, useRef } from 'react';
import { Tile, TileMap } from '../types';
import { createEmptyTilemap, loadTilemapFromImage } from '../utils/imageUtils';
import { Save, Trash2, Grid, Upload } from 'lucide-react';

interface TilemapEditorProps {
  selectedTile: Tile | null;
  onTilemapChange: (tilemap: TileMap) => void;
  tilemap: TileMap | null;
}

const TilemapEditor: React.FC<TilemapEditorProps> = ({
  selectedTile,
  onTilemapChange,
  tilemap
}) => {
  const [mapWidth, setMapWidth] = useState(32);
  const [mapHeight, setMapHeight] = useState(32);
  const [tileSize] = useState(32);
  const [mapName, setMapName] = useState('New Tilemap');
  const [tiles, setTiles] = useState<(Tile | null)[][]>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize empty tilemap
  useEffect(() => {
    if (!tilemap) {
      const emptyTiles = createEmptyTilemap(mapWidth, mapHeight, tileSize);
      setTiles(emptyTiles);
      
      const newTilemap: TileMap = {
        id: Math.random().toString(36).substring(2, 15),
        name: mapName,
        width: mapWidth,
        height: mapHeight,
        tileSize: tileSize,
        tiles: emptyTiles
      };
      
      onTilemapChange(newTilemap);
    } else {
      setTiles(tilemap.tiles);
      setMapWidth(tilemap.width);
      setMapHeight(tilemap.height);
      setMapName(tilemap.name);
    }
  }, []);

  const handleTileClick = (rowIndex: number, colIndex: number) => {
    if (!selectedTile) return;

    const newTiles = [...tiles];
    newTiles[rowIndex][colIndex] = { ...selectedTile };
    setTiles(newTiles);
    
    const updatedTilemap: TileMap = {
      id: tilemap?.id || Math.random().toString(36).substring(2, 15),
      name: mapName,
      width: mapWidth,
      height: mapHeight,
      tileSize: tileSize,
      tiles: newTiles
    };
    
    onTilemapChange(updatedTilemap);
  };

  const handleClearTile = (rowIndex: number, colIndex: number) => {
    const newTiles = [...tiles];
    newTiles[rowIndex][colIndex] = null;
    setTiles(newTiles);
    
    const updatedTilemap: TileMap = {
      id: tilemap?.id || Math.random().toString(36).substring(2, 15),
      name: mapName,
      width: mapWidth,
      height: mapHeight,
      tileSize: tileSize,
      tiles: newTiles
    };
    
    onTilemapChange(updatedTilemap);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      setIsLoading(true);
      
      try {
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.readAsDataURL(file);
        });
        
        const newTiles = await loadTilemapFromImage(dataUrl, tileSize);
        setTiles(newTiles);
        setMapWidth(newTiles[0].length);
        setMapHeight(newTiles.length);
        
        const updatedTilemap: TileMap = {
          id: tilemap?.id || Math.random().toString(36).substring(2, 15),
          name: mapName,
          width: newTiles[0].length,
          height: newTiles.length,
          tileSize: tileSize,
          tiles: newTiles
        };
        
        onTilemapChange(updatedTilemap);
      } catch (error) {
        console.error('Error loading tilemap:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleExport = async () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    canvas.width = mapWidth * tileSize;
    canvas.height = mapHeight * tileSize;
    const ctx = canvas.getContext('2d')!;
    
    try {
      for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
          const tile = tiles[y][x];
          if (tile) {
            const img = await new Promise<HTMLImageElement>((resolve) => {
              const image = new Image();
              image.onload = () => resolve(image);
              image.src = tile.imageUrl;
            });
            ctx.drawImage(img, x * tileSize, y * tileSize, tileSize, tileSize);
          }
        }
      }
      
      const link = document.createElement('a');
      link.download = `${mapName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error exporting tilemap:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3">
        <div className="mb-3 md:mb-0">
          <label htmlFor="mapName" className="block text-sm font-medium text-gray-700 mb-1">
            Tilemap Name
          </label>
          <input
            type="text"
            id="mapName"
            value={mapName}
            onChange={(e) => setMapName(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
        
        <div className="flex space-x-1">
          <button 
            className="flex items-center px-2 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
            onClick={handleExport}
          >
            <Save className="w-3 h-3 mr-1" />
            Export
          </button>
          
          <button 
            className="flex items-center px-2 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
            onClick={() => setShowGrid(!showGrid)}
          >
            <Grid className="w-3 h-3 mr-1" />
            {showGrid ? 'Hide Grid' : 'Show Grid'}
          </button>
          
          <label className="flex items-center px-2 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors cursor-pointer text-sm">
            <Upload className="w-3 h-3 mr-1" />
            Import
            <input 
              type="file" 
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange}
              disabled={isLoading}
            />
          </label>
        </div>
      </div>
      
      <div className="overflow-auto border rounded-lg bg-gray-100 p-1" style={{ maxHeight: '65vh', maxWidth: '950px' }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading tilemap...</div>
          </div>
        ) : (
          <div 
            className={`inline-block ${showGrid ? 'bg-grid-pattern' : ''}`}
            style={{
              backgroundSize: `${tileSize}px ${tileSize}px`,
              backgroundImage: showGrid ? 'linear-gradient(to right, #ccc 1px, transparent 1px), linear-gradient(to bottom, #ccc 1px, transparent 1px)' : 'none',
              width: `${mapWidth * tileSize}px`,
              height: `${mapHeight * tileSize}px`
            }}
          >
            {tiles.map((row, rowIndex) => (
              <div key={rowIndex} className="flex">
                {row.map((tile, colIndex) => (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className="relative"
                    style={{ width: tileSize, height: tileSize }}
                    onClick={() => handleTileClick(rowIndex, colIndex)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleClearTile(rowIndex, colIndex);
                    }}
                  >
                    {tile && (
                      <img
                        src={tile.imageUrl}
                        alt="Tile"
                        className="absolute top-0 left-0 w-full h-full"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    )}
                    
                    {tile && (
                      <button
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearTile(rowIndex, colIndex);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="mt-3 text-xs text-gray-600">
        <p>Left-click to place selected tile. Right-click to remove tile.</p>
      </div>
    </div>
  );
};

export default TilemapEditor;