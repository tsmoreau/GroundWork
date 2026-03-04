# Bird Wars Replay Viewer Schema

This document describes the architecture for a web-based replay viewer that renders Bird Wars battles using HTML5 Canvas, matching the visual style of the Playdate game.

---

## 1. Overview

The replay viewer allows users to watch completed (or in-progress) battles by stepping through the turn history. It renders:

- An isometric grid with perspective projection (matching the Playdate look)
- Procedurally filled tiles using 8-bit dither patterns
- Unit sprites positioned on the grid
- Animated transitions for move/attack actions

**Route:** `/replay/[battleId]`

---

## 2. Data Sources

### 2.1 Battle & Turn Data

Fetched from existing API:

```
GET /api/battles/[battleId]
```

**Response:**
```json
{
  "success": true,
  "battle": {
    "battleId": "abc123",
    "player1DeviceId": "device1...",
    "player2DeviceId": "device2...",
    "status": "completed",
    "currentTurn": 12,
    "winnerId": "device1...",
    "mapData": { ... },
    "currentState": {
      "units": [...],
      "blockedTiles": [...]
    }
  },
  "turns": [
    {
      "turnId": "turn1...",
      "turnNumber": 1,
      "deviceId": "device1...",
      "actions": [
        { "type": "move", "unitId": "u1", "from": {"x": 2, "y": 3}, "to": {"x": 4, "y": 3} },
        { "type": "attack", "unitId": "u1", "targetId": "u5" },
        { "type": "end_turn" }
      ],
      "gameState": {
        "units": [...],
        "winner": null
      }
    },
    ...
  ]
}
```

### 2.2 Map Files

Map files will be stored on the server and fetched by map ID/name. The map data includes:

```
GET /api/maps/[mapId]
```

**Response:**
```json
{
  "success": true,
  "map": {
    "mapId": "map001",
    "name": "Grassland Skirmish",
    "grid": {
      "maxGridSizeX": 12,
      "maxGridSizeZ": 12
    },
    "gameplayTerrain": {
      "0,0": "grass",
      "0,1": "grass",
      "1,0": "dirt",
      "2,3": "water",
      ...
    },
    "tileDitherPatternOverrides": {
      "5,5": "CHECKER_MEDIUM",
      ...
    },
    "unitPlacement": [...],
    "itemPlacement": [...],
    "defaultDitherPatternKey": "GRASS_TEXTURE_LIGHT"
  }
}
```

Alternatively, if `mapData` is stored directly in the battle document, no separate fetch is needed.

---

## 3. Rendering Engine

### 3.1 Projection System

Port the Playdate projection math to JavaScript. The goal is to match the perspective look of the original game.

**Configuration Parameters:**
```typescript
interface ProjectionConfig {
  projectionScale: number;          // Scale factor for projected coordinates
  focalLength: number;              // Focal length for perspective projection
  vanishingPointYOffset: number;    // Vertical offset for vanishing point
  nearClipDistance: number;         // Minimum divisor to prevent division issues
  enablePerspectiveProjection: boolean;  // Toggle perspective vs orthographic
  tile3DWidth: number;              // World-space width of each tile
}

// Suggested defaults (tune to match Playdate look):
const DEFAULT_CONFIG: ProjectionConfig = {
  projectionScale: 1.5,
  focalLength: 300,
  vanishingPointYOffset: -50,
  nearClipDistance: 10,
  enablePerspectiveProjection: true,
  tile3DWidth: 32
};
```

**Core Projection Functions (JavaScript port):**

```typescript
class GridProjection {
  config: ProjectionConfig;
  maxGridSizeX: number;
  maxGridSizeZ: number;
  screenCenterX: number;
  screenCenterY: number;
  
  // Cached trig values
  cosViewAngle: number;
  sinViewAngle: number;
  cosGridAngle: number;
  sinGridAngle: number;

  constructor(config: ProjectionConfig, maxX: number, maxZ: number, screenCenterX: number, screenCenterY: number) {
    this.config = config;
    this.maxGridSizeX = maxX;
    this.maxGridSizeZ = maxZ;
    this.screenCenterX = screenCenterX;
    this.screenCenterY = screenCenterY;
  }

  // Convert grid coordinates to world coordinates
  gridToWorld(gridX: number, gridZ: number): { x: number; y: number; z: number } {
    const centerGridX = (this.maxGridSizeX - 1) / 2.0;
    const centerGridZ = (this.maxGridSizeZ - 1) / 2.0;
    
    let worldX = (gridX - centerGridX) * this.config.tile3DWidth;
    let worldZ = (gridZ - centerGridZ) * this.config.tile3DWidth;
    
    // Adjust for even grid sizes
    if (this.maxGridSizeX % 2 === 0) worldX -= this.config.tile3DWidth / 2;
    if (this.maxGridSizeZ % 2 === 0) worldZ -= this.config.tile3DWidth / 2;
    
    return { x: worldX, y: 0, z: worldZ };
  }

  // Project world point to screen coordinates
  projectPoint(
    worldX: number, 
    worldY: number, 
    worldZ: number,
    cameraOffsetX: number = 0,
    cameraOffsetY: number = 0
  ): { x: number; y: number } {
    // Rotate around Y axis (grid rotation)
    const yRotatedX = worldX * this.cosGridAngle + worldZ * this.sinGridAngle;
    const yRotatedZ = -worldX * this.sinGridAngle + worldZ * this.cosGridAngle;
    
    // Rotate around X axis (view tilt)
    const viewSpaceX = yRotatedX;
    const viewSpaceY = worldY * this.cosViewAngle - yRotatedZ * this.sinViewAngle;
    const viewSpaceZ = worldY * this.sinViewAngle + yRotatedZ * this.cosViewAngle;

    let projX: number, projY: number;

    if (this.config.enablePerspectiveProjection) {
      let divisor = this.config.focalLength + viewSpaceZ;
      if (divisor < this.config.nearClipDistance) {
        divisor = this.config.nearClipDistance;
      }
      const perspectiveFactor = this.config.focalLength / divisor;
      projX = viewSpaceX * perspectiveFactor * this.config.projectionScale;
      projY = viewSpaceY * perspectiveFactor * this.config.projectionScale;
    } else {
      projX = viewSpaceX * this.config.projectionScale;
      projY = viewSpaceY * this.config.projectionScale;
    }

    let screenCenterY = this.screenCenterY;
    if (this.config.enablePerspectiveProjection) {
      screenCenterY += this.config.vanishingPointYOffset;
    }

    return {
      x: this.screenCenterX + projX - cameraOffsetX,
      y: screenCenterY + projY - cameraOffsetY
    };
  }

  // Set view angles (call before projection)
  setAngles(gridAngleDegrees: number, verticalViewAngleDegrees: number): void {
    const gridRad = gridAngleDegrees * Math.PI / 180;
    const viewRad = verticalViewAngleDegrees * Math.PI / 180;
    
    this.cosGridAngle = Math.cos(gridRad);
    this.sinGridAngle = Math.sin(gridRad);
    this.cosViewAngle = Math.cos(viewRad);
    this.sinViewAngle = Math.sin(viewRad);
  }

  // Get the 4 corners of a tile in screen space
  getTileCorners(gridX: number, gridZ: number, cameraOffsetX = 0, cameraOffsetY = 0): number[] {
    const corners = [
      this.gridToWorld(gridX, gridZ),
      this.gridToWorld(gridX + 1, gridZ),
      this.gridToWorld(gridX + 1, gridZ + 1),
      this.gridToWorld(gridX, gridZ + 1)
    ];
    
    const screenCorners: number[] = [];
    for (const corner of corners) {
      const screen = this.projectPoint(corner.x, corner.y, corner.z, cameraOffsetX, cameraOffsetY);
      screenCorners.push(screen.x, screen.y);
    }
    return screenCorners; // [x1, y1, x2, y2, x3, y3, x4, y4]
  }

  // Get center of a tile in screen space (for positioning units)
  getTileCenter(gridX: number, gridZ: number, cameraOffsetX = 0, cameraOffsetY = 0): { x: number; y: number } {
    const world = this.gridToWorld(gridX + 0.5, gridZ + 0.5);
    return this.projectPoint(world.x, world.y, world.z, cameraOffsetX, cameraOffsetY);
  }
}
```

