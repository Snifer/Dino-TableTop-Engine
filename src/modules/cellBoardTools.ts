import { CellEdgeStyle, CellMapData, CellPaletteColor, ToolContext, ToolDefinition, UndoStep } from '../types';
import { worldToCell } from './cellCoordinates';
import { CellStore, getCellStore } from './cellStore';
import { globalHistoryManager, globalToolManager, globalViewportManager } from './cellBoardCore';
import { registerSelectTool } from './cellBoardSelect';
import { broadcastLaser, broadcastPing, spawnPingEffect, updateLaserOverlay } from './laserPing';
import { setIcon } from 'obsidian';

export const DEFAULT_CELL_PALETTE: CellPaletteColor[] = [
  { color: '#2f3542', label: 'Piedra oscura' },
  { color: '#747d8c', label: 'Piedra gris' },
  { color: '#57606f', label: 'Muro sólido' },
  { color: '#2ed573', label: 'Hierba / Verde' },
  { color: '#1e90ff', label: 'Agua / Azul' },
  { color: '#ffa502', label: 'Madera / Tierra' },
  { color: '#ff4757', label: 'Lava / Peligro' },
  { color: '#a4b0be', label: 'Nieve / Mármol' },
  { color: '#70a1ff', label: 'Mágico / Éter' },
];

export const DEFAULT_EDGE_STYLES: CellEdgeStyle[] = [
  { id: 'wall_stone', name: 'Muro de piedra', color: '#2f3542', thickness: 4, blocksVision: true, blocksMovement: true },
  { id: 'door_wood', name: 'Puerta', color: '#d35400', thickness: 3, blocksVision: true, blocksMovement: true },
  { id: 'window_grate', name: 'Ventana / Reja', color: '#3498db', thickness: 2, blocksVision: false, blocksMovement: true },
  { id: 'curtain_smoke', name: 'Cortina / Humo', color: '#95a5a6', thickness: 2, blocksVision: true, blocksMovement: false },
];

// Active tool settings state
export interface CellToolState {
  activeColorIndex: number; // 1-based index (1..9)
  activeEdgeStyleId: string;
  isPanning: boolean;
  panStart: { x: number; y: number };
  fogMode: 'reveal' | 'hide';
  fogBrushSize: number; // 1, 3, 5
  laserColor: string;
  pingColor: string;
  pingIcon: string;
}

export const cellToolState: CellToolState = {
  activeColorIndex: 1,
  activeEdgeStyleId: 'wall_stone',
  isPanning: false,
  panStart: { x: 0, y: 0 },
  fogMode: 'reveal',
  fogBrushSize: 1,
  laserColor: '#ff3838',
  pingColor: '#ff4757',
  pingIcon: '📍',
};

export function initDefaultCellMapData(): CellMapData {
  return {
    cellSizePx: 48,
    palette: JSON.parse(JSON.stringify(DEFAULT_CELL_PALETTE)),
    edgeStyles: JSON.parse(JSON.stringify(DEFAULT_EDGE_STYLES)),
    backgroundImagePath: null,
    backgroundOffsetX: 0,
    backgroundOffsetY: 0,
    backgroundScale: 1,
    backgroundOpacity: 0.5,
  };
}

/**
 * Flood fill algorithm for cell map with safety bounds.
 */
function floodFillCells(
  store: CellStore,
  startCellX: number,
  startCellY: number,
  targetColor: number,
  replacementColor: number,
  maxCells: number = 4000
): Array<{ cellX: number; cellY: number; before: number; after: number }> {
  if (targetColor === replacementColor) return [];

  const changes: Array<{ cellX: number; cellY: number; before: number; after: number }> = [];
  const queue: Array<{ x: number; y: number }> = [{ x: startCellX, y: startCellY }];
  const visited = new Set<string>();

  const startKey = `${startCellX},${startCellY}`;
  visited.add(startKey);

  while (queue.length > 0 && changes.length < maxCells) {
    const { x, y } = queue.shift()!;
    const currentColor = store.getCell(x, y);

    if (currentColor === targetColor) {
      store.setCell(x, y, replacementColor);
      changes.push({ cellX: x, cellY: y, before: currentColor, after: replacementColor });

      const neighbors = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
      ];

      for (const n of neighbors) {
        const key = `${n.x},${n.y}`;
        if (!visited.has(key)) {
          visited.add(key);
          if (store.getCell(n.x, n.y) === targetColor) {
            queue.push(n);
          }
        }
      }
    }
  }

  return changes;
}

