import { DinoPlugin, IDinoTabletopView, MapData, POIData, TokenData, ToolContext, UndoStep } from '../types';
import { toCss, worldToCell } from './cellCoordinates';
import { getCellStore } from './cellStore';
import { globalHistoryManager, globalToolManager } from './cellBoardCore';
import { cellToolState } from './cellBoardTools';
import { genId } from '../utils';
import { Notice, setIcon } from 'obsidian';

export interface ClipboardData {
  tokens: TokenData[];
  pois: POIData[];
  cells?: Array<{ relCellX: number; relCellY: number; colorIndex: number }>;
  edges?: Array<{ relCellX: number; relCellY: number; isHorizontal: boolean; styleId: string }>;
  origin: { x: number; y: number };
}

export interface MultiSelectionState {
  selectedTokenIds: Set<string>;
  selectedPoiIds: Set<string>;
  cellBounds: { minCellX: number; minCellY: number; maxCellX: number; maxCellY: number } | null;
  isMarquee: boolean;
  marqueeStartWorld: { x: number; y: number };
  marqueeCurrentWorld: { x: number; y: number };
  isDraggingSelection: boolean;
  dragStartWorld: { x: number; y: number };
  initialEntityPositions: Map<string, { x: number; y: number }>;
  snapToGrid: boolean;
  clipboard: ClipboardData | null;
  isPasting: boolean;
  ghostWorldPos: { x: number; y: number } | null;
}

export const multiSelectionState: MultiSelectionState = {
  selectedTokenIds: new Set(),
  selectedPoiIds: new Set(),
  cellBounds: null,
  isMarquee: false,
  marqueeStartWorld: { x: 0, y: 0 },
  marqueeCurrentWorld: { x: 0, y: 0 },
  isDraggingSelection: false,
  dragStartWorld: { x: 0, y: 0 },
  initialEntityPositions: new Map(),
  snapToGrid: true,
  clipboard: null,
  isPasting: false,
  ghostWorldPos: null,
};

export function clearSelection(): void {
  multiSelectionState.selectedTokenIds.clear();
  multiSelectionState.selectedPoiIds.clear();
  multiSelectionState.cellBounds = null;
  multiSelectionState.isPasting = false;
  multiSelectionState.ghostWorldPos = null;
  updateSelectionDOM();
}

export function selectAll(map: MapData): void {
  clearSelection();
  map.tokens.forEach((t) => multiSelectionState.selectedTokenIds.add(t.id));
  map.pois.forEach((p) => multiSelectionState.selectedPoiIds.add(p.id));
  updateSelectionDOM();
}

export function hasSelection(): boolean {
  return (
    multiSelectionState.selectedTokenIds.size > 0 ||
    multiSelectionState.selectedPoiIds.size > 0 ||
    multiSelectionState.cellBounds !== null
  );
}

export function updateSelectionDOM(): void {
  document.querySelectorAll('.dte-token').forEach((el) => {
    el.classList.remove('is-selected-token');
  });
  document.querySelectorAll('.dte-poi').forEach((el) => {
    el.classList.remove('is-selected-poi');
  });

  multiSelectionState.selectedTokenIds.forEach((id) => {
    const tokenEl = document.querySelector(`.dte-token[data-token-id="${id}"]`);
    if (tokenEl) tokenEl.classList.add('is-selected-token');
  });

  multiSelectionState.selectedPoiIds.forEach((id) => {
    const poiEl = document.querySelector(`.dte-poi[data-poi-id="${id}"]`);
    if (poiEl) poiEl.classList.add('is-selected-poi');
  });

  // Update or remove selection overlay box
  let boxEl = document.querySelector('.dte-marquee-overlay') as HTMLElement | null;
  if (!multiSelectionState.isMarquee) {
    if (boxEl) boxEl.remove();
  }
}

/**
 * Copies active selection into clipboard.
 */
