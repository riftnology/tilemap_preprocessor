import React, { useRef, useEffect } from 'react';
import { ImageProcessingOptions } from '../types';
import Konva from 'konva';

interface LivePreviewProps {
  stageRef: React.RefObject<Konva.Stage>;
  cropRect: { x: number; y: number; width: number; height: number };
  options: ImageProcessingOptions;
  lines: Array<{
    points: number[];
    stroke: string;
    strokeWidth: number;
    globalCompositeOperation: string;
  }>;
  rectangles: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
    globalCompositeOperation: string;
  }>;
  konvaImage: HTMLImageElement | null;
  isDrawing: boolean;
  forceUpdate?: number;
}

const LivePreview: React.FC<LivePreviewProps> = ({
  stageRef,
  cropRect,
  options,
  lines,
  rectangles,
  konvaImage,
  isDrawing,
  forceUpdate = 0
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const updatePreview = () => {
    if (!stageRef.current || !previewCanvasRef.current) return;

    const previewCanvas = previewCanvasRef.current;
    const previewCtx = previewCanvas.getContext('2d')!;
    
    // Set canvas to fixed 500x500 for actual rendering
    previewCanvas.width = 500;
    previewCanvas.height = 500;
    
    // Export the cropped area from the stage
    const dataURL = stageRef.current.toDataURL({
      x: cropRect.x,
      y: cropRect.y,
      width: cropRect.width,
      height: cropRect.height,
      pixelRatio: 1
    });
    
    const img = new window.Image();
    img.onload = () => {
      // Clear the canvas
      previewCtx.clearRect(0, 0, 500, 500);
      
      previewCtx.save();
      previewCtx.translate(250, 250); // Center of 500x500 canvas
      
      if (options.rotation) {
        previewCtx.rotate((options.rotation * Math.PI) / 180);
      }
      if (options.flipX || options.flipY) {
        previewCtx.scale(options.flipX ? -1 : 1, options.flipY ? -1 : 1);
      }
      
      previewCtx.translate(-250, -250);
      
      // Scale the image to show how it will look at the output size
      // Keep it proportional to the 500x500 preview canvas
      previewCtx.drawImage(img, 0, 0, 500, 500);
      
      // Draw grid lines if split into tiles is enabled
      if (options.splitIntoTiles) {
        const tileSize = options.tileSize;
        // Calculate how the tiles will appear in the preview
        const scaledTileSize = (tileSize / options.outputSize) * 500;
        
        previewCtx.strokeStyle = '#00ff00'; // Bright green
        previewCtx.lineWidth = 2;
        
        // Draw vertical lines
        for (let x = scaledTileSize; x < 500; x += scaledTileSize) {
          previewCtx.beginPath();
          previewCtx.moveTo(x, 0);
          previewCtx.lineTo(x, 500);
          previewCtx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = scaledTileSize; y < 500; y += scaledTileSize) {
          previewCtx.beginPath();
          previewCtx.moveTo(0, y);
          previewCtx.lineTo(500, y);
          previewCtx.stroke();
        }
      }
      
      previewCtx.restore();
    };
    img.src = dataURL;
  };

  // Update preview when dependencies change, but not while drawing
  useEffect(() => {
    if (konvaImage && !isDrawing) {
      updatePreview();
    }
  }, [options, cropRect, lines, rectangles, konvaImage, isDrawing, forceUpdate]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Live Preview
      </label>
      <div className="border rounded bg-gray-50 p-2 flex items-center justify-center">
        <canvas
          ref={previewCanvasRef}
          className="border border-gray-300 bg-white"
          style={{
            width: '200px',
            height: '200px',
            imageRendering: 'pixelated'
          }}
        />
      </div>
      <div className="text-xs text-gray-500 mt-1 text-center">
        Output: {options.outputSize}×{options.outputSize}px
        {options.splitIntoTiles && (
          <>
            <span className="block">Grid: {options.tileSize}×{options.tileSize}px tiles</span>
            <span className="block">
              {Math.floor(options.outputSize / options.tileSize)}×{Math.floor(options.outputSize / options.tileSize)} = {Math.floor(options.outputSize / options.tileSize) ** 2} tiles
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default LivePreview; 