// Temporary stroke changes for Undo recording
let currentStrokeCellChanges: Array<{ cellX: number; cellY: number; before: number; after: number }> = [];
let currentStrokeEdgeChanges: Array<{ cellX: number; cellY: number; isHorizontal: boolean; before: string | undefined; after: string | undefined }> = [];
let isPointerActive = false;

export function registerCellBoardTools(): void {
  // ─── 0. SELECT TOOL ───
  registerSelectTool();

  // ─── 1. MOVE / CAMERA TOOL ───
  globalToolManager.registerTool({
    id: 'move',
    label: 'Mover / Navegar',
    icon: 'lucide-hand',
    group: 'navigate',
    cursor: 'grab',
    shortcut: 'V',
    available: () => true,
    onPointerDown: (e, worldPos, ctx) => {
      cellToolState.isPanning = true;
      cellToolState.panStart = { x: e.clientX, y: e.clientY };
      ctx.containerEl.style.cursor = 'grabbing';
    },
    onPointerMove: (e, worldPos, ctx) => {
      if (!cellToolState.isPanning) return;
      const dx = e.clientX - cellToolState.panStart.x;
      const dy = e.clientY - cellToolState.panStart.y;
      cellToolState.panStart = { x: e.clientX, y: e.clientY };

      globalViewportManager.pan(ctx.mapId, dx, dy);
      if (ctx.view && typeof ctx.view.requestRender === 'function') {
        ctx.view.requestRender();
      }
    },
    onPointerUp: (e, worldPos, ctx) => {
      cellToolState.isPanning = false;
      ctx.containerEl.style.cursor = 'grab';
    },
    renderOptions: (el, ctx) => {
      el.empty();
      const hint = el.createSpan({ cls: 'dte-tool-opt-hint' });
      hint.setText('Arrastrar: mover vista | Rueda: zoom | Espacio+arrastrar en cualquier herramienta');
    },
  });

  // ─── 2. PAINT TOOL ───
  globalToolManager.registerTool({
    id: 'paint',
    label: 'Pintar celdas',
    icon: 'lucide-brush',
    group: 'draw',
    cursor: 'crosshair',
    shortcut: 'B',
    available: (map) => map.coordSpace === 'world' || !!map.cellMap,
    onPointerDown: (e, worldPos, ctx) => {
      if (!ctx.map.cellMap) return;
      isPointerActive = true;
      currentStrokeCellChanges = [];

      const store = getCellStore(ctx.mapId, ctx.view.plugin);
      const cellSize = ctx.map.cellMap.cellSizePx || 48;
      const { cellX, cellY } = worldToCell(worldPos.x, worldPos.y, cellSize);

      const before = store.getCell(cellX, cellY);
      const after = cellToolState.activeColorIndex;
      if (store.setCell(cellX, cellY, after)) {
        currentStrokeCellChanges.push({ cellX, cellY, before, after });
        if (ctx.view?.requestRender) ctx.view.requestRender();
      }
    },
    onPointerMove: (e, worldPos, ctx) => {
      if (!isPointerActive || !ctx.map.cellMap) return;
      const store = getCellStore(ctx.mapId, ctx.view.plugin);
      const cellSize = ctx.map.cellMap.cellSizePx || 48;
      const { cellX, cellY } = worldToCell(worldPos.x, worldPos.y, cellSize);

      const before = store.getCell(cellX, cellY);
      const after = cellToolState.activeColorIndex;
      if (store.setCell(cellX, cellY, after)) {
        currentStrokeCellChanges.push({ cellX, cellY, before, after });
        if (ctx.view?.requestRender) ctx.view.requestRender();
      }
    },
    onPointerUp: (e, worldPos, ctx) => {
      if (!isPointerActive) return;
      isPointerActive = false;

      if (currentStrokeCellChanges.length > 0) {
        const changes = [...currentStrokeCellChanges];
        const mapId = ctx.mapId;
        const plugin = ctx.view.plugin;

        const undoStep: UndoStep = {
          label: 'Pintar celdas',
          undo: () => {
            const store = getCellStore(mapId, plugin);
            changes.forEach((c) => store.setCell(c.cellX, c.cellY, c.before));
            if (ctx.view?.requestRender) ctx.view.requestRender();
          },
          redo: () => {
            const store = getCellStore(mapId, plugin);
            changes.forEach((c) => store.setCell(c.cellX, c.cellY, c.after));
            if (ctx.view?.requestRender) ctx.view.requestRender();
          },
        };
        globalHistoryManager.push(mapId, undoStep);
      }
      currentStrokeCellChanges = [];
    },
    renderOptions: (el, ctx, refresh) => {
      renderPaletteToolbar(el, ctx, refresh);
    },
  });

  // ─── 3. ERASE TOOL ───
  globalToolManager.registerTool({
    id: 'erase',
    label: 'Borrar celdas',
    icon: 'lucide-eraser',
    group: 'draw',
    cursor: 'crosshair',
    shortcut: 'E',
    available: (map) => map.coordSpace === 'world' || !!map.cellMap,
    onPointerDown: (e, worldPos, ctx) => {
      if (!ctx.map.cellMap) return;
      isPointerActive = true;
      currentStrokeCellChanges = [];

      const store = getCellStore(ctx.mapId, ctx.view.plugin);
      const cellSize = ctx.map.cellMap.cellSizePx || 48;
      const { cellX, cellY } = worldToCell(worldPos.x, worldPos.y, cellSize);

      const before = store.getCell(cellX, cellY);
      if (before !== 0) {
        store.setCell(cellX, cellY, 0);
        currentStrokeCellChanges.push({ cellX, cellY, before, after: 0 });
        if (ctx.view?.requestRender) ctx.view.requestRender();
      }
    },
    onPointerMove: (e, worldPos, ctx) => {
      if (!isPointerActive || !ctx.map.cellMap) return;
      const store = getCellStore(ctx.mapId, ctx.view.plugin);
      const cellSize = ctx.map.cellMap.cellSizePx || 48;
      const { cellX, cellY } = worldToCell(worldPos.x, worldPos.y, cellSize);

      const before = store.getCell(cellX, cellY);
      if (before !== 0) {
        store.setCell(cellX, cellY, 0);
        currentStrokeCellChanges.push({ cellX, cellY, before, after: 0 });
        if (ctx.view?.requestRender) ctx.view.requestRender();
      }
    },
    onPointerUp: (e, worldPos, ctx) => {
      if (!isPointerActive) return;
      isPointerActive = false;

      if (currentStrokeCellChanges.length > 0) {
        const changes = [...currentStrokeCellChanges];
        const mapId = ctx.mapId;
        const plugin = ctx.view.plugin;

        const undoStep: UndoStep = {
          label: 'Borrar celdas',
          undo: () => {
            const store = getCellStore(mapId, plugin);
            changes.forEach((c) => store.setCell(c.cellX, c.cellY, c.before));
            if (ctx.view?.requestRender) ctx.view.requestRender();
          },
          redo: () => {
            const store = getCellStore(mapId, plugin);
            changes.forEach((c) => store.setCell(c.cellX, c.cellY, c.after));
            if (ctx.view?.requestRender) ctx.view.requestRender();
          },
        };
        globalHistoryManager.push(mapId, undoStep);
      }
      currentStrokeCellChanges = [];
    },
    renderOptions: (el) => {
      el.empty();
      const hint = el.createSpan({ cls: 'dte-tool-opt-hint' });
      hint.setText('Arrastrar sobre celdas para borrarlas y dejarlas transparentes.');
    },
  });

  // ─── 4. FILL (FLOOD FILL) TOOL ───
  globalToolManager.registerTool({
    id: 'fill',
    label: 'Rellenar región',
    icon: 'lucide-paint-bucket',
    group: 'draw',
    cursor: 'crosshair',
    shortcut: 'G',
    available: (map) => map.coordSpace === 'world' || !!map.cellMap,
    onPointerDown: (e, worldPos, ctx) => {
      if (!ctx.map.cellMap) return;
      const store = getCellStore(ctx.mapId, ctx.view.plugin);
      const cellSize = ctx.map.cellMap.cellSizePx || 48;
      const { cellX, cellY } = worldToCell(worldPos.x, worldPos.y, cellSize);

      const targetColor = store.getCell(cellX, cellY);
      const replacementColor = cellToolState.activeColorIndex;

      if (targetColor === replacementColor) return;

      const changes = floodFillCells(store, cellX, cellY, targetColor, replacementColor, 4000);
      if (changes.length > 0) {
        if (ctx.view?.requestRender) ctx.view.requestRender();

        const mapId = ctx.mapId;
        const plugin = ctx.view.plugin;
        const undoStep: UndoStep = {
          label: 'Relleno de celdas',
          undo: () => {
            const s = getCellStore(mapId, plugin);
            changes.forEach((c) => s.setCell(c.cellX, c.cellY, c.before));
            if (ctx.view?.requestRender) ctx.view.requestRender();
          },
          redo: () => {
            const s = getCellStore(mapId, plugin);
            changes.forEach((c) => s.setCell(c.cellX, c.cellY, c.after));
            if (ctx.view?.requestRender) ctx.view.requestRender();
          },
        };
        globalHistoryManager.push(mapId, undoStep);
      }
    },
    renderOptions: (el, ctx, refresh) => {
      renderPaletteToolbar(el, ctx, refresh);
    },
  });

  // ─── 5. EDGE / BORDER TOOL ───
  globalToolManager.registerTool({
    id: 'edge',
    label: 'Bordes y Muros',
    icon: 'lucide-square-dashed',
    group: 'draw',
    cursor: 'crosshair',
    available: (map) => map.coordSpace === 'world' || !!map.cellMap,
    onPointerDown: (e, worldPos, ctx) => {
      if (!ctx.map.cellMap) return;
      isPointerActive = true;
      currentStrokeEdgeChanges = [];

      applyEdgeAtWorldPos(worldPos, ctx);
    },
    onPointerMove: (e, worldPos, ctx) => {
      if (!isPointerActive || !ctx.map.cellMap) return;
      applyEdgeAtWorldPos(worldPos, ctx);
    },
    onPointerUp: (e, worldPos, ctx) => {
      if (!isPointerActive) return;
      isPointerActive = false;

      if (currentStrokeEdgeChanges.length > 0) {
        const changes = [...currentStrokeEdgeChanges];
        const mapId = ctx.mapId;
        const plugin = ctx.view.plugin;

        const undoStep: UndoStep = {
          label: 'Bordes / Muros',
          undo: () => {
            const store = getCellStore(mapId, plugin);
            changes.forEach((c) => {
              if (c.isHorizontal) {
                store.setHorizontalEdge(c.cellX, c.cellY, c.before);
              } else {
                store.setVerticalEdge(c.cellX, c.cellY, c.before);
              }
            });
            if (ctx.view?.requestRender) ctx.view.requestRender();
          },
          redo: () => {
            const store = getCellStore(mapId, plugin);
            changes.forEach((c) => {
              if (c.isHorizontal) {
                store.setHorizontalEdge(c.cellX, c.cellY, c.after);
              } else {
                store.setVerticalEdge(c.cellX, c.cellY, c.after);
              }
            });
            if (ctx.view?.requestRender) ctx.view.requestRender();
          },
        };
        globalHistoryManager.push(mapId, undoStep);
      }
      currentStrokeEdgeChanges = [];
    },
    renderOptions: (el, ctx, refresh) => {
      renderEdgeStylesToolbar(el, ctx, refresh);
    },
  });

  // ─── 6. FOG OF WAR TOOL ───
  let currentStrokeFogChanges: Array<{ cellX: number; cellY: number; before: number }> = [];

  globalToolManager.registerTool({
    id: 'fog',
    label: 'Niebla de Guerra',
    icon: 'lucide-cloud',
    group: 'fog',
    cursor: 'crosshair',
    shortcut: 'F',
    available: (map) => map.coordSpace === 'world' || !!map.cellMap,
    onPointerDown: (e, worldPos, ctx) => {
      if (!ctx.map.cellMap) return;
      if (!ctx.map.fog) {
        ctx.map.fog = { enabled: true, dmOpacity: 0.55 };
      } else {
        ctx.map.fog.enabled = true;
      }

      isPointerActive = true;
      currentStrokeFogChanges = [];
      applyFogAtWorldPos(worldPos, ctx, currentStrokeFogChanges);
    },
    onPointerMove: (e, worldPos, ctx) => {
      if (!isPointerActive || !ctx.map.cellMap) return;
      applyFogAtWorldPos(worldPos, ctx, currentStrokeFogChanges);
    },
    onPointerUp: (e, worldPos, ctx) => {
      if (!isPointerActive) return;
      isPointerActive = false;

      if (currentStrokeFogChanges.length > 0) {
        const changes = [...currentStrokeFogChanges];
        const mapId = ctx.mapId;
        const plugin = ctx.view.plugin;
        const isReveal = cellToolState.fogMode === 'reveal';

        const undoStep: UndoStep = {
          label: isReveal ? 'Revelar Niebla' : 'Ocultar Niebla',
          undo: () => {
            const store = getCellStore(mapId, plugin);
            changes.forEach((c) => {
              store.setFog(c.cellX, c.cellY, c.before === 1);
            });
            if (ctx.view?.requestRender) ctx.view.requestRender();
          },
          redo: () => {
            const store = getCellStore(mapId, plugin);
            changes.forEach((c) => {
              store.setFog(c.cellX, c.cellY, isReveal);
            });
            if (ctx.view?.requestRender) ctx.view.requestRender();
          },
        };
        globalHistoryManager.push(mapId, undoStep);
      }
      currentStrokeFogChanges = [];
    },
    renderOptions: (el, ctx, refresh) => {
      renderFogToolbar(el, ctx, refresh);
    },
  });

  // ─── 7. LASER POINTER TOOL ───
  globalToolManager.registerTool({
    id: 'laser',
    label: 'Puntero Láser',
    icon: 'lucide-sparkles',
    group: 'utility',
    cursor: 'crosshair',
    shortcut: 'L',
    available: () => true,
    onPointerDown: (e, worldPos, ctx) => {
      updateLaserOverlay(ctx.containerEl, worldPos.x, worldPos.y, cellToolState.laserColor, true);
      broadcastLaser({ x: worldPos.x, y: worldPos.y, color: cellToolState.laserColor, active: true });
    },
    onPointerMove: (e, worldPos, ctx) => {
      updateLaserOverlay(ctx.containerEl, worldPos.x, worldPos.y, cellToolState.laserColor, true);
      broadcastLaser({ x: worldPos.x, y: worldPos.y, color: cellToolState.laserColor, active: true });
    },
    onPointerUp: (e, worldPos, ctx) => {
      updateLaserOverlay(ctx.containerEl, worldPos.x, worldPos.y, cellToolState.laserColor, false);
      broadcastLaser({ active: false });
    },
    renderOptions: (el, ctx, refresh) => {
      renderLaserToolbar(el, ctx, refresh);
    },
  });

  // ─── 8. ATTENTION PING TOOL ───
  globalToolManager.registerTool({
    id: 'ping',
    label: 'Ping de Atención',
    icon: 'lucide-crosshair',
    group: 'utility',
    cursor: 'crosshair',
    shortcut: 'P',
    available: () => true,
    onPointerDown: (e, worldPos, ctx) => {
      spawnPingEffect(ctx.containerEl, worldPos.x, worldPos.y, cellToolState.pingColor, cellToolState.pingIcon);
      broadcastPing({
        x: worldPos.x,
        y: worldPos.y,
        color: cellToolState.pingColor,
        icon: cellToolState.pingIcon,
      });
    },
    renderOptions: (el, ctx, refresh) => {
      renderPingToolbar(el, ctx, refresh);
    },
  });
}