export function copySelection(map: MapData, mapId: string, plugin: DinoPlugin): boolean {
  if (!hasSelection()) return false;

  const copiedTokens: TokenData[] = [];
  const copiedPois: POIData[] = [];

  map.tokens.forEach((t) => {
    if (multiSelectionState.selectedTokenIds.has(t.id)) {
      copiedTokens.push(JSON.parse(JSON.stringify(t)) as TokenData);
    }
  });

  map.pois.forEach((p) => {
    if (multiSelectionState.selectedPoiIds.has(p.id)) {
      copiedPois.push(JSON.parse(JSON.stringify(p)) as POIData);
    }
  });

  let originX = 0;
  let originY = 0;
  let count = copiedTokens.length + copiedPois.length;

  if (count > 0) {
    let sumX = 0;
    let sumY = 0;
    copiedTokens.forEach((t) => {
      sumX += t.x;
      sumY += t.y;
    });
    copiedPois.forEach((p) => {
      sumX += p.x;
      sumY += p.y;
    });
    originX = sumX / count;
    originY = sumY / count;
  }

  // Copy cell range if cell bounds selected
  const copiedCells: Array<{ relCellX: number; relCellY: number; colorIndex: number }> = [];
  const copiedEdges: Array<{ relCellX: number; relCellY: number; isHorizontal: boolean; styleId: string }> = [];

  if (multiSelectionState.cellBounds && map.cellMap) {
    const store = getCellStore(mapId, plugin);
    const { minCellX, minCellY, maxCellX, maxCellY } = multiSelectionState.cellBounds;
    for (let cy = minCellY; cy <= maxCellY; cy++) {
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        const c = store.getCell(cx, cy);
        if (c > 0) {
          copiedCells.push({ relCellX: cx - minCellX, relCellY: cy - minCellY, colorIndex: c });
        }
        const h = store.getHorizontalEdge(cx, cy);
        if (h) {
          copiedEdges.push({ relCellX: cx - minCellX, relCellY: cy - minCellY, isHorizontal: true, styleId: h });
        }
        const v = store.getVerticalEdge(cx, cy);
        if (v) {
          copiedEdges.push({ relCellX: cx - minCellX, relCellY: cy - minCellY, isHorizontal: false, styleId: v });
        }
      }
    }
    if (count === 0) {
      originX = minCellX * (map.cellMap.cellSizePx || 48);
      originY = minCellY * (map.cellMap.cellSizePx || 48);
    }
  }

  multiSelectionState.clipboard = {
    tokens: copiedTokens,
    pois: copiedPois,
    cells: copiedCells.length > 0 ? copiedCells : undefined,
    edges: copiedEdges.length > 0 ? copiedEdges : undefined,
    origin: { x: originX, y: originY },
  };

  new Notice(`Copiado al portapapeles (${copiedTokens.length} fichas, ${copiedPois.length} POIs)`);
  return true;
}

/**
 * Pastes clipboard contents at the given target world coordinate.
 */