**Suggested View Angles:**
- `gridAngle`: 45° (isometric rotation)
- `verticalViewAngle`: 30-60° (camera tilt - adjust to match Playdate)

### 3.1.1 Projection Caching & Performance

For performance, cache projection calculations like the Playdate version:

```typescript
interface TileProjectionCache {
  // Raw projection values (before screen center offset)
  raw_sx1: number; raw_sy1: number;
  raw_sx2: number; raw_sy2: number;
  raw_sx3: number; raw_sy3: number;
  raw_sx4: number; raw_sy4: number;
}

interface TileCenterCache {
  x: number;  // Raw projected center X
  y: number;  // Raw projected center Y
}

class GridProjection {
  // ... existing fields ...
  
  // Projection caches keyed by "viewAngle_gridAngle"
  private projectionCache: Map<string, Map<string, TileProjectionCache>> = new Map();
  private centerCache: Map<string, Map<string, TileCenterCache>> = new Map();
  
  // Valid tile callback - determines which tiles to render
  private isValidTile: (x: number, z: number) => boolean;

  // Generate cache for all tiles at given angles (call once when view changes)
  generateProjectionCache(gridAngle: number, viewAngle: number): void {
    this.setAngles(gridAngle, viewAngle);
    const angleKey = `${viewAngle}_${gridAngle}`;
    
    if (!this.projectionCache.has(angleKey)) {
      this.projectionCache.set(angleKey, new Map());
      this.centerCache.set(angleKey, new Map());
    }
    
    const projCache = this.projectionCache.get(angleKey)!;
    const cenCache = this.centerCache.get(angleKey)!;
    
    for (let z = 0; z < this.maxGridSizeZ; z++) {
      for (let x = 0; x < this.maxGridSizeX; x++) {
        if (!this.isValidTile(x, z)) continue;
        
        const tileKey = `${x},${z}`;
        
        // Get raw projections (no camera offset, no screen center)
        const corners = [
          this.gridToWorld(x, z),
          this.gridToWorld(x + 1, z),
          this.gridToWorld(x + 1, z + 1),
          this.gridToWorld(x, z + 1)
        ];
        
        const raw = corners.map(c => this.getRawProjection(c.x, c.y, c.z));
        projCache.set(tileKey, {
          raw_sx1: raw[0].x, raw_sy1: raw[0].y,
          raw_sx2: raw[1].x, raw_sy2: raw[1].y,
          raw_sx3: raw[2].x, raw_sy3: raw[2].y,
          raw_sx4: raw[3].x, raw_sy4: raw[3].y
        });
        
        // Cache center
        const centerWorld = this.gridToWorld(x + 0.5, z + 0.5);
        const rawCenter = this.getRawProjection(centerWorld.x, centerWorld.y, centerWorld.z);
        cenCache.set(tileKey, { x: rawCenter.x, y: rawCenter.y });
      }
    }
  }

  // Get raw projection (before screen center/camera offset)
  private getRawProjection(worldX: number, worldY: number, worldZ: number): { x: number; y: number } {
    const yRotatedX = worldX * this.cosGridAngle + worldZ * this.sinGridAngle;
    const yRotatedZ = -worldX * this.sinGridAngle + worldZ * this.cosGridAngle;
    
    const viewSpaceX = yRotatedX;
    const viewSpaceY = worldY * this.cosViewAngle - yRotatedZ * this.sinViewAngle;
    const viewSpaceZ = worldY * this.sinViewAngle + yRotatedZ * this.cosViewAngle;

    let projX: number, projY: number;

    if (this.config.enablePerspectiveProjection) {
      let divisor = this.config.focalLength + viewSpaceZ;
      // Near clip in raw space
      if (divisor < this.config.nearClipDistance) {
        divisor = this.config.nearClipDistance;
      }
      const perspectiveFactor = this.config.focalLength / divisor;
      projX = viewSpaceX * perspectiveFactor * this.config.projectionScale;
      projY = viewSpaceY * perspectiveFactor * this.config.projectionScale;
    } else {
      projX = viewSpaceX * this.config.projectionScale;
      projY = viewSpaceY * this.config.projectionScale;
    }

    return { x: projX, y: projY };
  }

  // Apply screen center and camera offset to raw projection
  private rawToScreen(rawX: number, rawY: number, cameraOffsetX: number, cameraOffsetY: number): { x: number; y: number } {
    let screenCenterY = this.screenCenterY;
    if (this.config.enablePerspectiveProjection) {
      screenCenterY += this.config.vanishingPointYOffset;
    }
    return {
      x: this.screenCenterX + rawX - cameraOffsetX,
      y: screenCenterY + rawY - cameraOffsetY
    };
  }

  // Get cached tile corners with camera offset applied
  getCachedTileCorners(
    gridX: number, 
    gridZ: number, 
    angleKey: string,
    cameraOffsetX: number, 
    cameraOffsetY: number
  ): number[] | null {
    const cache = this.projectionCache.get(angleKey);
    if (!cache) return null;
    
    const tileKey = `${gridX},${gridZ}`;
    const proj = cache.get(tileKey);
    if (!proj) return null;
    
    const s1 = this.rawToScreen(proj.raw_sx1, proj.raw_sy1, cameraOffsetX, cameraOffsetY);
    const s2 = this.rawToScreen(proj.raw_sx2, proj.raw_sy2, cameraOffsetX, cameraOffsetY);
    const s3 = this.rawToScreen(proj.raw_sx3, proj.raw_sy3, cameraOffsetX, cameraOffsetY);
    const s4 = this.rawToScreen(proj.raw_sx4, proj.raw_sy4, cameraOffsetX, cameraOffsetY);
    
    return [s1.x, s1.y, s2.x, s2.y, s3.x, s3.y, s4.x, s4.y];
  }
}
```

### 3.1.2 Tile Draw Ordering

Draw tiles back-to-front based on the view angle to ensure proper overlap:

```typescript
// For standard isometric (gridAngle ~45°), draw in order:
// - Higher Z values first (further from camera)
// - Within same Z, draw left-to-right or based on depth

function getTileDrawOrder(maxX: number, maxZ: number, isValidTile: (x: number, z: number) => boolean): Array<{x: number, z: number}> {
  const tiles: Array<{x: number, z: number}> = [];
  
  // Back to front: iterate Z from 0 to max (or reverse depending on view angle)
  for (let z = 0; z < maxZ; z++) {
    for (let x = 0; x < maxX; x++) {
      if (isValidTile(x, z)) {
        tiles.push({ x, z });
      }
    }
  }
  
  return tiles;
}
```

---

### 3.2 Dither Pattern System

Port the Playdate's 8-bit dither patterns to Canvas pattern fills.

**Pattern Definitions (ported from gridDefinitions.lua):**

```typescript
// Each pattern is 8 bytes, each byte is a row of 8 pixels
// Bit 1 = foreground color, Bit 0 = background color
const DITHER_PATTERNS: Record<string, number[]> = {
  SOLID_BLACK:           [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF],
  SOLID_GRAY_75:         [0xEE, 0xEE, 0xEE, 0xEE, 0xEE, 0xEE, 0xEE, 0xEE],
  SOLID_GRAY_50:         [0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA],
  SOLID_GRAY_25:         [0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55],
  SOLID_WHITE:           [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  
  CHECKER_MEDIUM:        [0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55],
  CHECKER_FINE:          [0xCC, 0x33, 0xCC, 0x33, 0xCC, 0x33, 0xCC, 0x33],
  VERTICAL_LINES_MEDIUM: [0xCC, 0xCC, 0xCC, 0xCC, 0xCC, 0xCC, 0xCC, 0xCC],
  HORIZONTAL_LINES_MEDIUM: [0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00],
  DIAGONAL_LINES_R:      [0x88, 0x44, 0x22, 0x11, 0x88, 0x44, 0x22, 0x11],
  DIAGONAL_LINES_L:      [0x11, 0x22, 0x44, 0x88, 0x11, 0x22, 0x44, 0x88],
  
  ROAD_ASPHALT_DARK:     [0x77, 0xDD, 0x77, 0xDD, 0xBB, 0xEE, 0xBB, 0xEE],
  GRASS_TEXTURE_LIGHT:   [0x5A, 0xA5, 0x5A, 0xA5, 0x5A, 0xA5, 0x5A, 0xA5],
  WATER_RIPPLES:         [0x55, 0xAA, 0x33, 0xCC, 0x55, 0xAA, 0x33, 0xCC],
  DIRT_MOTTLED:          [0xA6, 0xDA, 0x69, 0xAD, 0xA6, 0xDA, 0x69, 0xAD]
};

// Terrain type to pattern mapping
const TERRAIN_PATTERNS: Record<string, string> = {
  grass:    'GRASS_TEXTURE_LIGHT',
  grass2:   'GRASS_TEXTURE_LIGHT',
  dirt:     'DIRT_MOTTLED',
  dirt2:    'DIRT_MOTTLED',
  sand:     'SOLID_GRAY_25',
  water:    'WATER_RIPPLES',
  concrete: 'SOLID_GRAY_50',
  asphalt:  'ROAD_ASPHALT_DARK',
  road:     'ROAD_ASPHALT_DARK'
};
```

### 3.2.1 Color Modes

The Playdate uses 1-bit graphics (black and white only). For the web viewer:

**Option A: Authentic 1-bit (recommended for matching Playdate)**
```typescript
const COLOR_CONFIG = {
  foreground: '#000000',  // Black (bit = 1)
  background: '#FFFFFF',  // White (bit = 0)
};
```

**Option B: Soft/retro look**
```typescript
const COLOR_CONFIG = {
  foreground: '#2d2d2d',  // Dark gray
  background: '#f5f5dc',  // Cream/off-white
};
```

**Option C: Colorized patterns (optional enhancement)**
For web, we could tint patterns per terrain type while maintaining the dither effect:
```typescript
const TERRAIN_COLORS: Record<string, { fg: string; bg: string }> = {
  grass:  { fg: '#2d4a2d', bg: '#5a8a5a' },
  water:  { fg: '#1a3a5a', bg: '#4a8aba' },
  dirt:   { fg: '#5a4a3a', bg: '#a89a7a' },
  road:   { fg: '#3a3a3a', bg: '#6a6a6a' },
};

// Create pattern with custom colors
createPattern(patternKey: string, fgColor?: string, bgColor?: string): CanvasPattern | null
```

**Pattern Renderer:**

```typescript
class DitherPatternRenderer {
  private patternCache: Map<string, CanvasPattern> = new Map();
  private ctx: CanvasRenderingContext2D;
  
  // Colors for 1-bit rendering (Playdate style)
  private foregroundColor = '#000000';  // Black
  private backgroundColor = '#FFFFFF';  // White

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  // Convert byte pattern to Canvas pattern
  createPattern(patternKey: string): CanvasPattern | null {
    if (this.patternCache.has(patternKey)) {
      return this.patternCache.get(patternKey)!;
    }

    const bytes = DITHER_PATTERNS[patternKey];
    if (!bytes) return null;

    // Create 8x8 pattern canvas
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 8;
    patternCanvas.height = 8;
    const pCtx = patternCanvas.getContext('2d')!;

    // Draw pattern pixel by pixel
    for (let y = 0; y < 8; y++) {
      const row = bytes[y];
      for (let x = 0; x < 8; x++) {
        // Bit 7 is leftmost pixel, bit 0 is rightmost
        const bit = (row >> (7 - x)) & 1;
        pCtx.fillStyle = bit ? this.foregroundColor : this.backgroundColor;
        pCtx.fillRect(x, y, 1, 1);
      }
    }

    const pattern = this.ctx.createPattern(patternCanvas, 'repeat');
    if (pattern) {
      this.patternCache.set(patternKey, pattern);
    }
    return pattern;
  }

  // Get pattern for a terrain type
  getTerrainPattern(terrainType: string): CanvasPattern | null {
    const patternKey = TERRAIN_PATTERNS[terrainType] || 'SOLID_GRAY_25';
    return this.createPattern(patternKey);
  }

  // Fill a polygon (tile shape) with a pattern
  fillTileWithPattern(corners: number[], pattern: CanvasPattern): void {
    this.ctx.save();
    this.ctx.fillStyle = pattern;
    this.ctx.beginPath();
    this.ctx.moveTo(corners[0], corners[1]);
    this.ctx.lineTo(corners[2], corners[3]);
    this.ctx.lineTo(corners[4], corners[5]);
    this.ctx.lineTo(corners[6], corners[7]);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }
}
```

---

### 3.3 Grid Renderer

Combines projection and dither pattern systems to draw the full grid.