function applyFogAtWorldPos(
  worldPos: { x: number; y: number },
  ctx: ToolContext,
  changesAcc: Array<{ cellX: number; cellY: number; before: number }>
): void {
  if (!ctx.map.cellMap) return;
  const store = getCellStore(ctx.mapId, ctx.view.plugin);
  const cellSize = ctx.map.cellMap.cellSizePx || 48;
  const { cellX, cellY } = worldToCell(worldPos.x, worldPos.y, cellSize);
  const radius = Math.floor(cellToolState.fogBrushSize / 2);

  let newChanges: Array<{ cellX: number; cellY: number; before: number }> = [];
  if (cellToolState.fogMode === 'reveal') {
    newChanges = store.revealRadius(cellX, cellY, radius);
  } else {
    newChanges = store.hideRadius(cellX, cellY, radius);
  }

  if (newChanges.length > 0) {
    changesAcc.push(...newChanges);
    if (ctx.view?.requestRender) ctx.view.requestRender();
  }
}

function applyEdgeAtWorldPos(worldPos: { x: number; y: number }, ctx: ToolContext): void {
  if (!ctx.map.cellMap) return;
  const store = getCellStore(ctx.mapId, ctx.view.plugin);
  const cellSize = ctx.map.cellMap.cellSizePx || 48;

  const cellX = Math.floor(worldPos.x / cellSize);
  const cellY = Math.floor(worldPos.y / cellSize);
  const relX = (worldPos.x - cellX * cellSize) / cellSize;
  const relY = (worldPos.y - cellY * cellSize) / cellSize;

  // Determine closest boundary: Top, Bottom, Left, or Right
  const distTop = relY;
  const distBottom = 1 - relY;
  const distLeft = relX;
  const distRight = 1 - relX;

  const minDist = Math.min(distTop, distBottom, distLeft, distRight);
  const styleId = cellToolState.activeEdgeStyleId;

  if (minDist === distTop) {
    // Horizontal edge at top of cell (cellX, cellY)
    const before = store.getHorizontalEdge(cellX, cellY);
    if (before !== styleId && store.setHorizontalEdge(cellX, cellY, styleId)) {
      currentStrokeEdgeChanges.push({ cellX, cellY, isHorizontal: true, before, after: styleId });
      if (ctx.view?.requestRender) ctx.view.requestRender();
    }
  } else if (minDist === distBottom) {
    // Horizontal edge at bottom of cell (cellX, cellY + 1)
    const before = store.getHorizontalEdge(cellX, cellY + 1);
    if (before !== styleId && store.setHorizontalEdge(cellX, cellY + 1, styleId)) {
      currentStrokeEdgeChanges.push({ cellX, cellY: cellY + 1, isHorizontal: true, before, after: styleId });
      if (ctx.view?.requestRender) ctx.view.requestRender();
    }
  } else if (minDist === distLeft) {
    // Vertical edge at left of cell (cellX, cellY)
    const before = store.getVerticalEdge(cellX, cellY);
    if (before !== styleId && store.setVerticalEdge(cellX, cellY, styleId)) {
      currentStrokeEdgeChanges.push({ cellX, cellY, isHorizontal: false, before, after: styleId });
      if (ctx.view?.requestRender) ctx.view.requestRender();
    }
  } else {
    // Vertical edge at right of cell (cellX + 1, cellY)
    const before = store.getVerticalEdge(cellX + 1, cellY);
    if (before !== styleId && store.setVerticalEdge(cellX + 1, cellY, styleId)) {
      currentStrokeEdgeChanges.push({ cellX: cellX + 1, cellY, isHorizontal: false, before, after: styleId });
      if (ctx.view?.requestRender) ctx.view.requestRender();
    }
  }
}

