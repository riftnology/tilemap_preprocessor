import { ProcessedImage, ImageProcessingOptions, Tile } from '../types';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d')! };
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });
};

const rotateAndFlipCanvas = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rotation: number,
  flipX: boolean,
  flipY: boolean
) => {
  ctx.translate(width / 2, height / 2);
  
  if (rotation) {
    ctx.rotate((rotation * Math.PI) / 180);
  }
  
  if (flipX || flipY) {
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  }
  
  ctx.translate(-width / 2, -height / 2);
};

const extractTile = (
  sourceCanvas: HTMLCanvasElement,
  x: number,
  y: number,
  tileSize: number
): ProcessedImage => {
  const { canvas, ctx } = createCanvas(tileSize, tileSize);
  
  ctx.drawImage(
    sourceCanvas,
    x * tileSize,
    y * tileSize,
    tileSize,
    tileSize,
    0,
    0,
    tileSize,
    tileSize
  );

  return {
    id: generateId(),
    originalUrl: sourceCanvas.toDataURL(),
    processedUrl: canvas.toDataURL(),
    width: tileSize,
    height: tileSize,
    tileSize
  };
};

export const processImage = async (
  file: File,
  options: ImageProcessingOptions
): Promise<ProcessedImage[]> => {
  const processedImages: ProcessedImage[] = [];
  
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });

  const img = await loadImage(dataUrl);
  
  // Create main processing canvas
  const { canvas, ctx } = createCanvas(options.outputSize, options.outputSize);
  
  // Apply transformations
  rotateAndFlipCanvas(
    ctx,
    options.outputSize,
    options.outputSize,
    options.rotation,
    options.flipX,
    options.flipY
  );
  
  // Draw cropped and scaled image
  ctx.drawImage(
    img,
    options.cropStart.x,
    options.cropStart.y,
    options.cropSize,
    options.cropSize,
    0,
    0,
    options.outputSize,
    options.outputSize
  );
  
  if (options.splitIntoTiles) {
    const tilesCount = Math.floor(options.outputSize / options.tileSize);
    
    for (let y = 0; y < tilesCount; y++) {
      for (let x = 0; x < tilesCount; x++) {
        processedImages.push(extractTile(canvas, x, y, options.tileSize));
      }
    }
  } else {
    processedImages.push({
      id: generateId(),
      originalUrl: dataUrl,
      processedUrl: canvas.toDataURL(),
      width: options.outputSize,
      height: options.outputSize,
      tileSize: options.outputSize
    });
  }

  return processedImages;
};

export const createEmptyTilemap = (
  width: number,
  height: number,
  tileSize: number
): (Tile | null)[][] => {
  const tiles: (Tile | null)[][] = [];
  
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = null;
    }
  }
  
  return tiles;
};

export const loadTilemapFromImage = async (
  imageUrl: string,
  tileSize: number,
  spacing: number = 2
): Promise<(Tile | null)[][]> => {
  const img = await loadImage(imageUrl);
  // Calculate tiles considering spacing: each tile takes tileSize + spacing, except the last row/column
  const tilesX = Math.floor((img.width + spacing) / (tileSize + spacing));
  const tilesY = Math.floor((img.height + spacing) / (tileSize + spacing));
  const tiles: (Tile | null)[][] = [];
  
  for (let y = 0; y < tilesY; y++) {
    tiles[y] = [];
    for (let x = 0; x < tilesX; x++) {
      const { canvas, ctx } = createCanvas(tileSize, tileSize);
      
      // Calculate source position with spacing
      const sourceX = x * (tileSize + spacing);
      const sourceY = y * (tileSize + spacing);
      
      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        tileSize,
        tileSize,
        0,
        0,
        tileSize,
        tileSize
      );
      
      tiles[y][x] = {
        id: generateId(),
        imageUrl: canvas.toDataURL('image/png'),
        width: tileSize,
        height: tileSize
      };
    }
  }
  
  return tiles;
};

export const extractTilesFromTilemap = async (
  imageUrl: string,
  tileSize: number,
  spacing: number = 2
): Promise<ProcessedImage[]> => {
  const img = await loadImage(imageUrl);
  // Calculate tiles considering spacing: each tile takes tileSize + spacing, except the last row/column
  const tilesX = Math.floor((img.width + spacing) / (tileSize + spacing));
  const tilesY = Math.floor((img.height + spacing) / (tileSize + spacing));
  const processedImages: ProcessedImage[] = [];
  
  for (let y = 0; y < tilesY; y++) {
    for (let x = 0; x < tilesX; x++) {
      const { canvas, ctx } = createCanvas(tileSize, tileSize);
      
      // Calculate source position with spacing
      const sourceX = x * (tileSize + spacing);
      const sourceY = y * (tileSize + spacing);
      
      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        tileSize,
        tileSize,
        0,
        0,
        tileSize,
        tileSize
      );
      
      const processedImage: ProcessedImage = {
        id: generateId(),
        originalUrl: imageUrl,
        processedUrl: canvas.toDataURL('image/png'),
        width: tileSize,
        height: tileSize,
        tileSize: tileSize
      };
      
      processedImages.push(processedImage);
    }
  }
  
  return processedImages;
};