export function pasteClipboardAt(
  map: MapData,
  mapId: string,
  targetPos: { x: number; y: number },
  plugin: DinoPlugin,
  view: IDinoTabletopView
): boolean {
  const clip = multiSelectionState.clipboard;
  if (!clip) return false;

  const dx = targetPos.x - clip.origin.x;
  const dy = targetPos.y - clip.origin.y;

  const newTokens: TokenData[] = [];
  const newPois: POIData[] = [];

  // Deep clone and generate new IDs
  clip.tokens.forEach((t) => {
    const clone = JSON.parse(JSON.stringify(t)) as TokenData;
    clone.id = genId();
    clone.x = Math.round(t.x + dx);
    clone.y = Math.round(t.y + dy);

    // Re-assign IDs to cloned inventory items
    if (clone.inventory?.items) {
      clone.inventory.items.forEach((item) => {
        item.id = genId();
      });
    }

    newTokens.push(clone);
  });

  clip.pois.forEach((p) => {
    const clone = JSON.parse(JSON.stringify(p)) as POIData;
    clone.id = genId();
    clone.x = Math.round(p.x + dx);
    clone.y = Math.round(p.y + dy);
    newPois.push(clone);
  });

  // Paste cells if present
  const pastedCellChanges: Array<{ cellX: number; cellY: number; before: number; after: number }> = [];
  if (clip.cells && map.cellMap) {
    const store = getCellStore(mapId, plugin);
    const cellSize = map.cellMap.cellSizePx || 48;
    const baseCellX = Math.floor(targetPos.x / cellSize);
    const baseCellY = Math.floor(targetPos.y / cellSize);

    clip.cells.forEach((c) => {
      const gx = baseCellX + c.relCellX;
      const gy = baseCellY + c.relCellY;
      const before = store.getCell(gx, gy);
      store.setCell(gx, gy, c.colorIndex);
      pastedCellChanges.push({ cellX: gx, cellY: gy, before, after: c.colorIndex });
    });
  }

  map.tokens.push(...newTokens);
  map.pois.push(...newPois);

  // Select newly pasted items
  clearSelection();
  newTokens.forEach((t) => multiSelectionState.selectedTokenIds.add(t.id));
  newPois.forEach((p) => multiSelectionState.selectedPoiIds.add(p.id));

  // Undo step
  const undoStep: UndoStep = {
    label: 'Pegar elementos',
    undo: async () => {
      const tokenIds = new Set(newTokens.map((t) => t.id));
      const poiIds = new Set(newPois.map((p) => p.id));
      map.tokens = map.tokens.filter((t) => !tokenIds.has(t.id));
      map.pois = map.pois.filter((p) => !poiIds.has(p.id));

      if (pastedCellChanges.length > 0 && map.cellMap) {
        const store = getCellStore(mapId, plugin);
        pastedCellChanges.forEach((c) => store.setCell(c.cellX, c.cellY, c.before));
      }
      clearSelection();
      await plugin.saveSettings();
      view.render();
    },
    redo: async () => {
      map.tokens.push(...newTokens);
      map.pois.push(...newPois);
      if (pastedCellChanges.length > 0 && map.cellMap) {
        const store = getCellStore(mapId, plugin);
        pastedCellChanges.forEach((c) => store.setCell(c.cellX, c.cellY, c.after));
      }
      clearSelection();
      newTokens.forEach((t) => multiSelectionState.selectedTokenIds.add(t.id));
      newPois.forEach((p) => multiSelectionState.selectedPoiIds.add(p.id));
      await plugin.saveSettings();
      view.render();
    },
  };
  globalHistoryManager.push(mapId, undoStep);

  plugin.saveSettings();
  view.render();
  multiSelectionState.isPasting = false;
  multiSelectionState.ghostWorldPos = null;

  return true;
}

/**
 * Deletes all currently selected tokens and POIs.
 */