/**
 * Renders the color palette selector in bottom toolbar.
 */
function renderPaletteToolbar(el: HTMLElement, ctx: ToolContext, refresh: () => void): void {
  el.empty();
  const palette = ctx.map.cellMap?.palette || DEFAULT_CELL_PALETTE;

  const container = el.createDiv({ cls: 'dte-palette-bar' });
  palette.forEach((item, index) => {
    const colorIdx = index + 1;
    const isSelected = cellToolState.activeColorIndex === colorIdx;
    const swatch = container.createDiv({
      cls: `dte-color-swatch ${isSelected ? 'is-selected' : ''}`,
    });
    swatch.style.backgroundColor = item.color;
    swatch.title = `${colorIdx}. ${item.label} (${item.color})`;

    // Shortcut badge (1..9)
    if (colorIdx <= 9) {
      swatch.createSpan({ cls: 'dte-swatch-key', text: `${colorIdx}` });
    }

    swatch.addEventListener('click', () => {
      cellToolState.activeColorIndex = colorIdx;
      refresh();
    });
  });
}

/**
 * Renders the edge style selector in bottom toolbar.
 */
function renderEdgeStylesToolbar(el: HTMLElement, ctx: ToolContext, refresh: () => void): void {
  el.empty();
  const styles = ctx.map.cellMap?.edgeStyles || DEFAULT_EDGE_STYLES;

  const container = el.createDiv({ cls: 'dte-edge-styles-bar' });
  styles.forEach((style) => {
    const isSelected = cellToolState.activeEdgeStyleId === style.id;
    const btn = container.createDiv({
      cls: `dte-edge-style-btn ${isSelected ? 'is-selected' : ''}`,
    });

    const preview = btn.createSpan({ cls: 'dte-edge-preview' });
    preview.style.borderColor = style.color;
    preview.style.borderWidth = `${Math.min(4, style.thickness)}px`;

    btn.createSpan({ cls: 'dte-edge-name', text: style.name });

    btn.addEventListener('click', () => {
      cellToolState.activeEdgeStyleId = style.id;
      refresh();
    });
  });
}