```typescript
class GridRenderer {
  projection: GridProjection;
  patterns: DitherPatternRenderer;
  ctx: CanvasRenderingContext2D;
  
  constructor(
    ctx: CanvasRenderingContext2D,
    config: ProjectionConfig,
    maxGridX: number,
    maxGridZ: number
  ) {
    this.ctx = ctx;
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    
    this.projection = new GridProjection(config, maxGridX, maxGridZ, centerX, centerY);
    this.patterns = new DitherPatternRenderer(ctx);
  }

  drawGrid(
    gameplayTerrain: Record<string, string>,
    tileDitherOverrides: Record<string, string>,
    defaultPatternKey: string,
    gridAngle: number,
    viewAngle: number,
    cameraOffset: { x: number; y: number } = { x: 0, y: 0 }
  ): void {
    this.projection.setAngles(gridAngle, viewAngle);
    
    const defaultPattern = this.patterns.createPattern(defaultPatternKey);
    
    // Draw tiles back-to-front for proper overlap
    for (let z = 0; z < this.projection.maxGridSizeZ; z++) {
      for (let x = 0; x < this.projection.maxGridSizeX; x++) {
        const tileKey = `${x},${z}`;
        
        // Determine which pattern to use
        let pattern: CanvasPattern | null = null;
        
        // Check for explicit dither override
        if (tileDitherOverrides[tileKey]) {
          pattern = this.patterns.createPattern(tileDitherOverrides[tileKey]);
        }
        // Check for terrain-based pattern
        else if (gameplayTerrain[tileKey]) {
          pattern = this.patterns.getTerrainPattern(gameplayTerrain[tileKey]);
        }
        // Fall back to default
        else {
          pattern = defaultPattern;
        }
        
        if (pattern) {
          const corners = this.projection.getTileCorners(x, z, cameraOffset.x, cameraOffset.y);
          this.patterns.fillTileWithPattern(corners, pattern);
        }
      }
    }
  }
}
```

---

## 3.4 Procedural Tile Rendering

Complex tiles like roads, curves, and junctions require multi-pass rendering based on tile definitions from `gridDefinitions.lua`.

### 3.4.1 Tile Definitions Structure

```typescript
interface TileDefinition {
  description: string;
  render_key: string;  // Drawing function to use
  category: string;    // Primary category (road, grass, water, etc.)
  background_category?: string;  // What's under this tile
  params?: Record<string, unknown>;  // Tile-specific parameters
}

// Shared parameters per category
interface SharedParameters {
  default_background_dither_pattern_key: string;
  road: {
    width_fraction: number;           // 0.5 = road takes 50% of tile width
    curve_control_point_factor: number;  // Bezier control point factor
    surface_dither_pattern_key: string;
  };
  grass: { surface_dither_pattern_key: string; };
  water: { surface_dither_pattern_key: string; };
  dirt: { surface_dither_pattern_key: string; };
}

const TILE_DEFINITIONS: Record<string, TileDefinition> = {
  // Basic tiles
  GRASS_PLAIN: { render_key: 'draw_full_tile_pattern', category: 'grass', description: 'Standard grass' },
  DIRT_PLAIN:  { render_key: 'draw_full_tile_pattern', category: 'dirt', description: 'Dirt patch' },
  WATER_PLAIN: { render_key: 'draw_full_tile_pattern', category: 'water', description: 'Water tile' },
  
  // Road tiles
  ROAD_HORIZONTAL: { 
    render_key: 'draw_road_straight', 
    category: 'road',
    background_category: 'grass',
    params: { orientation: 'horizontal' },
    description: 'Horizontal road'
  },
  ROAD_VERTICAL: { 
    render_key: 'draw_road_straight', 
    category: 'road',
    background_category: 'grass',
    params: { orientation: 'vertical' },
    description: 'Vertical road'
  },
  
  // Road curves
  ROAD_CURVE_TOP_LEFT: { 
    render_key: 'draw_road_curve', 
    category: 'road',
    background_category: 'grass',
    params: { corner_type: 'TOP_LEFT' },
    description: 'Curve connecting top to left'
  },
  ROAD_CURVE_TOP_RIGHT: { 
    render_key: 'draw_road_curve', 
    category: 'road',
    background_category: 'grass',
    params: { corner_type: 'TOP_RIGHT' },
    description: 'Curve connecting top to right'
  },
  ROAD_CURVE_BOTTOM_LEFT: { 
    render_key: 'draw_road_curve', 
    category: 'road',
    background_category: 'grass',
    params: { corner_type: 'BOTTOM_LEFT' },
    description: 'Curve connecting bottom to left'
  },
  ROAD_CURVE_BOTTOM_RIGHT: { 
    render_key: 'draw_road_curve', 
    category: 'road',
    background_category: 'grass',
    params: { corner_type: 'BOTTOM_RIGHT' },
    description: 'Curve connecting bottom to right'
  },
  
  // Junctions
  ROAD_T_JUNCTION_NORTH: { 
    render_key: 'draw_road_t_junction', 
    category: 'road',
    background_category: 'grass',
    params: { stem_direction: 'NORTH' },
    description: 'T-junction with stem north'
  },
  ROAD_CROSS_JUNCTION: { 
    render_key: 'draw_road_cross_junction', 
    category: 'road',
    background_category: 'grass',
    description: 'Four-way intersection'
  },
};
```

### 3.4.2 Procedural Tile Renderer