export async function deleteSelection(map: MapData, mapId: string, plugin: DinoPlugin, view: IDinoTabletopView): Promise<boolean> {
  const tokenCount = multiSelectionState.selectedTokenIds.size;
  const poiCount = multiSelectionState.selectedPoiIds.size;
  if (tokenCount === 0 && poiCount === 0 && !multiSelectionState.cellBounds) return false;

  const msg = `¿Eliminar ${tokenCount} fichas y ${poiCount} puntos de interés seleccionados?`;
  if (tokenCount + poiCount > 1) {
    if (!confirm(msg)) return false;
  }

  const deletedTokens = map.tokens.filter((t) => multiSelectionState.selectedTokenIds.has(t.id));
  const deletedPois = map.pois.filter((p) => multiSelectionState.selectedPoiIds.has(p.id));

  map.tokens = map.tokens.filter((t) => !multiSelectionState.selectedTokenIds.has(t.id));
  map.pois = map.pois.filter((p) => !multiSelectionState.selectedPoiIds.has(p.id));

  // If cell bounds selected, clear cells
  const clearedCells: Array<{ cellX: number; cellY: number; before: number }> = [];
  if (multiSelectionState.cellBounds && map.cellMap) {
    const store = getCellStore(mapId, plugin);
    const { minCellX, minCellY, maxCellX, maxCellY } = multiSelectionState.cellBounds;
    for (let cy = minCellY; cy <= maxCellY; cy++) {
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        const b = store.getCell(cx, cy);
        if (b > 0) {
          store.setCell(cx, cy, 0);
          clearedCells.push({ cellX: cx, cellY: cy, before: b });
        }
      }
    }
  }

  const undoStep: UndoStep = {
    label: 'Eliminar selección',
    undo: async () => {
      map.tokens.push(...deletedTokens);
      map.pois.push(...deletedPois);
      if (clearedCells.length > 0 && map.cellMap) {
        const store = getCellStore(mapId, plugin);
        clearedCells.forEach((c) => store.setCell(c.cellX, c.cellY, c.before));
      }
      clearSelection();
      deletedTokens.forEach((t) => multiSelectionState.selectedTokenIds.add(t.id));
      deletedPois.forEach((p) => multiSelectionState.selectedPoiIds.add(p.id));
      await plugin.saveSettings();
      view.render();
    },
    redo: async () => {
      const tokenIds = new Set(deletedTokens.map((t) => t.id));
      const poiIds = new Set(deletedPois.map((p) => p.id));
      map.tokens = map.tokens.filter((t) => !tokenIds.has(t.id));
      map.pois = map.pois.filter((p) => !poiIds.has(p.id));
      if (clearedCells.length > 0 && map.cellMap) {
        const store = getCellStore(mapId, plugin);
        clearedCells.forEach((c) => store.setCell(c.cellX, c.cellY, 0));
      }
      clearSelection();
      await plugin.saveSettings();
      view.render();
    },
  };
  globalHistoryManager.push(mapId, undoStep);

  clearSelection();
  await plugin.saveSettings();
  view.render();
  return true;
}

/**
 * Nudges selection with arrow keys.
 */
export async function nudgeSelection(
  map: MapData,
  mapId: string,
  dx: number,
  dy: number,
  plugin: any,
  view: any
): Promise<void> {
  if (!hasSelection()) return;

  const isWorld = map.coordSpace === 'world';
  const cellSize = map.cellMap?.cellSizePx || 48;
  const stepX = isWorld ? dx * cellSize : dx * 2;
  const stepY = isWorld ? dy * cellSize : dy * 2;

  const movedTokens = map.tokens.filter((t) => multiSelectionState.selectedTokenIds.has(t.id));
  const movedPois = map.pois.filter((p) => multiSelectionState.selectedPoiIds.has(p.id));

  movedTokens.forEach((t) => {
    t.x += stepX;
    t.y += stepY;
  });
  movedPois.forEach((p) => {
    p.x += stepX;
    p.y += stepY;
  });

  const undoStep: UndoStep = {
    label: 'Mover selección',
    undo: async () => {
      movedTokens.forEach((t) => {
        t.x -= stepX;
        t.y -= stepY;
      });
      movedPois.forEach((p) => {
        p.x -= stepX;
        p.y -= stepY;
      });
      await plugin.saveSettings();
      view.render();
    },
    redo: async () => {
      movedTokens.forEach((t) => {
        t.x += stepX;
        t.y += stepY;
      });
      movedPois.forEach((p) => {
        p.x += stepX;
        p.y += stepY;
      });
      await plugin.saveSettings();
      view.render();
    },
  };
  globalHistoryManager.push(mapId, undoStep);

  await plugin.saveSettings();
  view.render();
}

