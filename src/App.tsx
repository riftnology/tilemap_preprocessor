import React, { useState } from 'react';
import ImageUploader from './components/ImageUploader';
import ImageProcessor from './components/ImageProcessor';
import TilePalette from './components/TilePalette';
import TilemapEditor from './components/TilemapEditor';
import { Tile, TileMap, ProcessedImage } from './types';
import { Grid, Image, Palette } from 'lucide-react';

function App() {
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [tilemap, setTilemap] = useState<TileMap | null>(null);
  const [activeStep, setActiveStep] = useState<'upload' | 'process' | 'edit'>('upload');

  const handleImageUpload = (file: File) => {
    setUploadedImage(file);
    setActiveStep('process');
  };

  const handleProcessingComplete = (images: ProcessedImage[]) => {
    setProcessedImages(images);
    setActiveStep('edit');
    if (images.length > 0) {
      // Auto-select the first processed image as the current tile
      setSelectedTile({
        id: images[0].id,
        imageUrl: images[0].processedUrl,
        width: images[0].width,
        height: images[0].height
      });
    }
  };

  const handleSelectTile = (tile: Tile) => {
    setSelectedTile(tile);
  };

  const handleTilemapChange = (newTilemap: TileMap) => {
    setTilemap(newTilemap);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-800 text-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Grid className="w-6 h-6 mr-2" />
              <h1 className="text-xl font-bold">Tilemap Editor</h1>
            </div>
            <div className="text-sm text-gray-300">
              Simple & Intuitive Tile Editor
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 mb-6">
          <StepButton 
            icon={<Image />}
            label="Upload Image"
            active={activeStep === 'upload'}
            completed={uploadedImage !== null}
            onClick={() => setActiveStep('upload')}
          />
          <StepButton 
            icon={<Palette />}
            label="Process Image"
            active={activeStep === 'process'}
            completed={processedImages.length > 0}
            disabled={!uploadedImage}
            onClick={() => uploadedImage && setActiveStep('process')}
          />
          <StepButton 
            icon={<Grid />}
            label="Edit Tilemap"
            active={activeStep === 'edit'}
            disabled={processedImages.length === 0}
            onClick={() => processedImages.length > 0 && setActiveStep('edit')}
          />
        </div>
        
        {activeStep === 'upload' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Upload Image</h2>
            <ImageUploader onImageUpload={handleImageUpload} />
          </div>
        )}
        
        {activeStep === 'process' && (
          <ImageProcessor 
            imageFile={uploadedImage} 
            onProcessingComplete={handleProcessingComplete} 
          />
        )}
        
        {activeStep === 'edit' && (
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-80">
              <TilePalette 
                processedImages={processedImages}
                selectedTileId={selectedTile?.id || null}
                onSelectTile={handleSelectTile}
              />
              
              <div className="bg-white rounded-lg shadow-md p-4 mt-4">
                <h2 className="text-lg font-medium mb-3 text-gray-700">Selected Tile</h2>
                {selectedTile ? (
                  <div className="border rounded p-4 flex flex-col items-center bg-gray-50">
                    <div className="border border-gray-300 p-2 bg-white">
                      <img 
                        src={selectedTile.imageUrl} 
                        alt="Selected Tile" 
                        className="w-16 h-16 object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      {selectedTile.width}x{selectedTile.height} pixels
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center italic">No tile selected</p>
                )}
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-4 mt-4">
                <h2 className="text-lg font-medium mb-3 text-gray-700">Instructions</h2>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• Select a tile from the palette above</li>
                  <li>• Left-click on the grid to place the selected tile</li>
                  <li>• Right-click to remove a tile</li>
                  <li>• Toggle grid visibility with the Grid button</li>
                  <li>• Export your tilemap as a PNG image</li>
                </ul>
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <TilemapEditor 
                selectedTile={selectedTile}
                onTilemapChange={handleTilemapChange}
                tilemap={tilemap}
              />
            </div>
          </div>
        )}
      </main>
      
      <footer className="bg-gray-800 text-gray-400 py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm">
          Tilemap Editor © 2025 | A simple tool for creating and editing tilemaps
        </div>
      </footer>
    </div>
  );
}

interface StepButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  completed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const StepButton: React.FC<StepButtonProps> = ({
  icon,
  label,
  active,
  completed = false,
  disabled = false,
  onClick
}) => (
  <button
    className={`flex-1 flex items-center justify-center py-3 px-4 rounded-lg transition-colors ${
      active 
        ? 'bg-blue-500 text-white'
        : completed
          ? 'bg-green-100 text-green-800 border border-green-300'
          : disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
    }`}
    onClick={onClick}
    disabled={disabled}
  >
    <div className="flex items-center">
      <div className="w-5 h-5 mr-2">{icon}</div>
      <span className="font-medium">{label}</span>
    </div>
  </button>
);

export default App;