```typescript
class ProceduralTileRenderer {
  private patterns: DitherPatternRenderer;
  private projection: GridProjection;
  private ctx: CanvasRenderingContext2D;
  private sharedParams: SharedParameters;

  constructor(
    ctx: CanvasRenderingContext2D, 
    patterns: DitherPatternRenderer,
    projection: GridProjection,
    sharedParams: SharedParameters
  ) {
    this.ctx = ctx;
    this.patterns = patterns;
    this.projection = projection;
    this.sharedParams = sharedParams;
  }

  // Main render function - routes to specific renderer based on render_key
  renderTile(
    x: number, 
    z: number, 
    tileType: string,
    corners: number[],
    cameraOffset: { x: number; y: number }
  ): void {
    const def = TILE_DEFINITIONS[tileType];
    if (!def) {
      // Fall back to default pattern
      this.drawFullTilePattern(corners, 'SOLID_GRAY_25');
      return;
    }

    switch (def.render_key) {
      case 'draw_full_tile_pattern':
        this.drawFullTilePattern(corners, this.getCategoryPattern(def.category));
        break;
      case 'draw_road_straight':
        this.drawRoadStraight(corners, def);
        break;
      case 'draw_road_curve':
        this.drawRoadCurve(corners, def);
        break;
      case 'draw_road_t_junction':
        this.drawRoadTJunction(corners, def);
        break;
      case 'draw_road_cross_junction':
        this.drawRoadCrossJunction(corners, def);
        break;
      default:
        this.drawFullTilePattern(corners, this.getCategoryPattern(def.category));
    }
  }

  private getCategoryPattern(category: string): string {
    const catParams = this.sharedParams[category as keyof SharedParameters];
    if (catParams && typeof catParams === 'object' && 'surface_dither_pattern_key' in catParams) {
      return catParams.surface_dither_pattern_key;
    }
    return this.sharedParams.default_background_dither_pattern_key;
  }

  // Fill entire tile with single pattern
  private drawFullTilePattern(corners: number[], patternKey: string): void {
    const pattern = this.patterns.createPattern(patternKey);
    if (pattern) {
      this.patterns.fillTileWithPattern(corners, pattern);
    }
  }

  // Draw straight road with background
  private drawRoadStraight(corners: number[], def: TileDefinition): void {
    const [x1, y1, x2, y2, x3, y3, x4, y4] = corners;
    const orientation = def.params?.orientation as string || 'horizontal';
    const widthFraction = this.sharedParams.road.width_fraction;

    // Draw background first
    const bgPattern = this.patterns.createPattern(this.getCategoryPattern(def.background_category || 'grass'));
    if (bgPattern) this.patterns.fillTileWithPattern(corners, bgPattern);

    // Calculate road polygon
    const roadCorners = this.calculateRoadPolygon(corners, orientation, widthFraction);
    
    // Draw road surface
    const roadPattern = this.patterns.createPattern(this.sharedParams.road.surface_dither_pattern_key);
    if (roadPattern) this.patterns.fillTileWithPattern(roadCorners, roadPattern);
  }

  // Calculate road polygon based on orientation and width
  private calculateRoadPolygon(corners: number[], orientation: string, widthFraction: number): number[] {
    const [x1, y1, x2, y2, x3, y3, x4, y4] = corners;
    const offset = (1 - widthFraction) / 2;
    
    if (orientation === 'horizontal') {
      // Road runs from left edge to right edge
      // Interpolate along top and bottom edges
      const topLeft = this.lerp2D(x1, y1, x4, y4, offset);
      const topRight = this.lerp2D(x2, y2, x3, y3, offset);
      const bottomLeft = this.lerp2D(x1, y1, x4, y4, 1 - offset);
      const bottomRight = this.lerp2D(x2, y2, x3, y3, 1 - offset);
      
      return [topLeft.x, topLeft.y, topRight.x, topRight.y, bottomRight.x, bottomRight.y, bottomLeft.x, bottomLeft.y];
    } else {
      // Road runs from top edge to bottom edge
      const leftTop = this.lerp2D(x1, y1, x2, y2, offset);
      const leftBottom = this.lerp2D(x4, y4, x3, y3, offset);
      const rightTop = this.lerp2D(x1, y1, x2, y2, 1 - offset);
      const rightBottom = this.lerp2D(x4, y4, x3, y3, 1 - offset);
      
      return [leftTop.x, leftTop.y, rightTop.x, rightTop.y, rightBottom.x, rightBottom.y, leftBottom.x, leftBottom.y];
    }
  }

  private lerp2D(x1: number, y1: number, x2: number, y2: number, t: number): { x: number; y: number } {
    return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
  }

  // Draw curved road (uses bezier curves)
  private drawRoadCurve(corners: number[], def: TileDefinition): void {
    const [x1, y1, x2, y2, x3, y3, x4, y4] = corners;
    const cornerType = def.params?.corner_type as string || 'TOP_LEFT';
    const widthFraction = this.sharedParams.road.width_fraction;
    const controlFactor = this.sharedParams.road.curve_control_point_factor;

    // Draw background
    const bgPattern = this.patterns.createPattern(this.getCategoryPattern(def.background_category || 'grass'));
    if (bgPattern) this.patterns.fillTileWithPattern(corners, bgPattern);

    // Draw curved road using bezier path
    // Implementation depends on corner_type - each type curves from one edge to an adjacent edge
    const roadPattern = this.patterns.createPattern(this.sharedParams.road.surface_dither_pattern_key);
    if (!roadPattern) return;

    this.ctx.save();
    this.ctx.fillStyle = roadPattern;
    this.ctx.beginPath();
    
    // Example for TOP_LEFT curve (connects top edge to left edge)
    // Detailed bezier implementation would go here based on corner_type
    // Using quadratic or cubic bezier curves to create smooth road curves
    
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawRoadTJunction(corners: number[], def: TileDefinition): void {
    // Draw background + main road + stem road
    // Implementation combines straight road logic with an additional perpendicular segment
  }

  private drawRoadCrossJunction(corners: number[], def: TileDefinition): void {
    // Draw background + two crossing roads
    // Essentially combines horizontal and vertical road rendering
  }
}
```

---

## 3.5 Overlay & Highlight Rendering

The Playdate uses overlay images and highlights on tiles (selection indicators, movement range, attack targets). Port using Canvas composite operations.

### 3.5.1 Overlay Types

```typescript
interface TileOverlay {
  type: 'selection' | 'move_range' | 'attack_range' | 'nest' | 'item';
  tileKey: string;
  imageKey?: string;  // For image-based overlays
}

const OVERLAY_IMAGES: Record<string, string> = {
  nest_player1: '/sprites/nest_p1.png',
  nest_player2: '/sprites/nest_p2.png',
  item_food: '/sprites/item_food.png',
  // etc.
};
```

### 3.5.2 Overlay Renderer

The Playdate uses `kDrawModeNXOR` for overlays - we approximate this with Canvas composite operations:

```typescript
class OverlayRenderer {
  private ctx: CanvasRenderingContext2D;
  private projection: GridProjection;
  private overlayCache: Map<string, HTMLImageElement> = new Map();

  constructor(ctx: CanvasRenderingContext2D, projection: GridProjection) {
    this.ctx = ctx;
    this.projection = projection;
  }

  async loadOverlay(key: string): Promise<HTMLImageElement> {
    if (this.overlayCache.has(key)) return this.overlayCache.get(key)!;
    
    const img = new Image();
    img.src = OVERLAY_IMAGES[key];
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    
    this.overlayCache.set(key, img);
    return img;
  }

  // Draw overlay image scaled and centered within tile bounds
  drawOverlayOnTile(
    corners: number[],
    overlayImage: HTMLImageElement,
    useXorBlend: boolean = true
  ): void {
    const [x1, y1, x2, y2, x3, y3, x4, y4] = corners;
    
    // Calculate bounding box
    const minX = Math.min(x1, x2, x3, x4);
    const maxX = Math.max(x1, x2, x3, x4);
    const minY = Math.min(y1, y2, y3, y4);
    const maxY = Math.max(y1, y2, y3, y4);
    
    const boxWidth = maxX - minX;
    const boxHeight = maxY - minY;
    
    // Scale overlay to fit within tile (90% to leave margin)
    const scaleX = boxWidth / overlayImage.width;
    const scaleY = boxHeight / overlayImage.height;
    const scale = Math.min(scaleX, scaleY) * 0.9;
    
    const scaledWidth = overlayImage.width * scale;
    const scaledHeight = overlayImage.height * scale;
    const posX = minX + (boxWidth - scaledWidth) / 2;
    const posY = minY + (boxHeight - scaledHeight) / 2;
    
    this.ctx.save();
    
    // Create clipping path to tile shape
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.lineTo(x3, y3);
    this.ctx.lineTo(x4, y4);
    this.ctx.closePath();
    this.ctx.clip();
    
    // Use XOR-like composite for Playdate-style overlay
    if (useXorBlend) {
      this.ctx.globalCompositeOperation = 'difference';
    }
    
    this.ctx.drawImage(overlayImage, posX, posY, scaledWidth, scaledHeight);
    this.ctx.restore();
  }

  // Draw highlight overlay (e.g., selection, movement range)
  drawHighlight(
    corners: number[],
    highlightType: 'selection' | 'move_range' | 'attack_range'
  ): void {
    this.ctx.save();
    
    // Different highlight styles
    switch (highlightType) {
      case 'selection':
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3;
        break;
      case 'move_range':
        this.ctx.fillStyle = 'rgba(100, 200, 100, 0.3)';  // Or use dither pattern
        break;
      case 'attack_range':
        this.ctx.fillStyle = 'rgba(200, 100, 100, 0.3)';
        break;
    }
    
    this.ctx.beginPath();
    this.ctx.moveTo(corners[0], corners[1]);
    this.ctx.lineTo(corners[2], corners[3]);
    this.ctx.lineTo(corners[4], corners[5]);
    this.ctx.lineTo(corners[6], corners[7]);
    this.ctx.closePath();
    
    if (highlightType === 'selection') {
      this.ctx.stroke();
    } else {
      this.ctx.fill();
    }
    
    this.ctx.restore();
  }
}
```

