import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Transformer, Line } from 'react-konva';
import { ProcessedImage, ImageProcessingOptions } from '../types';
import { processImage } from '../utils/imageUtils';
import { RotateCw, FlipHorizontal, FlipVertical, Grid2X2, Crop, ChevronLeft, ChevronRight, Brush, Eraser } from 'lucide-react';
import LivePreview from './LivePreview';
import Konva from 'konva';

interface ImageProcessorProps {
  imageFile: File | null;
  onProcessingComplete: (images: ProcessedImage[]) => void;
}

type Tool = 'crop' | 'paint' | 'erase';

const ImageProcessor: React.FC<ImageProcessorProps> = ({ 
  imageFile, 
  onProcessingComplete 
}) => {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [konvaImage, setKonvaImage] = useState<HTMLImageElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [options, setOptions] = useState<ImageProcessingOptions>({
    cropStart: { x: 0, y: 0 },
    cropSize: 0,
    rotation: 0,
    flipX: false,
    flipY: false,
    outputSize: 32,
    splitIntoTiles: false,
    tileSize: 32
  });
  
  const [selectedTool, setSelectedTool] = useState<Tool>('crop');
  const [brushColor, setBrushColor] = useState<string>('#ff0000');
  const [brushSize, setBrushSize] = useState<number>(5);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [lines, setLines] = useState<Array<{
    points: number[];
    stroke: string;
    strokeWidth: number;
    globalCompositeOperation: string;
  }>>([]);
  const [rectangles, setRectangles] = useState<Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
    globalCompositeOperation: string;
  }>>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPaintPos, setLastPaintPos] = useState<{x: number, y: number} | null>(null);
  const [previewUpdateTrigger, setPreviewUpdateTrigger] = useState(0);
  const [gridLines, setGridLines] = useState<Array<{
    points: number[];
    stroke: string;
    strokeWidth: number;
  }>>([]);
  
  const stageRef = useRef<Konva.Stage>(null);
  const imageRef = useRef<Konva.Image>(null);
  const cropRectRef = useRef<Konva.Rect>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (imageFile && !imageFiles.includes(imageFile)) {
      setImageFiles(prev => [...prev, imageFile]);
      setCurrentImageIndex(imageFiles.length);
    }
  }, [imageFile]);

  useEffect(() => {
    if (imageFiles.length > 0) {
      const currentFile = imageFiles[currentImageIndex];
      const url = URL.createObjectURL(currentFile);
      
      const img = new window.Image();
      img.onload = () => {
        // Scale down images wider than 1024px while maintaining aspect ratio
        const maxWidth = 1024;
        let scaledWidth = img.width;
        let scaledHeight = img.height;
        
        if (img.width > maxWidth) {
          const scale = maxWidth / img.width;
          scaledWidth = maxWidth;
          scaledHeight = img.height * scale;
        }
        
        // Create a canvas to scale the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
        
        // Create a new image from the scaled canvas
        const scaledImg = new window.Image();
        scaledImg.onload = () => {
          setKonvaImage(scaledImg);
          
          // Set stage size to accommodate the full image with padding
          const padding = 100;
          const stageWidth = scaledImg.width + padding;
          const stageHeight = scaledImg.height + padding;
          
          setStageSize({ width: stageWidth, height: stageHeight });
          
          // Calculate image position (centered)
          const imgX = padding / 2;
          const imgY = padding / 2;
          setImagePosition({ x: imgX, y: imgY });
          
          // Set initial crop to largest square in center
          const size = Math.min(scaledImg.width, scaledImg.height);
          const x = imgX + (scaledImg.width - size) / 2;
          const y = imgY + (scaledImg.height - size) / 2;
          
          setCropRect({ x, y, width: size, height: size });
          setOptions(prev => ({
            ...prev,
            cropStart: { x: x - imgX, y: y - imgY },
            cropSize: size,
            outputSize: 32
          }));
        };
        scaledImg.src = canvas.toDataURL();
        
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  }, [imageFiles, currentImageIndex]);

  // Update crop rect when transformer changes
  useEffect(() => {
    if (transformerRef.current && cropRectRef.current && selectedTool === 'crop') {
      transformerRef.current.nodes([cropRectRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedTool, cropRect]);

  // Apply custom cursor for brush tools
  useEffect(() => {
    if (stageRef.current) {
      const stageElement = stageRef.current.container();
      if (selectedTool === 'paint' || selectedTool === 'erase') {
        stageElement.style.cursor = createBrushCursor(
          selectedTool === 'erase' ? brushSize * 2 : brushSize, 
          brushColor
        );
      } else {
        stageElement.style.cursor = 'default';
      }
    }
  }, [selectedTool, brushSize, brushColor]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      setImageFiles(prev => [...prev, ...files]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
      if (files.length > 0) {
        setImageFiles(prev => [...prev, ...files]);
      }
    }
  };

  const handleCropTransform = () => {
    if (!cropRectRef.current || !konvaImage) return;
    
    const node = cropRectRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    // Reset scale and apply to width/height
    node.scaleX(1);
    node.scaleY(1);
    
    const newRect = {
      x: node.x(),
      y: node.y(),
      width: Math.max(32, node.width() * scaleX),
      height: Math.max(32, node.height() * scaleY)
    };
    
    // Make it a square (use smaller dimension)
    const size = Math.min(newRect.width, newRect.height);
    newRect.width = size;
    newRect.height = size;
    
    setCropRect(newRect);
    setOptions(prev => ({
      ...prev,
      cropStart: { x: newRect.x - imagePosition.x, y: newRect.y - imagePosition.y },
      cropSize: size
    }));
  };

  const handleStageMouseDown = (e: any) => {
    if (selectedTool === 'paint' || selectedTool === 'erase') {
      setIsDrawing(true);
      const pos = e.target.getStage().getPointerPosition();
      
      // Draw a square instead of starting a line
      const squareSize = selectedTool === 'erase' ? brushSize * 2 : brushSize;
      const newRect = {
        x: pos.x - squareSize / 2,
        y: pos.y - squareSize / 2,
        width: squareSize,
        height: squareSize,
        fill: selectedTool === 'erase' ? '#FFFFFF' : brushColor,
        globalCompositeOperation: selectedTool === 'erase' ? 'destination-out' : 'source-over'
      };
      setRectangles(prev => [...prev, newRect]);
      setLastPaintPos({x: pos.x, y: pos.y});
    }
  };

  const handleStageMouseMove = (e: any) => {
    if (!isDrawing) return;
    
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    // Throttle painting to prevent too many rectangles
    if (lastPaintPos) {
      const distance = Math.sqrt(
        Math.pow(point.x - lastPaintPos.x, 2) + Math.pow(point.y - lastPaintPos.y, 2)
      );
      // Only paint if moved more than half the brush size
      const squareSize = selectedTool === 'erase' ? brushSize * 2 : brushSize;
      if (distance < squareSize / 2) return;
    }
    
    // Continue drawing squares for continuous painting
    const squareSize = selectedTool === 'erase' ? brushSize * 2 : brushSize;
    const newRect = {
      x: point.x - squareSize / 2,
      y: point.y - squareSize / 2,
      width: squareSize,
      height: squareSize,
      fill: selectedTool === 'erase' ? '#FFFFFF' : brushColor,
      globalCompositeOperation: selectedTool === 'erase' ? 'destination-out' : 'source-over'
    };
    setRectangles(prev => [...prev, newRect]);
    setLastPaintPos({x: point.x, y: point.y});
  };

  const handleStageMouseUp = () => {
    setIsDrawing(false);
    setLastPaintPos(null);
    // Trigger preview update when painting stops
    setPreviewUpdateTrigger(prev => prev + 1);
  };

  const handleProcess = async () => {
    if (!stageRef.current || imageFiles.length === 0) return;
    
    setIsProcessing(true);
    try {
      // Export the stage as image data including all painted rectangles
      const dataURL = stageRef.current.toDataURL({
        x: cropRect.x,
        y: cropRect.y,
        width: cropRect.width,
        height: cropRect.height,
        pixelRatio: 1
      });
      
      const img = await new Promise<HTMLImageElement>((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.src = dataURL;
      });
      
      // Create main processing canvas with output size
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = options.outputSize;
      canvas.height = options.outputSize;
      
      ctx.save();
      ctx.translate(options.outputSize / 2, options.outputSize / 2);
      
      if (options.rotation) {
        ctx.rotate((options.rotation * Math.PI) / 180);
      }
      if (options.flipX || options.flipY) {
        ctx.scale(options.flipX ? -1 : 1, options.flipY ? -1 : 1);
      }
      
      ctx.translate(-options.outputSize / 2, -options.outputSize / 2);
      
      // Scale the cropped image to fit the output size
      ctx.drawImage(img, 0, 0, options.outputSize, options.outputSize);
      ctx.restore();
      
      const processedImages: ProcessedImage[] = [];
      
      if (options.splitIntoTiles) {
        // Calculate how many tiles fit in the output size
        const tilesCount = Math.floor(options.outputSize / options.tileSize);
        
        for (let y = 0; y < tilesCount; y++) {
          for (let x = 0; x < tilesCount; x++) {
            // Extract each tile
            const tileCanvas = document.createElement('canvas');
            const tileCtx = tileCanvas.getContext('2d')!;
            tileCanvas.width = options.tileSize;
            tileCanvas.height = options.tileSize;
            
            tileCtx.drawImage(
              canvas,
              x * options.tileSize,
              y * options.tileSize,
              options.tileSize,
              options.tileSize,
              0,
              0,
              options.tileSize,
              options.tileSize
            );
            
            processedImages.push({
              id: Math.random().toString(36).substring(2, 15),
              originalUrl: dataURL,
              processedUrl: tileCanvas.toDataURL(),
              width: options.tileSize,
              height: options.tileSize,
              tileSize: options.tileSize
            });
          }
        }
      } else {
        // Single image output
        processedImages.push({
          id: Math.random().toString(36).substring(2, 15),
          originalUrl: dataURL,
          processedUrl: canvas.toDataURL(),
          width: options.outputSize,
          height: options.outputSize,
          tileSize: options.outputSize
        });
      }
      
      onProcessingComplete(processedImages);
      // Clear the painted elements after processing
      setLines([]);
      setRectangles([]);
      
    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const navigateImages = (direction: 'prev' | 'next') => {
    setCurrentImageIndex(prev => {
      if (direction === 'prev') {
        return prev > 0 ? prev - 1 : imageFiles.length - 1;
      } else {
        return prev < imageFiles.length - 1 ? prev + 1 : 0;
      }
    });
  };

  // Create custom cursor for brush tools
  const createBrushCursor = (size: number, color: string) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const dimension = Math.max(size, 4);
    
    canvas.width = dimension + 4;
    canvas.height = dimension + 4;
    
    // Draw square border
    ctx.beginPath();
    ctx.rect(2, 2, dimension, dimension);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Fill square
    ctx.beginPath();
    ctx.rect(3, 3, dimension - 2, dimension - 2);
    ctx.fillStyle = selectedTool === 'erase' ? '#fff' : color;
    ctx.fill();
    
    return `url(${canvas.toDataURL()}) ${canvas.width / 2} ${canvas.height / 2}, crosshair`;
  };

  const fitCropToImage = () => {
    if (!konvaImage) return;
    
    const newRect = {
      x: imagePosition.x,
      y: imagePosition.y,
      width: konvaImage.width,
      height: konvaImage.height
    };
    
    setCropRect(newRect);
    setOptions(prev => ({
      ...prev,
      cropStart: { x: 0, y: 0 },
      cropSize: Math.min(konvaImage.width, konvaImage.height)
    }));
  };

  return (
    <div className="mt-6 bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Process Image</h2>
      
      <div className="grid grid-cols-1 gap-6" style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div style={{ minWidth: '1024px' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-medium text-gray-700">Original & Tools</h3>
              <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  className={`p-2 rounded ${selectedTool === 'crop' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
                  onClick={() => setSelectedTool('crop')}
                >
                  <Crop className="w-5 h-5" />
                </button>
                <button
                  className={`p-2 rounded ${selectedTool === 'paint' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
                  onClick={() => {
                    setSelectedTool('paint');
                    setShowColorPicker(true);
                  }}
                >
                  <div className="relative">
                    <Brush className="w-5 h-5" />
                    <div 
                      className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full border border-white"
                      style={{ backgroundColor: brushColor }}
                    />
                  </div>
                </button>
                <button
                  className={`p-2 rounded ${selectedTool === 'erase' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
                  onClick={() => setSelectedTool('erase')}
                >
                  <Eraser className="w-5 h-5" />
                </button>
              </div>
              {selectedTool === 'crop' && (
                <button
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                  onClick={fitCropToImage}
                >
                  Fit to Image
                </button>
              )}
            </div>
            
            {imageFiles.length > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  className="p-2 rounded bg-gray-100 hover:bg-gray-200"
                  onClick={() => navigateImages('prev')}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-600">
                  {currentImageIndex + 1} / {imageFiles.length}
                </span>
                <button
                  className="p-2 rounded bg-gray-100 hover:bg-gray-200"
                  onClick={() => navigateImages('next')}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex space-x-4 mb-3">
            <div className="bg-gray-100 rounded-lg p-2">
              <span className="text-sm font-medium text-gray-600">Original Size: </span>
              <span className="text-sm text-gray-800">
                {konvaImage ? `${konvaImage.width}×${konvaImage.height}px` : 'Loading...'}
              </span>
            </div>
            <div className="bg-gray-100 rounded-lg p-2">
              <span className="text-sm font-medium text-gray-600">Stage Size: </span>
              <span className="text-sm text-gray-800">
                {`${stageSize.width}×${stageSize.height}px`}
              </span>
            </div>
          </div>
          
          <div 
            className="border rounded-lg p-4 bg-gray-50 flex items-center justify-center overflow-visible"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{
              minWidth: `${stageSize.width + 32}px`,
              minHeight: `${stageSize.height + 32}px`
            }}
          >
            {konvaImage && (
              <Stage
                ref={stageRef}
                width={stageSize.width}
                height={stageSize.height}
                style={{ border: '1px solid #ddd', backgroundColor: 'white' }}
                onMouseDown={handleStageMouseDown}
                onMousemove={handleStageMouseMove}
                onMouseup={handleStageMouseUp}
              >
                <Layer>
                  <KonvaImage
                    ref={imageRef}
                    image={konvaImage}
                    x={imagePosition.x}
                    y={imagePosition.y}
                    width={konvaImage.width}
                    height={konvaImage.height}
                  />
                  
                  {/* Draw rectangles for painting */}
                  {rectangles.map((rect, i) => (
                    <Rect
                      key={i}
                      x={rect.x}
                      y={rect.y}
                      width={rect.width}
                      height={rect.height}
                      fill={rect.fill}
                      globalCompositeOperation={rect.globalCompositeOperation as any}
                    />
                  ))}
                  
                  {selectedTool === 'crop' && (
                    <>
                      <Rect
                        ref={cropRectRef}
                        x={cropRect.x}
                        y={cropRect.y}
                        width={cropRect.width}
                        height={cropRect.height}
                        stroke="blue"
                        strokeWidth={2}
                        fill="rgba(0, 0, 255, 0.1)"
                        draggable
                        onDragEnd={(e) => {
                          const newRect = {
                            ...cropRect,
                            x: e.target.x(),
                            y: e.target.y()
                          };
                          setCropRect(newRect);
                          setOptions(prev => ({
                            ...prev,
                            cropStart: { x: newRect.x - imagePosition.x, y: newRect.y - imagePosition.y }
                          }));
                        }}
                        onTransformEnd={handleCropTransform}
                      />
                      <Transformer
                        ref={transformerRef}
                        enabledAnchors={['bottom-right']}
                        keepRatio={true}
                        boundBoxFunc={(oldBox, newBox) => {
                          // Limit resize
                          if (newBox.width < 32 || newBox.height < 32) {
                            return oldBox;
                          }
                          return newBox;
                        }}
                      />
                    </>
                  )}
                </Layer>
              </Stage>
            )}
          </div>
          
          <div className="mt-4 grid grid-cols-6 gap-2">
            {imageFiles.map((file, index) => (
              <div
                key={index}
                className={`relative aspect-square border-2 rounded cursor-pointer ${
                  index === currentImageIndex ? 'border-blue-500' : 'border-gray-200'
                }`}
                onClick={() => setCurrentImageIndex(index)}
              >
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            <label className="relative aspect-square border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center">
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleFileInput}
              />
              <div className="text-3xl text-gray-400">+</div>
            </label>
          </div>
        </div>
        
        <div className='settings-container' style={{ marginLeft: '50px', minWidth: '300px', flexShrink: 0 }}>
          <h3 className="text-lg font-medium mb-3 text-gray-700">Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rotation
              </label>
              <div className="flex items-center space-x-2">
                <button
                  className={`p-2 rounded ${options.rotation === 0 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}
                  onClick={() => setOptions(prev => ({ ...prev, rotation: 0 }))}
                >
                  <RotateCw className="w-5 h-5" />
                </button>
                {[90, 180, 270].map(deg => (
                  <button
                    key={deg}
                    className={`p-2 rounded ${options.rotation === deg ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}
                    onClick={() => setOptions(prev => ({ ...prev, rotation: deg }))}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Flip
              </label>
              <div className="flex space-x-2">
                <button
                  className={`p-2 rounded ${options.flipX ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}
                  onClick={() => setOptions(prev => ({ ...prev, flipX: !prev.flipX }))}
                >
                  <FlipHorizontal className="w-5 h-5" />
                </button>
                <button
                  className={`p-2 rounded ${options.flipY ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}
                  onClick={() => setOptions(prev => ({ ...prev, flipY: !prev.flipY }))}
                >
                  <FlipVertical className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Output Size
              </label>
              <div className="flex items-center space-x-2">
                {[32, 64, 128, 256, 512].map(size => (
                  <button
                    key={size}
                    className={`p-2 rounded ${options.outputSize === size ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}
                    onClick={() => setOptions(prev => ({ ...prev, outputSize: size }))}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker for Paint Tool */}
            {selectedTool === 'paint' && showColorPicker && (
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brush Color
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="w-12 h-8 border rounded cursor-pointer"
                  />
                  <div className="text-sm font-mono text-gray-600">{brushColor}</div>
                  <button
                    className="px-2 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                    onClick={() => setShowColorPicker(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* Brush Size for Paint/Erase Tools */}
            {(selectedTool === 'paint' || selectedTool === 'erase') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Brush Size: {brushSize}px
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1px</span>
                  <span>50px</span>
                </div>
              </div>
            )}
            
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={options.splitIntoTiles}
                  onChange={(e) => setOptions(prev => ({ ...prev, splitIntoTiles: e.target.checked }))}
                  className="rounded text-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Split into tiles</span>
              </label>
              
              {options.splitIntoTiles && (
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tile Size
                  </label>
                  <div className="flex items-center space-x-2">
                    {[32, 64].map(size => (
                      <button
                        key={size}
                        className={`p-2 rounded ${options.tileSize === size ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}
                        onClick={() => setOptions(prev => ({ ...prev, tileSize: size }))}
                      >
                        {size}px
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Live Preview */}
            <LivePreview
              stageRef={stageRef}
              cropRect={cropRect}
              options={options}
              lines={lines}
              rectangles={rectangles}
              konvaImage={konvaImage}
              isDrawing={isDrawing}
              forceUpdate={previewUpdateTrigger}
            />

            {/* Clear button for painted elements */}
            {(rectangles.length > 0 || lines.length > 0) && (
              <div>
                <button
                  className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  onClick={() => {
                    setLines([]);
                    setRectangles([]);
                  }}
                >
                  Clear Painting
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex justify-center mt-6">
        <button
          className={`px-6 py-2 rounded-md font-medium transition-colors ${
            !isProcessing && imageFiles.length > 0
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
          onClick={handleProcess}
          disabled={isProcessing || imageFiles.length === 0}
        >
          {isProcessing ? 'Processing...' : 'Process Image'}
        </button>
      </div>
    </div>
  );
};

export default ImageProcessor;