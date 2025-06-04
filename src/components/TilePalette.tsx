import React from 'react';
import { ProcessedImage, Tile } from '../types';

interface TilePaletteProps {
  processedImages: ProcessedImage[];
  selectedTileId: string | null;
  onSelectTile: (tile: Tile) => void;
}

const TilePalette: React.FC<TilePaletteProps> = ({
  processedImages,
  selectedTileId,
  onSelectTile
}) => {
  if (processedImages.length === 0) {
    return null;
  }

  const handleTileSelect = (image: ProcessedImage) => {
    onSelectTile({
      id: image.id,
      imageUrl: image.processedUrl,
      width: image.width,
      height: image.height
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-medium mb-3 text-gray-700">Tile Palette</h2>
      
      <div className="grid grid-cols-4 gap-2 max-h-[400px] overflow-y-auto p-4 border rounded bg-gray-50">
        {processedImages.map((image) => (
          <div
            key={image.id}
            className={`relative w-full aspect-square flex items-center justify-center p-2 border-2 rounded cursor-pointer hover:border-blue-400 transition-colors ${
              selectedTileId === image.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
            onClick={() => handleTileSelect(image)}
          >
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={image.processedUrl}
                alt="Tile"
                className="w-full h-full"
                style={{ 
                  imageRendering: 'pixelated',
                  objectFit: 'none',
                  objectPosition: 'center'
                }}
              />
            </div>
          </div>
        ))}
      </div>
      
      {processedImages.length > 0 && (
        <div className="mt-3 text-sm text-gray-500 text-center">
          {processedImages.length} tile{processedImages.length !== 1 ? 's' : ''} available
        </div>
      )}
    </div>
  );
};

export default TilePalette;