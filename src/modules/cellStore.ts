import { CellEdgeStyle, CellMapData, CellPaletteColor, MapFogConfig } from '../types';

export const CHUNK_SIZE = 32;

export interface SerializedChunk {
  /** RLE encoded cells (1024 palette indices) */
  cells?: string;
  /** Horizontal edges: "x,y:styleId;..." */
  hEdges?: string;
  /** Vertical edges: "x,y:styleId;..." */
  vEdges?: string;
  /** RLE encoded fog (1024 states: 0=fogged, 1=revealed) */
  fog?: string;
}

export interface SerializedMapFile {
  version: number;
  mapId: string;
  chunks: Record<string, SerializedChunk>;
}

export interface ChunkMemoryData {
  chunkX: number;
  chunkY: number;
  cells: Uint16Array; // 1024 elements (0 = transparent/empty, 1..N = 1-based palette index)
  hEdges: Map<string, string>; // "localX,localY" -> edgeStyleId
  vEdges: Map<string, string>; // "localX,localY" -> edgeStyleId
  fog: Uint8Array; // 1024 elements (0 = fogged, 1 = revealed)
  isDirty: boolean;
  canvasCache?: HTMLCanvasElement;
  fogCanvasCache?: HTMLCanvasElement;
}

/**
 * Encodes a numeric array using Run-Length Encoding (RLE).
 * E.g. [0, 0, 0, 1, 1, 0] -> "3x0,2x1,1x0"
 */
export function encodeRLE(data: Uint8Array | Uint16Array | number[]): string {
  if (!data || data.length === 0) return '';
  const parts: string[] = [];
  let currentVal = data[0];
  let count = 1;

  for (let i = 1; i < data.length; i++) {
    if (data[i] === currentVal) {
      count++;
    } else {
      parts.push(`${count}x${currentVal}`);
      currentVal = data[i];
      count = 1;
    }
  }
  parts.push(`${count}x${currentVal}`);
  return parts.join(',');
}

/**
 * Decodes an RLE string into a Uint16Array of specified length.
 */
export function decodeRLE(rle: string, length: number = 1024): Uint16Array {
  const result = new Uint16Array(length);
  if (!rle) return result;

  let offset = 0;
  const parts = rle.split(',');
  for (const part of parts) {
    if (!part) continue;
    const [countStr, valStr] = part.split('x');
    const count = parseInt(countStr, 10) || 0;
    const val = parseInt(valStr, 10) || 0;
    for (let i = 0; i < count && offset < length; i++) {
      result[offset++] = val;
    }
  }
  return result;
}

/**
 * Decodes an RLE string into a Uint8Array of specified length.
 */
export function decodeRLE8(rle: string, length: number = 1024): Uint8Array {
  const result = new Uint8Array(length);
  if (!rle) return result;

  let offset = 0;
  const parts = rle.split(',');
  for (const part of parts) {
    if (!part) continue;
    const [countStr, valStr] = part.split('x');
    const count = parseInt(countStr, 10) || 0;
    const val = parseInt(valStr, 10) || 0;
    for (let i = 0; i < count && offset < length; i++) {
      result[offset++] = val;
    }
  }
  return result;
}

function edgesToString(edgeMap: Map<string, string>): string {
  const entries: string[] = [];
  edgeMap.forEach((styleId, key) => {
    entries.push(`${key}:${styleId}`);
  });
  return entries.join(';');
}

function stringToEdges(str: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!str) return map;
  const entries = str.split(';');
  for (const entry of entries) {
    if (!entry) continue;
    const [key, styleId] = entry.split(':');
    if (key && styleId) {
      map.set(key, styleId);
    }
  }
  return map;
}

export class CellStore {
  private mapId: string;
  private chunks: Map<string, ChunkMemoryData> = new Map();
  private saveTimeout: any = null;
  private plugin: any;
  private isSaving: boolean = false;
  private pendingSave: boolean = false;

  constructor(mapId: string, plugin: any) {
    this.mapId = mapId;
    this.plugin = plugin;
  }

  public getMapId(): string {
    return this.mapId;
  }