### 3.5.3 Playdate NXOR Equivalent

For authentic 1-bit look, we can implement true NXOR (inverts overlapping pixels):

```typescript
function drawWithNXOR(
  ctx: CanvasRenderingContext2D, 
  overlayCanvas: HTMLCanvasElement,
  x: number, 
  y: number
): void {
  // Get current image data
  const mainData = ctx.getImageData(x, y, overlayCanvas.width, overlayCanvas.height);
  const overlayCtx = overlayCanvas.getContext('2d')!;
  const overlayData = overlayCtx.getImageData(0, 0, overlayCanvas.width, overlayCanvas.height);
  
  // NXOR each pixel
  for (let i = 0; i < mainData.data.length; i += 4) {
    const overlayAlpha = overlayData.data[i + 3];
    if (overlayAlpha > 0) {
      // Invert RGB channels where overlay is opaque
      mainData.data[i] = 255 - mainData.data[i];      // R
      mainData.data[i + 1] = 255 - mainData.data[i + 1];  // G
      mainData.data[i + 2] = 255 - mainData.data[i + 2];  // B
    }
  }
  
  ctx.putImageData(mainData, x, y);
}
```

---

## 4. Unit Rendering

### 4.1 Unit Sprites

Units are rendered as PNG sprites positioned at tile centers.

**Unit Type to Sprite Mapping:**

```typescript
interface UnitSpriteConfig {
  imagePath: string;
  // Offsets from battleConfig.lua for proper positioning
  imageOffset: { x: number; y: number };
}

const UNIT_SPRITES: Record<string, UnitSpriteConfig> = {
  BIRD1: { imagePath: '/sprites/birb001.png', imageOffset: { x: 0, y: -8 } },
  BIRD2: { imagePath: '/sprites/birb002.png', imageOffset: { x: 0, y: -8 } },
  BIRD3: { imagePath: '/sprites/birb003.png', imageOffset: { x: 0, y: -10 } },
  // ... more unit types
};
```

### 4.2 Unit Renderer

```typescript
class UnitRenderer {
  private spriteCache: Map<string, HTMLImageElement> = new Map();
  private ctx: CanvasRenderingContext2D;
  private projection: GridProjection;

  constructor(ctx: CanvasRenderingContext2D, projection: GridProjection) {
    this.ctx = ctx;
    this.projection = projection;
  }

  async loadSprite(unitType: string): Promise<HTMLImageElement> {
    if (this.spriteCache.has(unitType)) {
      return this.spriteCache.get(unitType)!;
    }

    const config = UNIT_SPRITES[unitType];
    if (!config) throw new Error(`Unknown unit type: ${unitType}`);

    const img = new Image();
    img.src = config.imagePath;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    this.spriteCache.set(unitType, img);
    return img;
  }

  drawUnit(
    unit: { unitId: string; type: string; x: number; y: number; hp: number; owner: string },
    cameraOffset: { x: number; y: number } = { x: 0, y: 0 }
  ): void {
    const sprite = this.spriteCache.get(unit.type);
    if (!sprite) return;

    const config = UNIT_SPRITES[unit.type];
    const tileCenter = this.projection.getTileCenter(unit.x, unit.y, cameraOffset.x, cameraOffset.y);
    
    // Apply sprite offset and center the sprite
    const drawX = tileCenter.x + config.imageOffset.x - sprite.width / 2;
    const drawY = tileCenter.y + config.imageOffset.y - sprite.height / 2;
    
    this.ctx.drawImage(sprite, drawX, drawY);
    
    // Optional: Draw HP indicator
    this.drawHPIndicator(tileCenter.x, tileCenter.y + 15, unit.hp);
  }

  private drawHPIndicator(x: number, y: number, hp: number): void {
    this.ctx.fillStyle = '#000000';
    this.ctx.font = '10px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${hp}`, x, y);
  }

  drawUnits(
    units: Array<{ unitId: string; type: string; x: number; y: number; hp: number; owner: string }>,
    cameraOffset: { x: number; y: number } = { x: 0, y: 0 }
  ): void {
    // Sort units by Y position for proper overlap (back to front)
    const sorted = [...units].sort((a, b) => a.y - b.y);
    for (const unit of sorted) {
      this.drawUnit(unit, cameraOffset);
    }
  }
}
```

---

## 5. Playback System

### 5.1 Game State Reconstruction

Build game state from initial setup + actions, or use `gameState` snapshots.

```typescript
interface GameState {
  turnNumber: number;
  units: Array<{
    unitId: string;
    type: string;
    x: number;
    y: number;
    hp: number;
    owner: string;
  }>;
  currentPlayerIndex: number;
  winner: string | null;
}

class ReplayController {
  private battle: Battle;
  private turns: Turn[];
  private currentTurnIndex: number = -1; // -1 = initial state
  private currentState: GameState;
  
  constructor(battle: Battle, turns: Turn[]) {
    this.battle = battle;
    this.turns = turns;
    this.currentState = this.getInitialState();
  }

  private getInitialState(): GameState {
    // Use mapData.unitPlacement for initial positions
    const units = this.battle.mapData.unitPlacement.map((placement, index) => ({
      unitId: `${placement.player === 2 ? this.battle.player2DeviceId : this.battle.player1DeviceId}_u${index}`,
      type: placement.birdType || 'BIRD1',
      x: placement.gridX,
      y: placement.gridZ,
      hp: 10,
      owner: placement.player === 2 ? this.battle.player2DeviceId : this.battle.player1DeviceId
    }));

    return {
      turnNumber: 0,
      units,
      currentPlayerIndex: 0,
      winner: null
    };
  }