/**
 * Renders the Fog of War toolbar in bottom panel.
 */
function renderFogToolbar(el: HTMLElement, ctx: ToolContext, refresh: () => void): void {
  el.empty();
  const fogConfig = ctx.map.fog || { enabled: true, dmOpacity: 0.55 };
  const container = el.createDiv({ cls: 'dte-fog-toolbar-bar' });

  // Toggle Fog
  const toggleBtn = container.createEl('button', {
    cls: `dte-fog-btn ${fogConfig.enabled ? 'is-active' : ''}`,
    text: fogConfig.enabled ? 'Niebla: ACTIVA' : 'Niebla: INACTIVA',
  });
  toggleBtn.addEventListener('click', async () => {
    fogConfig.enabled = !fogConfig.enabled;
    ctx.map.fog = fogConfig;
    await ctx.view.plugin?.saveSettings();
    if (ctx.view?.requestRender) ctx.view.requestRender();
    refresh();
  });

  // Reveal vs Hide modes
  const modeGroup = container.createDiv({ cls: 'dte-tool-opt-btn-group' });
  const revealBtn = modeGroup.createEl('button', {
    cls: `dte-opt-btn ${cellToolState.fogMode === 'reveal' ? 'is-active' : ''}`,
    text: '👁️ Revelar',
  });
  revealBtn.addEventListener('click', () => {
    cellToolState.fogMode = 'reveal';
    refresh();
  });

  const hideBtn = modeGroup.createEl('button', {
    cls: `dte-opt-btn ${cellToolState.fogMode === 'hide' ? 'is-active' : ''}`,
    text: '🌫️ Ocultar',
  });
  hideBtn.addEventListener('click', () => {
    cellToolState.fogMode = 'hide';
    refresh();
  });

  // Brush size
  const sizeGroup = container.createDiv({ cls: 'dte-tool-opt-btn-group' });
  [1, 3, 5].forEach((sz) => {
    const btn = sizeGroup.createEl('button', {
      cls: `dte-opt-btn ${cellToolState.fogBrushSize === sz ? 'is-active' : ''}`,
      text: `${sz}×${sz}`,
    });
    btn.addEventListener('click', () => {
      cellToolState.fogBrushSize = sz;
      refresh();
    });
  });

  // Bulk actions: Reveal all / Hide all
  const bulkGroup = container.createDiv({ cls: 'dte-tool-opt-btn-group' });
  const revAllBtn = bulkGroup.createEl('button', { cls: 'dte-opt-btn', text: 'Revelar Todo' });
  revAllBtn.addEventListener('click', () => {
    const store = getCellStore(ctx.mapId, ctx.view.plugin);
    store.revealAll();
    if (ctx.view?.requestRender) ctx.view.requestRender();
  });

  const hideAllBtn = bulkGroup.createEl('button', { cls: 'dte-opt-btn', text: 'Ocultar Todo' });
  hideAllBtn.addEventListener('click', () => {
    const store = getCellStore(ctx.mapId, ctx.view.plugin);
    store.hideAll();
    if (ctx.view?.requestRender) ctx.view.requestRender();
  });

  // Opacity Slider
  const sliderWrap = container.createDiv({ cls: 'dte-fog-opacity-wrap' });
  sliderWrap.createSpan({ text: `Opacidad DM: ${Math.round((fogConfig.dmOpacity ?? 0.55) * 100)}%` });
  const slider = sliderWrap.createEl('input', {
    attr: { type: 'range', min: '10', max: '90', step: '5', value: `${Math.round((fogConfig.dmOpacity ?? 0.55) * 100)}` },
  });
  slider.addEventListener('input', async (e: any) => {
    const val = parseInt(e.target.value, 10) / 100;
    fogConfig.dmOpacity = val;
    ctx.map.fog = fogConfig;
    await ctx.view.plugin?.saveSettings();
    if (ctx.view?.requestRender) ctx.view.requestRender();
  });
}