export function registerSelectTool(): void {
  globalToolManager.registerTool({
    id: 'select',
    label: 'Seleccionar',
    icon: 'lucide-box-select',
    group: 'navigate',
    cursor: 'default',
    shortcut: 'S',
    available: () => true,
    onPointerDown: (e, worldPos, ctx) => {
      if (e.button !== 0) return;
      // 1. If currently in pasting ghost mode, place items
      if (multiSelectionState.isPasting && multiSelectionState.clipboard) {
        pasteClipboardAt(ctx.map, ctx.mapId, worldPos, ctx.view.plugin, ctx.view);
        return;
      }

      const target = e.target as HTMLElement;
      const clickedTokenEl = target.closest('.dte-token') as HTMLElement | null;
      const clickedPoiEl = target.closest('.dte-poi') as HTMLElement | null;

      const clickedTokenId = clickedTokenEl?.getAttribute('data-token-id');
      const clickedPoiId = clickedPoiEl?.getAttribute('data-poi-id');

      // Check if clicked an already selected item -> Start dragging group
      const isHitSelectedToken = clickedTokenId && multiSelectionState.selectedTokenIds.has(clickedTokenId);
      const isHitSelectedPoi = clickedPoiId && multiSelectionState.selectedPoiIds.has(clickedPoiId);

      if (isHitSelectedToken || isHitSelectedPoi) {
        multiSelectionState.isDraggingSelection = true;
        multiSelectionState.dragStartWorld = { x: worldPos.x, y: worldPos.y };
        multiSelectionState.initialEntityPositions.clear();

        ctx.map.tokens.forEach((t) => {
          if (multiSelectionState.selectedTokenIds.has(t.id)) {
            multiSelectionState.initialEntityPositions.set(t.id, { x: t.x, y: t.y });
          }
        });
        ctx.map.pois.forEach((p) => {
          if (multiSelectionState.selectedPoiIds.has(p.id)) {
            multiSelectionState.initialEntityPositions.set(p.id, { x: p.x, y: p.y });
          }
        });
        return;
      }

      // Check if single-clicked an unselected item
      if (clickedTokenId || clickedPoiId) {
        if (!e.shiftKey) clearSelection();
        if (clickedTokenId) multiSelectionState.selectedTokenIds.add(clickedTokenId);
        if (clickedPoiId) multiSelectionState.selectedPoiIds.add(clickedPoiId);
        updateSelectionDOM();

        // Start dragging this item
        multiSelectionState.isDraggingSelection = true;
        multiSelectionState.dragStartWorld = { x: worldPos.x, y: worldPos.y };
        multiSelectionState.initialEntityPositions.clear();
        ctx.map.tokens.forEach((t) => {
          if (multiSelectionState.selectedTokenIds.has(t.id)) {
            multiSelectionState.initialEntityPositions.set(t.id, { x: t.x, y: t.y });
          }
        });
        ctx.map.pois.forEach((p) => {
          if (multiSelectionState.selectedPoiIds.has(p.id)) {
            multiSelectionState.initialEntityPositions.set(p.id, { x: p.x, y: p.y });
          }
        });
        return;
      }

      // Otherwise, start marquee drag selection on background
      if (!e.shiftKey) clearSelection();
      multiSelectionState.isMarquee = true;
      multiSelectionState.marqueeStartWorld = { x: worldPos.x, y: worldPos.y };
      multiSelectionState.marqueeCurrentWorld = { x: worldPos.x, y: worldPos.y };
    },

    onPointerMove: (e, worldPos, ctx) => {
      // 1. Ghost preview tracking
      if (multiSelectionState.isPasting) {
        multiSelectionState.ghostWorldPos = { x: worldPos.x, y: worldPos.y };
        renderGhostPreview(ctx.containerEl, ctx.map, worldPos, ctx.viewport);
        return;
      }

      // 2. Dragging selected group
      if (multiSelectionState.isDraggingSelection) {
        let dx = worldPos.x - multiSelectionState.dragStartWorld.x;
        let dy = worldPos.y - multiSelectionState.dragStartWorld.y;

        const cellSize = ctx.map.cellMap?.cellSizePx || 48;
        if (multiSelectionState.snapToGrid && ctx.map.coordSpace === 'world') {
          dx = Math.round(dx / cellSize) * cellSize;
          dy = Math.round(dy / cellSize) * cellSize;
        }

        ctx.map.tokens.forEach((t) => {
          if (multiSelectionState.selectedTokenIds.has(t.id)) {
            const init = multiSelectionState.initialEntityPositions.get(t.id);
            if (init) {
              t.x = Math.round(init.x + dx);
              t.y = Math.round(init.y + dy);
              const el = ctx.containerEl.querySelector(`.dte-token[data-token-id="${t.id}"]`) as HTMLElement | null;
              if (el) {
                const css = toCss(ctx.map, t, ctx.viewport);
                el.style.left = css.left;
                el.style.top = css.top;
              }
            }
          }
        });

        ctx.map.pois.forEach((p) => {
          if (multiSelectionState.selectedPoiIds.has(p.id)) {
            const init = multiSelectionState.initialEntityPositions.get(p.id);
            if (init) {
              p.x = Math.round(init.x + dx);
              p.y = Math.round(init.y + dy);
              const el = ctx.containerEl.querySelector(`.dte-poi[data-poi-id="${p.id}"]`) as HTMLElement | null;
              if (el) {
                const css = toCss(ctx.map, p, ctx.viewport);
                el.style.left = css.left;
                el.style.top = css.top;
              }
            }
          }
        });
        return;
      }

      // 3. Marquee drag box
      if (multiSelectionState.isMarquee) {
        multiSelectionState.marqueeCurrentWorld = { x: worldPos.x, y: worldPos.y };
        renderMarqueeBox(ctx.containerEl, multiSelectionState.marqueeStartWorld, worldPos, ctx.viewport);
      }
    },

    onPointerUp: (e, worldPos, ctx) => {
      // 1. Finish dragging group -> Create Undo step
      if (multiSelectionState.isDraggingSelection) {
        multiSelectionState.isDraggingSelection = false;
        const movedTokens = ctx.map.tokens.filter((t) => multiSelectionState.selectedTokenIds.has(t.id));
        const movedPois = ctx.map.pois.filter((p) => multiSelectionState.selectedPoiIds.has(p.id));

        const initPositions = new Map(multiSelectionState.initialEntityPositions);
        const finalPositions = new Map<string, { x: number; y: number }>();
        movedTokens.forEach((t) => finalPositions.set(t.id, { x: t.x, y: t.y }));
        movedPois.forEach((p) => finalPositions.set(p.id, { x: p.x, y: p.y }));

        const mapId = ctx.mapId;
        const plugin = ctx.view.plugin;
        const view = ctx.view;

        const undoStep: UndoStep = {
          label: 'Mover grupo',
          undo: async () => {
            movedTokens.forEach((t) => {
              const init = initPositions.get(t.id);
              if (init) {
                t.x = init.x;
                t.y = init.y;
              }
            });
            movedPois.forEach((p) => {
              const init = initPositions.get(p.id);
              if (init) {
                p.x = init.x;
                p.y = init.y;
              }
            });
            await plugin.saveSettings();
            view.render();
          },
          redo: async () => {
            movedTokens.forEach((t) => {
              const fin = finalPositions.get(t.id);
              if (fin) {
                t.x = fin.x;
                t.y = fin.y;
              }
            });
            movedPois.forEach((p) => {
              const fin = finalPositions.get(p.id);
              if (fin) {
                p.x = fin.x;
                p.y = fin.y;
              }
            });
            await plugin.saveSettings();
            view.render();
          },
        };
        globalHistoryManager.push(mapId, undoStep);
        ctx.view.plugin.saveSettings();
        return;
      }

      // 2. Finish marquee box selection
      if (multiSelectionState.isMarquee) {
        multiSelectionState.isMarquee = false;
        removeMarqueeBox();

        const x1 = Math.min(multiSelectionState.marqueeStartWorld.x, worldPos.x);
        const x2 = Math.max(multiSelectionState.marqueeStartWorld.x, worldPos.x);
        const y1 = Math.min(multiSelectionState.marqueeStartWorld.y, worldPos.y);
        const y2 = Math.max(multiSelectionState.marqueeStartWorld.y, worldPos.y);

        // Select intersecting tokens
        ctx.map.tokens.forEach((t) => {
          const sz = t.size || 44;
          if (t.x >= x1 - sz && t.x <= x2 && t.y >= y1 - sz && t.y <= y2) {
            multiSelectionState.selectedTokenIds.add(t.id);
          }
        });

        // Select intersecting POIs
        ctx.map.pois.forEach((p) => {
          const sz = p.size || 36;
          if (p.x >= x1 - sz && p.x <= x2 && p.y >= y1 - sz && p.y <= y2) {
            multiSelectionState.selectedPoiIds.add(p.id);
          }
        });

        // Select cell bounds if cell map
        if (ctx.map.cellMap) {
          const cellSize = ctx.map.cellMap.cellSizePx || 48;
          const minCell = worldToCell(x1, y1, cellSize);
          const maxCell = worldToCell(x2, y2, cellSize);
          if (Math.abs(x2 - x1) >= cellSize || Math.abs(y2 - y1) >= cellSize) {
            multiSelectionState.cellBounds = {
              minCellX: minCell.cellX,
              minCellY: minCell.cellY,
              maxCellX: maxCell.cellX,
              maxCellY: maxCell.cellY,
            };
          }
        }

        updateSelectionDOM();
      }
    },

    renderOptions: (el, ctx, refresh) => {
      renderSelectionToolbar(el, ctx, refresh);
    },
  });
}