  getStateAtTurn(turnIndex: number): GameState {
    if (turnIndex < 0) {
      return this.getInitialState();
    }

    const turn = this.turns[turnIndex];
    if (turn.gameState?.units) {
      // Use the snapshot if available
      return {
        turnNumber: turn.turnNumber,
        units: turn.gameState.units,
        currentPlayerIndex: turnIndex % 2,
        winner: turn.gameState.winner || null
      };
    }

    // Otherwise, apply actions to previous state
    const prevState = this.getStateAtTurn(turnIndex - 1);
    return this.applyTurn(prevState, turn);
  }

  private applyTurn(state: GameState, turn: Turn): GameState {
    const newUnits = [...state.units.map(u => ({ ...u }))];

    for (const action of turn.actions) {
      switch (action.type) {
        case 'move':
          const movingUnit = newUnits.find(u => u.unitId === action.unitId);
          if (movingUnit && action.to) {
            movingUnit.x = action.to.x;
            movingUnit.y = action.to.y;
          }
          break;

        case 'attack':
          // Attack damage would need to be calculated or stored in action.data
          if (action.data?.damage && action.targetId) {
            const target = newUnits.find(u => u.unitId === action.targetId);
            if (target) {
              target.hp -= action.data.damage as number;
              if (target.hp <= 0) {
                const idx = newUnits.findIndex(u => u.unitId === action.targetId);
                if (idx !== -1) newUnits.splice(idx, 1);
              }
            }
          }
          break;

        case 'build':
          if (action.data) {
            newUnits.push({
              unitId: action.data.unitId as string,
              type: action.data.unitType as string,
              x: (action.to?.x || 0),
              y: (action.to?.y || 0),
              hp: 10,
              owner: turn.deviceId
            });
          }
          break;
      }
    }

    return {
      turnNumber: turn.turnNumber,
      units: newUnits,
      currentPlayerIndex: (state.currentPlayerIndex + 1) % 2,
      winner: null
    };
  }

  // Playback controls
  getTotalTurns(): number {
    return this.turns.length;
  }

  getCurrentTurnIndex(): number {
    return this.currentTurnIndex;
  }

  goToTurn(index: number): GameState {
    this.currentTurnIndex = Math.max(-1, Math.min(index, this.turns.length - 1));
    this.currentState = this.getStateAtTurn(this.currentTurnIndex);
    return this.currentState;
  }

  nextTurn(): GameState {
    return this.goToTurn(this.currentTurnIndex + 1);
  }

  prevTurn(): GameState {
    return this.goToTurn(this.currentTurnIndex - 1);
  }

  // Get actions for current turn (for animation)
  getCurrentTurnActions(): TurnAction[] {
    if (this.currentTurnIndex < 0 || this.currentTurnIndex >= this.turns.length) {
      return [];
    }
    return this.turns[this.currentTurnIndex].actions;
  }
}
```

### 5.2 Animation System

Animate unit movements and attacks between states.

```typescript
interface Animation {
  type: 'move' | 'attack' | 'damage' | 'death';
  unitId: string;
  startTime: number;
  duration: number;
  data: {
    from?: { x: number; y: number };
    to?: { x: number; y: number };
    targetId?: string;
    damage?: number;
  };
}

class AnimationController {
  private animations: Animation[] = [];
  private animationDuration = 300; // ms per animation

  queueActionsForTurn(actions: TurnAction[], prevState: GameState): void {
    this.animations = [];
    let delay = 0;

    for (const action of actions) {
      if (action.type === 'move' && action.from && action.to) {
        this.animations.push({
          type: 'move',
          unitId: action.unitId!,
          startTime: delay,
          duration: this.animationDuration,
          data: { from: action.from, to: action.to }
        });
        delay += this.animationDuration;
      }
      
      if (action.type === 'attack' && action.unitId && action.targetId) {
        this.animations.push({
          type: 'attack',
          unitId: action.unitId,
          startTime: delay,
          duration: this.animationDuration,
          data: { targetId: action.targetId }
        });
        delay += this.animationDuration / 2;
        
        // Damage flash on target
        this.animations.push({
          type: 'damage',
          unitId: action.targetId,
          startTime: delay,
          duration: this.animationDuration / 2,
          data: { damage: action.data?.damage as number || 0 }
        });
        delay += this.animationDuration / 2;
      }
    }
  }

  // Returns interpolated unit positions at given time
  getAnimatedPositions(
    units: GameState['units'],
    elapsedMs: number
  ): Map<string, { x: number; y: number; flash?: boolean }> {
    const positions = new Map<string, { x: number; y: number; flash?: boolean }>();

    // Start with current positions
    for (const unit of units) {
      positions.set(unit.unitId, { x: unit.x, y: unit.y });
    }

    // Apply active animations
    for (const anim of this.animations) {
      if (elapsedMs < anim.startTime) continue;
      if (elapsedMs > anim.startTime + anim.duration) continue;

      const progress = (elapsedMs - anim.startTime) / anim.duration;
      const t = this.easeInOutQuad(progress);

      if (anim.type === 'move' && anim.data.from && anim.data.to) {
        positions.set(anim.unitId, {
          x: anim.data.from.x + (anim.data.to.x - anim.data.from.x) * t,
          y: anim.data.from.y + (anim.data.to.y - anim.data.from.y) * t
        });
      }

      if (anim.type === 'damage') {
        const current = positions.get(anim.unitId);
        if (current) {
          positions.set(anim.unitId, { ...current, flash: true });
        }
      }
    }

    return positions;
  }

  getTotalDuration(): number {
    if (this.animations.length === 0) return 0;
    const last = this.animations[this.animations.length - 1];
    return last.startTime + last.duration;
  }

  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}
```

### 5.2.1 Grid-Space vs Screen-Space Interpolation

**Critical Design Decision:** Animate in **grid space**, then project to screen space.

```typescript
// CORRECT: Interpolate in grid coordinates, then project
function getAnimatedScreenPosition(
  projection: GridProjection,
  from: { x: number; y: number },
  to: { x: number; y: number },
  progress: number,  // 0 to 1
  cameraOffset: { x: number; y: number }
): { x: number; y: number } {
  // Interpolate grid position
  const gridX = from.x + (to.x - from.x) * progress;
  const gridY = from.y + (to.y - from.y) * progress;
  
  // Project interpolated grid position to screen
  return projection.getTileCenter(gridX, gridY, cameraOffset.x, cameraOffset.y);
}

// WRONG: Interpolating in screen space would cause non-linear motion
// due to perspective projection
```

This ensures smooth, linear movement along the grid even with perspective distortion.

### 5.2.2 Multi-Action Turn Timing Strategy

A turn can contain multiple actions. Use sequential timing with configurable delays:

```typescript
interface TimingConfig {
  moveDuration: number;       // 300ms - time for unit to move one tile
  attackDuration: number;     // 200ms - attack animation
  damageDuration: number;     // 150ms - damage flash
  deathDuration: number;      // 400ms - unit removal animation
  actionGap: number;          // 50ms - pause between sequential actions
}

const DEFAULT_TIMING: TimingConfig = {
  moveDuration: 300,
  attackDuration: 200,
  damageDuration: 150,
  deathDuration: 400,
  actionGap: 50
};