/**
 * Renders the Laser Pointer toolbar in bottom panel.
 */
function renderLaserToolbar(el: HTMLElement, ctx: ToolContext, refresh: () => void): void {
  el.empty();
  const container = el.createDiv({ cls: 'dte-laser-toolbar-bar' });
  container.createSpan({ cls: 'dte-tool-opt-label', text: 'Color de Láser:' });

  const colors = [
    { color: '#ff3838', label: 'Rojo' },
    { color: '#2ed573', label: 'Verde' },
    { color: '#1e90ff', label: 'Azul' },
    { color: '#ffd32a', label: 'Oro' },
    { color: '#a55eea', label: 'Púrpura' },
  ];

  colors.forEach((c) => {
    const swatch = container.createDiv({
      cls: `dte-color-swatch ${cellToolState.laserColor === c.color ? 'is-selected' : ''}`,
    });
    swatch.style.backgroundColor = c.color;
    swatch.title = c.label;
    swatch.addEventListener('click', () => {
      cellToolState.laserColor = c.color;
      refresh();
    });
  });

  container.createSpan({
    cls: 'dte-tool-opt-hint',
    text: 'Mantén presionado y arrastra para señalar en vivo.',
  });
}

/**
 * Renders the Attention Ping toolbar in bottom panel.
 */