function renderMarqueeBox(
  containerEl: HTMLElement,
  start: { x: number; y: number },
  current: { x: number; y: number },
  viewport: { x: number; y: number; scale: number }
): void {
  let box = containerEl.querySelector('.dte-marquee-overlay') as HTMLElement | null;
  if (!box) {
    box = containerEl.createDiv({ cls: 'dte-marquee-overlay' });
  }

  const minX = Math.min(start.x, current.x);
  const minY = Math.min(start.y, current.y);
  const w = Math.abs(current.x - start.x);
  const h = Math.abs(current.y - start.y);

  box.style.left = `${minX}px`;
  box.style.top = `${minY}px`;
  box.style.width = `${w}px`;
  box.style.height = `${h}px`;
}

function removeMarqueeBox(): void {
  const box = document.querySelector('.dte-marquee-overlay');
  if (box) box.remove();
}

function renderGhostPreview(
  containerEl: HTMLElement,
  map: MapData,
  worldPos: { x: number; y: number },
  viewport: { x: number; y: number; scale: number }
): void {
  let ghost = containerEl.querySelector('.dte-ghost-preview') as HTMLElement | null;
  const clip = multiSelectionState.clipboard;
  if (!clip) {
    if (ghost) ghost.remove();
    return;
  }

  if (!ghost) {
    ghost = containerEl.createDiv({ cls: 'dte-ghost-preview' });
  }

  const dx = worldPos.x - clip.origin.x;
  const dy = worldPos.y - clip.origin.y;

  ghost.empty();

  clip.tokens.forEach((t) => {
    const itemEl = ghost!.createDiv({ cls: 'dte-token is-ghost-item' });
    itemEl.style.left = `${t.x + dx}px`;
    itemEl.style.top = `${t.y + dy}px`;
    itemEl.style.width = `${t.size || 44}px`;
    itemEl.style.height = `${t.size || 44}px`;
    const circle = itemEl.createDiv({ cls: 'dte-token-circle' });
    circle.style.background = t.color || '#4c8bf5';
    circle.setText((t.name || '?').slice(0, 2).toUpperCase());
  });

  clip.pois.forEach((p) => {
    const itemEl = ghost!.createDiv({ cls: 'dte-poi is-ghost-item' });
    itemEl.style.left = `${p.x + dx}px`;
    itemEl.style.top = `${p.y + dy}px`;
    itemEl.style.width = `${p.size || 36}px`;
    itemEl.style.height = `${p.size || 36}px`;
    const mark = itemEl.createDiv({ cls: 'dte-poi-mark' });
    mark.setText('📍');
  });
}

