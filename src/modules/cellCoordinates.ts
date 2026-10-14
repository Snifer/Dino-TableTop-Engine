import { MapData, ViewportState } from '../types';

/**
 * Converts stored entity position (percent or world pixel) to CSS properties.
 */
export function toCss(
  map: MapData | undefined | null,
  entity: { x: number; y: number; size?: number },
  viewport?: ViewportState
): { left: string; top: string; transform?: string } {
  const isWorld = map?.coordSpace === 'world' || !!map?.cellMap;

  if (isWorld) {
    return {
      left: `${entity.x}px`,
      top: `${entity.y}px`,
    };
  }

  // Legacy percent mode (0-100)
  return {
    left: `${entity.x}%`,
    top: `${entity.y}%`,
  };
}

/**
 * Converts a pointer event (mouse/pointer/touch) to map coordinates (percent or world pixels).
 */
export function fromPointer(
  map: MapData | undefined | null,
  event: MouseEvent | PointerEvent | TouchEvent,
  containerEl: HTMLElement,
  viewport: ViewportState = { x: 0, y: 0, scale: 1 }
): { x: number; y: number } {
  const rect = containerEl.getBoundingClientRect();
  const clientX = 'touches' in event && event.touches.length > 0 ? event.touches[0].clientX : (event as MouseEvent).clientX;
  const clientY = 'touches' in event && event.touches.length > 0 ? event.touches[0].clientY : (event as MouseEvent).clientY;

  const relX = clientX - rect.left;
  const relY = clientY - rect.top;

  const isWorld = map?.coordSpace === 'world' || !!map?.cellMap;

  if (isWorld) {
    const scale = viewport.scale || 1;
    const worldX = (relX - (viewport.x || 0)) / scale;
    const worldY = (relY - (viewport.y || 0)) / scale;
    return { x: worldX, y: worldY };
  }

  // Legacy percent mode (0-100)
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const px = (relX / width) * 100;
  const py = (relY / height) * 100;
  return {
    x: Math.max(0, Math.min(100, px)),
    y: Math.max(0, Math.min(100, py)),
  };
}

/**
 * Converts world pixel coordinates to grid cell coordinates.
 */
export function worldToCell(worldX: number, worldY: number, cellSizePx: number): { cellX: number; cellY: number } {
  const size = cellSizePx > 0 ? cellSizePx : 48;
  return {
    cellX: Math.floor(worldX / size),
    cellY: Math.floor(worldY / size),
  };
}

/**
 * Converts grid cell coordinates to world top-left pixel coordinates.
 */
export function cellToWorld(cellX: number, cellY: number, cellSizePx: number): { x: number; y: number } {
  const size = cellSizePx > 0 ? cellSizePx : 48;
  return {
    x: cellX * size,
    y: cellY * size,
  };
}

/**
 * Snaps world coordinate to nearest grid cell (top-left or center).
 */
export function snapWorldToCell(
  worldX: number,
  worldY: number,
  cellSizePx: number,
  center: boolean = false
): { x: number; y: number; cellX: number; cellY: number } {
  const size = cellSizePx > 0 ? cellSizePx : 48;
  const cellX = Math.floor(worldX / size);
  const cellY = Math.floor(worldY / size);

  if (center) {
    return {
      x: cellX * size + size / 2,
      y: cellY * size + size / 2,
      cellX,
      cellY,
    };
  }

  return {
    x: cellX * size,
    y: cellY * size,
    cellX,
    cellY,
  };
}