function renderPingToolbar(el: HTMLElement, ctx: ToolContext, refresh: () => void): void {
  el.empty();
  const container = el.createDiv({ cls: 'dte-ping-toolbar-bar' });
  container.createSpan({ cls: 'dte-tool-opt-label', text: 'Ping:' });

  const colors = ['#ff4757', '#1e90ff', '#2ed573', '#ffa502', '#9b59b6'];
  colors.forEach((col) => {
    const swatch = container.createDiv({
      cls: `dte-color-swatch ${cellToolState.pingColor === col ? 'is-selected' : ''}`,
    });
    swatch.style.backgroundColor = col;
    swatch.addEventListener('click', () => {
      cellToolState.pingColor = col;
      refresh();
    });
  });

  const icons = ['📍', '⚔️', '⚠️', '👁️', '⭐', '🎯'];
  const iconGroup = container.createDiv({ cls: 'dte-tool-opt-btn-group' });
  icons.forEach((ic) => {
    const btn = iconGroup.createEl('button', {
      cls: `dte-opt-btn ${cellToolState.pingIcon === ic ? 'is-active' : ''}`,
      text: ic,
    });
    btn.addEventListener('click', () => {
      cellToolState.pingIcon = ic;
      refresh();
    });
  });

  container.createSpan({
    cls: 'dte-tool-opt-hint',
    text: 'Clic en el mapa para emitir onda (o Alt+Clic en cualquier herramienta).',
  });
}