  public static getChunkKey(chunkX: number, chunkY: number): string {
    return `${chunkX},${chunkY}`;
  }

  public getOrCreateChunk(chunkX: number, chunkY: number): ChunkMemoryData {
    const key = CellStore.getChunkKey(chunkX, chunkY);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = {
        chunkX,
        chunkY,
        cells: new Uint16Array(CHUNK_SIZE * CHUNK_SIZE),
        hEdges: new Map(),
        vEdges: new Map(),
        fog: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE), // 0 = fogged
        isDirty: false,
      };
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  public getChunk(chunkX: number, chunkY: number): ChunkMemoryData | undefined {
    return this.chunks.get(CellStore.getChunkKey(chunkX, chunkY));
  }

  public getAllChunks(): IterableIterator<ChunkMemoryData> {
    return this.chunks.values();
  }

  /**
   * Gets the color index (1-based palette index, 0=empty) for a given global cell.
   */
  public getCell(cellX: number, cellY: number): number {
    const chunkX = Math.floor(cellX / CHUNK_SIZE);
    const chunkY = Math.floor(cellY / CHUNK_SIZE);
    const chunk = this.chunks.get(CellStore.getChunkKey(chunkX, chunkY));
    if (!chunk) return 0;

    const lx = ((cellX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((cellY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.cells[ly * CHUNK_SIZE + lx];
  }

  /**
   * Sets color index (1-based palette index, 0=empty) for a global cell.
   */
  public setCell(cellX: number, cellY: number, colorIndex: number): boolean {
    const chunkX = Math.floor(cellX / CHUNK_SIZE);
    const chunkY = Math.floor(cellY / CHUNK_SIZE);
    const chunk = this.getOrCreateChunk(chunkX, chunkY);

    const lx = ((cellX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((cellY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const idx = ly * CHUNK_SIZE + lx;

    if (chunk.cells[idx] === colorIndex) return false;

    chunk.cells[idx] = colorIndex;
    chunk.isDirty = true;
    chunk.canvasCache = undefined; // Invalidate chunk render cache
    this.scheduleSave();
    return true;
  }

  /**
   * Gets the horizontal edge style ID above cell (cellX, cellY).
   */
  public getHorizontalEdge(cellX: number, cellY: number): string | undefined {
    const chunkX = Math.floor(cellX / CHUNK_SIZE);
    const chunkY = Math.floor(cellY / CHUNK_SIZE);
    const chunk = this.chunks.get(CellStore.getChunkKey(chunkX, chunkY));
    if (!chunk) return undefined;
    const lx = ((cellX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((cellY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.hEdges.get(`${lx},${ly}`);
  }

  /**
   * Sets the horizontal edge style ID above cell (cellX, cellY). Pass undefined to remove.
   */
  public setHorizontalEdge(cellX: number, cellY: number, styleId: string | undefined): boolean {
    const chunkX = Math.floor(cellX / CHUNK_SIZE);
    const chunkY = Math.floor(cellY / CHUNK_SIZE);
    const chunk = this.getOrCreateChunk(chunkX, chunkY);
    const lx = ((cellX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((cellY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const key = `${lx},${ly}`;

    const current = chunk.hEdges.get(key);
    if (current === styleId) return false;

    if (styleId) {
      chunk.hEdges.set(key, styleId);
    } else {
      chunk.hEdges.delete(key);
    }
    chunk.isDirty = true;
    chunk.canvasCache = undefined;
    this.scheduleSave();
    return true;
  }

  /**
   * Gets the vertical edge style ID to the left of cell (cellX, cellY).
   */
  public getVerticalEdge(cellX: number, cellY: number): string | undefined {
    const chunkX = Math.floor(cellX / CHUNK_SIZE);
    const chunkY = Math.floor(cellY / CHUNK_SIZE);
    const chunk = this.chunks.get(CellStore.getChunkKey(chunkX, chunkY));
    if (!chunk) return undefined;
    const lx = ((cellX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((cellY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.vEdges.get(`${lx},${ly}`);
  }

  /**
   * Sets the vertical edge style ID to the left of cell (cellX, cellY).
   */
  public setVerticalEdge(cellX: number, cellY: number, styleId: string | undefined): boolean {
    const chunkX = Math.floor(cellX / CHUNK_SIZE);
    const chunkY = Math.floor(cellY / CHUNK_SIZE);
    const chunk = this.getOrCreateChunk(chunkX, chunkY);
    const lx = ((cellX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((cellY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const key = `${lx},${ly}`;

    const current = chunk.vEdges.get(key);
    if (current === styleId) return false;

    if (styleId) {
      chunk.vEdges.set(key, styleId);
    } else {
      chunk.vEdges.delete(key);
    }
    chunk.isDirty = true;
    chunk.canvasCache = undefined;
    this.scheduleSave();
    return true;
  }

  /**
   * Gets fog status of cell (0 = fogged, 1 = revealed).
   */
  public getFog(cellX: number, cellY: number): number {
    const chunkX = Math.floor(cellX / CHUNK_SIZE);
    const chunkY = Math.floor(cellY / CHUNK_SIZE);
    const chunk = this.chunks.get(CellStore.getChunkKey(chunkX, chunkY));
    if (!chunk) return 0; // Default fogged

    const lx = ((cellX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((cellY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.fog[ly * CHUNK_SIZE + lx];
  }

  /**
   * Sets fog status of cell (0 = fogged, 1 = revealed).
   */
  public setFog(cellX: number, cellY: number, revealed: boolean): boolean {
    const val = revealed ? 1 : 0;
    const chunkX = Math.floor(cellX / CHUNK_SIZE);
    const chunkY = Math.floor(cellY / CHUNK_SIZE);
    const chunk = this.getOrCreateChunk(chunkX, chunkY);

    const lx = ((cellX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((cellY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const idx = ly * CHUNK_SIZE + lx;

    if (chunk.fog[idx] === val) return false;

    chunk.fog[idx] = val;
    chunk.isDirty = true;
    chunk.fogCanvasCache = undefined;
    this.scheduleSave();
    return true;
  }

  /**
   * Reveals all cells within a circular radius.
   */
  public revealRadius(centerCellX: number, centerCellY: number, radiusCells: number): Array<{ cellX: number; cellY: number; before: number }> {
    const changes: Array<{ cellX: number; cellY: number; before: number }> = [];
    const r2 = radiusCells * radiusCells;
    for (let dy = -radiusCells; dy <= radiusCells; dy++) {
      for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        if (dx * dx + dy * dy <= r2) {
          const cx = centerCellX + dx;
          const cy = centerCellY + dy;
          const before = this.getFog(cx, cy);
          if (before === 0) {
            this.setFog(cx, cy, true);
            changes.push({ cellX: cx, cellY: cy, before: 0 });
          }
        }
      }
    }
    return changes;
  }

  /**
   * Hides / fogs all cells within a circular radius.
   */
  public hideRadius(centerCellX: number, centerCellY: number, radiusCells: number): Array<{ cellX: number; cellY: number; before: number }> {
    const changes: Array<{ cellX: number; cellY: number; before: number }> = [];
    const r2 = radiusCells * radiusCells;
    for (let dy = -radiusCells; dy <= radiusCells; dy++) {
      for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        if (dx * dx + dy * dy <= r2) {
          const cx = centerCellX + dx;
          const cy = centerCellY + dy;
          const before = this.getFog(cx, cy);
          if (before === 1) {
            this.setFog(cx, cy, false);
            changes.push({ cellX: cx, cellY: cy, before: 1 });
          }
        }
      }
    }
    return changes;
  }

  /**
   * Reveals all known chunks on the map.
   */
  public revealAll(): void {
    for (const chunk of this.chunks.values()) {
      chunk.fog.fill(1);
      chunk.isDirty = true;
      chunk.fogCanvasCache = undefined;
    }
    this.scheduleSave();
  }

  /**
   * Hides all known chunks on the map.
   */
  public hideAll(): void {
    for (const chunk of this.chunks.values()) {
      chunk.fog.fill(0);
      chunk.isDirty = true;
      chunk.fogCanvasCache = undefined;
    }
    this.scheduleSave();
  }

  /**
   * Clears all cells and edges in the store.
   */
  public clearAll(): void {
    this.chunks.clear();
    this.scheduleSave();
  }

  /**
   * Counts how many cells use a given 1-based palette index.
   */
  public countCellsWithColorIndex(colorIndex: number): number {
    let count = 0;
    for (const chunk of this.chunks.values()) {
      for (let i = 0; i < chunk.cells.length; i++) {
        if (chunk.cells[i] === colorIndex) count++;
      }
    }
    return count;
  }

  /**
   * Counts how many edges use a given edge style ID.
   */
  public countEdgesWithStyle(styleId: string): number {
    let count = 0;
    for (const chunk of this.chunks.values()) {
      for (const id of chunk.hEdges.values()) {
        if (id === styleId) count++;
      }
      for (const id of chunk.vEdges.values()) {
        if (id === styleId) count++;
      }
    }
    return count;
  }

  /**
   * Finds all vision blocking edges for line of sight calculations.
   */
  public getVisionBlockingEdges(edgeStyles: CellEdgeStyle[], cellSizePx: number): Array<{ x1: number; y1: number; x2: number; y2: number }> {
    const blockers: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const blockingStyles = new Set(edgeStyles.filter((s) => s.blocksVision).map((s) => s.id));
    if (blockingStyles.size === 0) return blockers;

    for (const chunk of this.chunks.values()) {
      const baseX = chunk.chunkX * CHUNK_SIZE * cellSizePx;
      const baseY = chunk.chunkY * CHUNK_SIZE * cellSizePx;

      // Horizontal edges
      chunk.hEdges.forEach((styleId, key) => {
        if (blockingStyles.has(styleId)) {
          const [lxStr, lyStr] = key.split(',');
          const lx = parseInt(lxStr, 10);
          const ly = parseInt(lyStr, 10);
          const x1 = baseX + lx * cellSizePx;
          const y1 = baseY + ly * cellSizePx;
          const x2 = x1 + cellSizePx;
          const y2 = y1;
          blockers.push({ x1, y1, x2, y2 });
        }
      });

      // Vertical edges
      chunk.vEdges.forEach((styleId, key) => {
        if (blockingStyles.has(styleId)) {
          const [lxStr, lyStr] = key.split(',');
          const lx = parseInt(lxStr, 10);
          const ly = parseInt(lyStr, 10);
          const x1 = baseX + lx * cellSizePx;
          const y1 = baseY + ly * cellSizePx;
          const x2 = x1;
          const y2 = y1 + cellSizePx;
          blockers.push({ x1, y1, x2, y2 });
        }
      });
    }

    return blockers;
  }

  /**
   * File path for this map's cell data.
   */
  public getFilePath(): string {
    const basePath = this.plugin?.manifest?.dir || '.obsidian/plugins/dino-tabletop-engine';
    return `${basePath}/maps/${this.mapId}.json`;
  }

  /**
   * Schedules a debounced disk save (500ms).
   */
  public scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveToDisk();
    }, 500);
  }

  /**
   * Immediately saves any modified chunks to disk.
   */
  public async saveToDisk(): Promise<void> {
    if (!this.plugin?.app?.vault?.adapter) return;
    if (this.isSaving) {
      this.pendingSave = true;
      return;
    }

    this.isSaving = true;
    try {
      const adapter = this.plugin.app.vault.adapter;
      const filePath = this.getFilePath();
      const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));

      const serialized: SerializedMapFile = {
        version: 1,
        mapId: this.mapId,
        chunks: {},
      };

      for (const [key, chunk] of this.chunks.entries()) {
        const hasCells = chunk.cells.some((v) => v !== 0);
        const hasHEdges = chunk.hEdges.size > 0;
        const hasVEdges = chunk.vEdges.size > 0;
        const hasFog = chunk.fog.some((v) => v !== 0);

        if (!hasCells && !hasHEdges && !hasVEdges && !hasFog) {
          continue; // Don't persist empty chunks
        }

        const chunkData: SerializedChunk = {};
        if (hasCells) chunkData.cells = encodeRLE(chunk.cells);
        if (hasHEdges) chunkData.hEdges = edgesToString(chunk.hEdges);
        if (hasVEdges) chunkData.vEdges = edgesToString(chunk.vEdges);
        if (hasFog) chunkData.fog = encodeRLE(chunk.fog);

        serialized.chunks[key] = chunkData;
        chunk.isDirty = false;
      }

      if (!(await adapter.exists(dirPath))) {
        await adapter.mkdir(dirPath);
      }

      await adapter.write(filePath, JSON.stringify(serialized));
    } catch (e) {
      console.error(`[DTE] Error saving cell map data for ${this.mapId}:`, e);
    } finally {
      this.isSaving = false;
      if (this.pendingSave) {
        this.pendingSave = false;
        this.saveToDisk();
      }
    }
  }

  /**
   * Loads map chunks from disk.
   */
  public async loadFromDisk(): Promise<void> {
    if (!this.plugin?.app?.vault?.adapter) return;
    try {
      const adapter = this.plugin.app.vault.adapter;
      const filePath = this.getFilePath();

      if (!(await adapter.exists(filePath))) {
        return;
      }

      const raw = await adapter.read(filePath);
      const data: SerializedMapFile = JSON.parse(raw);

      this.chunks.clear();

      if (data && data.chunks) {
        for (const [key, chunkData] of Object.entries(data.chunks)) {
          const [cxStr, cyStr] = key.split(',');
          const chunkX = parseInt(cxStr, 10);
          const chunkY = parseInt(cyStr, 10);

          const chunk: ChunkMemoryData = {
            chunkX,
            chunkY,
            cells: chunkData.cells ? decodeRLE(chunkData.cells) : new Uint16Array(CHUNK_SIZE * CHUNK_SIZE),
            hEdges: stringToEdges(chunkData.hEdges),
            vEdges: stringToEdges(chunkData.vEdges),
            fog: chunkData.fog ? decodeRLE8(chunkData.fog) : new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
            isDirty: false,
          };
          this.chunks.set(key, chunk);
        }
      }
    } catch (e) {
      console.error(`[DTE] Error loading cell map data for ${this.mapId}:`, e);
    }
  }

  /**
   * Renders the visible chunks onto the destination canvas context.
   */
  public renderToCanvas(
    ctx: CanvasRenderingContext2D,
    cellMap: CellMapData,
    viewportMinX: number,
    viewportMinY: number,
    viewportMaxX: number,
    viewportMaxY: number,
    fogConfig?: MapFogConfig | null,
    isPlayerMode: boolean = false
  ): void {
    const cellSize = cellMap.cellSizePx > 0 ? cellMap.cellSizePx : 48;
    const chunkPx = CHUNK_SIZE * cellSize;

    const minChunkX = Math.floor(viewportMinX / chunkPx);
    const minChunkY = Math.floor(viewportMinY / chunkPx);
    const maxChunkX = Math.floor(viewportMaxX / chunkPx);
    const maxChunkY = Math.floor(viewportMaxY / chunkPx);

    // Build color map lookup for fast palette access
    const palette = cellMap.palette || [];
    const edgeStylesMap = new Map<string, CellEdgeStyle>();
    (cellMap.edgeStyles || []).forEach((s) => edgeStylesMap.set(s.id, s));

    for (let cy = minChunkY; cy <= maxChunkY; cy++) {
      for (let cx = minChunkX; cx <= maxChunkX; cx++) {
        const chunk = this.getChunk(cx, cy);
        if (!chunk) continue;

        // Render or use cached canvas for this chunk
        if (!chunk.canvasCache) {
          chunk.canvasCache = document.createElement('canvas');
          chunk.canvasCache.width = chunkPx;
          chunk.canvasCache.height = chunkPx;
          const cCtx = chunk.canvasCache.getContext('2d');
          if (cCtx) {
            // Draw cells
            for (let ly = 0; ly < CHUNK_SIZE; ly++) {
              for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                const colorIdx = chunk.cells[ly * CHUNK_SIZE + lx];
                if (colorIdx > 0 && colorIdx <= palette.length) {
                  const color = palette[colorIdx - 1].color;
                  cCtx.fillStyle = color;
                  cCtx.fillRect(lx * cellSize, ly * cellSize, cellSize, cellSize);
                }
              }
            }

            // Draw grid line borders lightly
            cCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            cCtx.lineWidth = 1;
            cCtx.beginPath();
            for (let i = 0; i <= CHUNK_SIZE; i++) {
              const pos = i * cellSize;
              cCtx.moveTo(0, pos);
              cCtx.lineTo(chunkPx, pos);
              cCtx.moveTo(pos, 0);
              cCtx.lineTo(pos, chunkPx);
            }
            cCtx.stroke();

            // Draw horizontal styled edges
            chunk.hEdges.forEach((styleId, key) => {
              const style = edgeStylesMap.get(styleId);
              if (style) {
                const [lxStr, lyStr] = key.split(',');
                const lx = parseInt(lxStr, 10);
                const ly = parseInt(lyStr, 10);
                cCtx.strokeStyle = style.color;
                cCtx.lineWidth = style.thickness || 3;
                cCtx.lineCap = 'round';
                cCtx.beginPath();
                cCtx.moveTo(lx * cellSize, ly * cellSize);
                cCtx.lineTo((lx + 1) * cellSize, ly * cellSize);
                cCtx.stroke();
              }
            });

            // Draw vertical styled edges
            chunk.vEdges.forEach((styleId, key) => {
              const style = edgeStylesMap.get(styleId);
              if (style) {
                const [lxStr, lyStr] = key.split(',');
                const lx = parseInt(lxStr, 10);
                const ly = parseInt(lyStr, 10);
                cCtx.strokeStyle = style.color;
                cCtx.lineWidth = style.thickness || 3;
                cCtx.lineCap = 'round';
                cCtx.beginPath();
                cCtx.moveTo(lx * cellSize, ly * cellSize);
                cCtx.lineTo(lx * cellSize, (ly + 1) * cellSize);
                cCtx.stroke();
              }
            });
          }
        }

        const worldX = cx * chunkPx;
        const worldY = cy * chunkPx;
        ctx.drawImage(chunk.canvasCache, worldX, worldY);

        // Render Fog layer if enabled
        if (fogConfig?.enabled) {
          const fogAlpha = isPlayerMode ? 1.0 : (fogConfig.dmOpacity ?? 0.55);
          ctx.fillStyle = isPlayerMode ? '#0a0e17' : `rgba(10, 14, 23, ${fogAlpha})`;

          for (let ly = 0; ly < CHUNK_SIZE; ly++) {
            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
              const isRevealed = chunk.fog[ly * CHUNK_SIZE + lx] === 1;
              if (!isRevealed) {
                const fx = worldX + lx * cellSize;
                const fy = worldY + ly * cellSize;
                ctx.fillRect(fx, fy, cellSize, cellSize);

                // For DM view, draw a subtle cross / diagonal indicator
                if (!isPlayerMode) {
                  ctx.save();
                  ctx.strokeStyle = `rgba(255, 255, 255, 0.08)`;
                  ctx.lineWidth = 1;
                  ctx.beginPath();
                  ctx.moveTo(fx + 4, fy + 4);
                  ctx.lineTo(fx + cellSize - 4, fy + cellSize - 4);
                  ctx.stroke();
                  ctx.restore();
                }
              }
            }
          }
        }
      }
    }
  }
}

// Global store registry per map
const activeStores: Map<string, CellStore> = new Map();

export function getCellStore(mapId: string, plugin: any): CellStore {
  let store = activeStores.get(mapId);
  if (!store || (store as any).plugin !== plugin) {
    store = new CellStore(mapId, plugin);
    activeStores.set(mapId, store);
  }
  return store;
}

export function removeCellStore(mapId: string): void {
  activeStores.delete(mapId);
}