// Build animation timeline from actions
function buildTurnTimeline(
  actions: TurnAction[],
  timing: TimingConfig
): Animation[] {
  const timeline: Animation[] = [];
  let currentTime = 0;
  
  for (const action of actions) {
    if (action.type === 'end_turn') continue;
    
    switch (action.type) {
      case 'move':
        // Multi-tile moves could be broken into segments
        const distance = Math.abs(action.to!.x - action.from!.x) + 
                        Math.abs(action.to!.y - action.from!.y);
        const moveDuration = timing.moveDuration * Math.max(1, distance);
        
        timeline.push({
          type: 'move',
          unitId: action.unitId!,
          startTime: currentTime,
          duration: moveDuration,
          data: { from: action.from, to: action.to }
        });
        currentTime += moveDuration + timing.actionGap;
        break;
        
      case 'attack':
        // Attack animation
        timeline.push({
          type: 'attack',
          unitId: action.unitId!,
          startTime: currentTime,
          duration: timing.attackDuration,
          data: { targetId: action.targetId }
        });
        currentTime += timing.attackDuration;
        
        // Damage on target (overlaps slightly with attack end)
        timeline.push({
          type: 'damage',
          unitId: action.targetId!,
          startTime: currentTime - 50,  // Overlap
          duration: timing.damageDuration,
          data: { damage: (action.data?.damage as number) || 0 }
        });
        currentTime += timing.damageDuration + timing.actionGap;
        break;
    }
  }
  
  return timeline;
}
```

### 5.2.3 Render Loop Integration

```typescript
class ReplayEngine {
  private animController: AnimationController;
  private replayController: ReplayController;
  private projection: GridProjection;
  private ctx: CanvasRenderingContext2D;
  
  private animationStartTime: number = 0;
  private isAnimating: boolean = false;

  startTurnAnimation(): void {
    const prevState = this.replayController.getStateAtTurn(
      this.replayController.getCurrentTurnIndex() - 1
    );
    const actions = this.replayController.getCurrentTurnActions();
    
    this.animController.queueActionsForTurn(actions, prevState);
    this.animationStartTime = performance.now();
    this.isAnimating = true;
    this.animate();
  }

  private animate = (): void => {
    if (!this.isAnimating) return;
    
    const elapsed = performance.now() - this.animationStartTime;
    const totalDuration = this.animController.getTotalDuration();
    
    if (elapsed >= totalDuration) {
      // Animation complete - render final state
      this.isAnimating = false;
      this.render(this.replayController.goToTurn(
        this.replayController.getCurrentTurnIndex()
      ));
      return;
    }
    
    // Get previous state as base
    const prevState = this.replayController.getStateAtTurn(
      this.replayController.getCurrentTurnIndex() - 1
    );
    
    // Get animated positions
    const animatedPositions = this.animController.getAnimatedPositions(
      prevState.units,
      elapsed
    );
    
    // Render with interpolated positions
    this.renderWithAnimatedPositions(prevState.units, animatedPositions);
    
    requestAnimationFrame(this.animate);
  };

  private renderWithAnimatedPositions(
    units: GameState['units'],
    positions: Map<string, { x: number; y: number; flash?: boolean }>
  ): void {
    // Clear canvas
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    
    // Draw grid (cached/static)
    this.drawGrid();
    
    // Draw units at interpolated positions
    for (const unit of units) {
      const pos = positions.get(unit.unitId);
      if (!pos) continue;
      
      // Project grid position to screen
      const screenPos = this.projection.getTileCenter(pos.x, pos.y, 0, 0);
      
      // Draw unit sprite at screen position
      this.drawUnitAtScreenPos(unit, screenPos, pos.flash);
    }
  }
}
```

---

## 6. UI Components

### 6.1 Replay Page Structure

```
/replay/[battleId]
├── Header
│   ├── Battle title / ID
│   ├── Player 1 info
│   └── Player 2 info
├── Canvas Container
│   └── <canvas> (main render target)
├── Controls Bar
│   ├── [<<] First turn
│   ├── [<] Previous turn
│   ├── [Play/Pause]
│   ├── [>] Next turn
│   ├── [>>] Last turn
│   ├── Turn slider / scrubber
│   ├── Speed selector (0.5x, 1x, 2x)
│   └── Turn counter: "Turn 5 / 12"
└── Info Panel (optional)
    ├── Current player indicator
    ├── Action log for current turn
    └── Winner announcement (if completed)
```

### 6.2 Control State

```typescript
interface ReplayUIState {
  isPlaying: boolean;
  playbackSpeed: number;  // 0.5, 1, 2
  currentTurn: number;
  totalTurns: number;
  isAnimating: boolean;
}
```

---

## 7. API Endpoints (New)

### 7.1 Map Storage Endpoint

```
GET /api/maps/[mapId]
```

Returns the full map data including grid dimensions, terrain, and dither overrides.

### 7.2 Map Upload Endpoint (Admin)

```
POST /api/maps
Content-Type: application/json

{
  "mapId": "map001",
  "name": "Grassland Skirmish",
  "grid": { "maxGridSizeX": 12, "maxGridSizeZ": 12 },
  "gameplayTerrain": { ... },
  "tileDitherPatternOverrides": { ... },
  "unitPlacement": [...],
  "itemPlacement": [...],
  "defaultDitherPatternKey": "GRASS_TEXTURE_LIGHT"
}
```

---

## 8. File Structure

```
/app
  /replay
    /[battleId]
      page.tsx              # Replay viewer page
/lib
  /replay
    GridProjection.ts       # Projection math
    DitherPatterns.ts       # Pattern definitions
    DitherRenderer.ts       # Canvas pattern renderer
    GridRenderer.ts         # Combined grid drawer
    UnitRenderer.ts         # Unit sprite rendering
    ReplayController.ts     # State reconstruction
    AnimationController.ts  # Movement/attack animations
/components
  /replay
    ReplayCanvas.tsx        # Main canvas component
    ReplayControls.tsx      # Playback control bar
    ReplayHeader.tsx        # Battle info header
/public
  /sprites
    birb001.png
    birb002.png
    ...
```

---

## 9. Implementation Notes

### 9.1 Canvas Sizing

- Default canvas size: 800x600 or responsive to container
- Consider devicePixelRatio for crisp rendering on high-DPI displays
- Maintain aspect ratio when resizing

### 9.2 Performance Considerations

- Cache projection calculations for static views
- Pre-render the base grid to an offscreen canvas (only re-render when camera moves)
- Use requestAnimationFrame for smooth animations
- Limit pattern cache size

### 9.3 Color Theme

For authentic Playdate look:
- Background: `#FFFFFF` (white)
- Foreground: `#000000` (black)
- Optional: slight off-white/cream for softer look

For web adaptation (optional):
- Could introduce subtle color tinting for terrain types
- Player-colored unit tints (e.g., blue vs red team indicators)

---

## 10. Future Enhancements

- **Camera controls**: Pan/zoom to focus on action
- **Fog of war**: Show only what each player could see at the time
- **Export**: Generate GIF/video of the replay
- **Sharing**: Public replay URLs
- **Commentary**: Add annotations/notes to specific turns
- **Statistics**: Post-game stats overlay (damage dealt, units lost, etc.)
