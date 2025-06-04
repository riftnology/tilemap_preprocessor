export interface Tile {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
}

export interface TileMap {
  id: string;
  name: string;
  width: number;
  height: number;
  tileSize: number;
  tiles: (Tile | null)[][];
}

export interface ProcessedImage {
  id: string;
  originalUrl: string;
  processedUrl: string;
  width: number;
  height: number;
  tileSize: number;
}

export interface ImageProcessingOptions {
  cropStart: { x: number; y: number };
  cropSize: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  outputSize: number;
  splitIntoTiles: boolean;
  tileSize: number;
}