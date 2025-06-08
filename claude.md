## Project Conventions & Systems

### Preprocessing Tilemap Project

**Location**: `preprocessing_tilemap/`
**Type**: React + TypeScript + Vite application for image processing and tilemap creation

#### Running the Application

**Development Mode:**
```bash
cd preprocessing_tilemap
pnpm run dev
```
- Runs on `http://localhost:5173` (or next available port like 5174)
- Hot reloading enabled

**Production Build:**
```bash
cd preprocessing_tilemap  
pnpm run build
```
- Outputs to `dist/` folder
- Ready for deployment

**Preview Built Version:**
```bash
cd preprocessing_tilemap
pnpm run preview
```
- Serves the built `dist/` folder locally
- Tests production build before deployment

#### Deployment (Netlify)

**Required Files:**
- `netlify.toml` - Build configuration and headers for correct MIME types
- `public/_redirects` - SPA routing support
- Removed `vite.svg` favicon reference to prevent 404 errors

**Build Settings:**
- Build command: `pnpm run build`
- Publish directory: `dist`
- MIME type headers configured for `.js`, `.mjs`, and `.css` files

#### UI Scaling & Zoom

**Optimal Viewing**: The application looks better at 80% browser zoom rather than 100% because:
- **Layout Design**: Components are sized for larger viewports and benefit from slight scaling down
- **Canvas Dimensions**: The 1024px+ canvas width fits better on most screens at 80%
- **Typography**: Text and UI elements have better proportional relationships at reduced scale
- **Settings Panel**: The right-side settings panel positioning works better with the scaled layout
- **Dense UI**: Multiple panels (tile palette, canvas, settings) benefit from compact viewing

**Recommendation**: Suggest users zoom to 80% for optimal experience, or add responsive design improvements for 100% zoom.

#### Application Architecture

**Main Components:**
- `App.tsx` - Main application with step-based workflow (Upload → Process → Edit)
- `ImageUploader.tsx` - File upload interface
- `ImageProcessor.tsx` - Konva-based image editing with crop, paint, erase tools
- `LivePreview.tsx` - Separate component for real-time preview (updates only on mouse up during painting)
- `TilePalette.tsx` - Displays processed tiles for selection
- `TilemapEditor.tsx` - 1024x1024 tilemap editor with grid support

**Key Features:**
- **Square Brush Painting**: Custom square pixel brush instead of circular
- **Live Preview**: Shows exact output with tile grid overlay
- **Output Scaling**: Properly scales cropped content to selected output size (32, 64, 128, 256, 512px)
- **Tile Splitting**: Automatically creates individual tiles when "Split into tiles" is enabled
- **Tilemap Import**: Supports importing existing tilemaps with 2px spacing (traditional format)
- **Persistent Tile Palette**: Tiles accumulate across processing operations instead of clearing
- **Settings Panel**: Fixed-width panel positioned to avoid overlap with 1024px canvas
- **Default Output**: 32x32px output size by default, user-selectable

**Technical Details:**
- Uses Konva.js for canvas manipulation
- Exports actual stage content (including painted modifications)
- Throttled painting to prevent performance issues
- Proper MIME type handling for deployment