function renderSelectionToolbar(el: HTMLElement, ctx: ToolContext, refresh: () => void): void {
  el.empty();
  const bar = el.createDiv({ cls: 'dte-selection-tools-bar' });

  // Snap to grid toggle
  const snapBtn = bar.createEl('button', {
    cls: `dte-btn dte-pill-btn ${multiSelectionState.snapToGrid ? 'mod-active' : ''}`,
    attr: { 'aria-label': 'Ajustar a cuadrícula' },
  });
  const snapIcon = snapBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
  setIcon(snapIcon, 'grid');
  snapBtn.createSpan({ text: 'Ajustar' });
  snapBtn.addEventListener('click', () => {
    multiSelectionState.snapToGrid = !multiSelectionState.snapToGrid;
    refresh();
  });

  // Select all button
  const allBtn = bar.createEl('button', {
    cls: 'dte-btn dte-pill-btn',
    attr: { 'aria-label': 'Seleccionar todo (Ctrl+A)' },
  });
  allBtn.createSpan({ text: 'Todo (Ctrl+A)' });
  allBtn.addEventListener('click', () => {
    selectAll(ctx.map);
  });

  if (hasSelection()) {
    // Copy button
    const copyBtn = bar.createEl('button', {
      cls: 'dte-btn dte-pill-btn',
      attr: { 'aria-label': 'Copiar (Ctrl+C)' },
    });
    const copyIcon = copyBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(copyIcon, 'copy');
    copyBtn.createSpan({ text: 'Copiar' });
    copyBtn.addEventListener('click', () => {
      copySelection(ctx.map, ctx.mapId, ctx.view.plugin);
    });

    // Delete button
    const delBtn = bar.createEl('button', {
      cls: 'dte-btn dte-pill-btn mod-warning',
      attr: { 'aria-label': 'Eliminar seleccionados (Supr)' },
    });
    const delIcon = delBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(delIcon, 'trash');
    delBtn.createSpan({ text: 'Eliminar' });
    delBtn.addEventListener('click', async () => {
      await deleteSelection(ctx.map, ctx.mapId, ctx.view.plugin, ctx.view);
    });

    // Paint selected cells button
    if (multiSelectionState.cellBounds && ctx.map.cellMap) {
      const paintCellsBtn = bar.createEl('button', {
        cls: 'dte-btn dte-pill-btn',
        attr: { 'aria-label': 'Pintar celdas seleccionadas con el color activo' },
      });
      const paintIcon = paintCellsBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
      setIcon(paintIcon, 'paint-bucket');
      paintCellsBtn.createSpan({ text: 'Pintar celdas' });
      paintCellsBtn.addEventListener('click', () => {
        paintSelectedCells(ctx);
        refresh();
      });
    }
  }

  // Paste button if clipboard available
  if (multiSelectionState.clipboard) {
    const pasteBtn = bar.createEl('button', {
      cls: `dte-btn dte-pill-btn ${multiSelectionState.isPasting ? 'mod-active' : ''}`,
      attr: { 'aria-label': 'Pegar (Ctrl+V) — Haz clic en el mapa para colocar' },
    });
    const pasteIcon = pasteBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(pasteIcon, 'clipboard');
    pasteBtn.createSpan({ text: multiSelectionState.isPasting ? 'Colocar...' : 'Pegar' });
    pasteBtn.addEventListener('click', () => {
      multiSelectionState.isPasting = !multiSelectionState.isPasting;
      refresh();
    });
  }
}

export function paintSelectedCells(ctx: ToolContext): void {
  if (!multiSelectionState.cellBounds || !ctx.map.cellMap) return;
  const store = getCellStore(ctx.mapId, ctx.view.plugin);
  const colorIdx = cellToolState.activeColorIndex;
  const changes: Array<{ cellX: number; cellY: number; before: number; after: number }> = [];

  for (let cy = multiSelectionState.cellBounds.minCellY; cy <= multiSelectionState.cellBounds.maxCellY; cy++) {
    for (let cx = multiSelectionState.cellBounds.minCellX; cx <= multiSelectionState.cellBounds.maxCellX; cx++) {
      const before = store.getCell(cx, cy);
      if (before !== colorIdx) {
        store.setCell(cx, cy, colorIdx);
        changes.push({ cellX: cx, cellY: cy, before, after: colorIdx });
      }
    }
  }

  if (changes.length > 0) {
    if (ctx.view?.requestRender) ctx.view.requestRender();

    const mapId = ctx.mapId;
    const plugin = ctx.view.plugin;
    const undoStep: UndoStep = {
      label: 'Pintar celdas seleccionadas',
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
    new Notice(`${changes.length} celdas pintadas`);
  }
}
