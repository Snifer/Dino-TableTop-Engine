import { MapData, MapGridConfig, GridType, GridSizeMode, GridHexOrientation } from './types';
import { clamp } from './utils';

export function getDefaultGridConfig(): MapGridConfig {
  return {
    enabled: true,
    cellSizePx: 50,
    offsetX: 0,
    offsetY: 0,
    cellRealSize: 1.5,
    unit: 'm',
    diagonalRule: 'alternating',
    showOverlay: true,
    color: '#ffffff',
    opacity: 0.35,
    thickness: 1,
    type: 'square',
    snapTokens: false,
    hexOrientation: 'pointy',
    mode: 'cellSize',
    columns: 20,
    rows: 20,
    cellSize: 50,
  };
}

export function getGridDimensions(map: MapData, boardInner: HTMLElement): { width: number; height: number } {
  if (map.drawing) {
    return {
      width: map.drawing.width || 1000,
      height: map.drawing.height || 1000,
    };
  }

  const img = boardInner.querySelector('.dte-map-img') as HTMLImageElement | null;
  if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  }

  const rect = boardInner.getBoundingClientRect();
  return {
    width: Math.max(100, Math.round(rect.width) || 1000),
    height: Math.max(100, Math.round(rect.height) || 1000),
  };
}

/**
 * Generates an SVG path string for a square grid with offset support.
 */
function generateSquareGridPath(
  width: number,
  height: number,
  cellW: number,
  cellH: number,
  offsetX: number = 0,
  offsetY: number = 0
): string {
  const paths: string[] = [];
  
  const startX = ((offsetX % cellW) + cellW) % cellW;
  const startY = ((offsetY % cellH) + cellH) % cellH;

  // Vertical lines
  for (let x = startX; x < width; x += cellW) {
    const rx = Math.round(x * 10) / 10;
    paths.push(`M ${rx} 0 L ${rx} ${height}`);
  }
  paths.push(`M ${width} 0 L ${width} ${height}`);

  // Horizontal lines
  for (let y = startY; y < height; y += cellH) {
    const ry = Math.round(y * 10) / 10;
    paths.push(`M 0 ${ry} L ${width} ${ry}`);
  }
  paths.push(`M 0 ${height} L ${width} ${height}`);

  return paths.join(' ');
}

/**
 * Generates an SVG path string for a hexagonal grid (pointy or flat topped).
 */
function generateHexGridPath(
  width: number,
  height: number,
  radius: number,
  orientation: GridHexOrientation = 'pointy',
  offsetX: number = 0,
  offsetY: number = 0
): string {
  const paths: string[] = [];
  const visitedEdges = new Set<string>();

  const addEdge = (x1: number, y1: number, x2: number, y2: number) => {
    const p1 = `${Math.round(x1 * 10) / 10},${Math.round(y1 * 10) / 10}`;
    const p2 = `${Math.round(x2 * 10) / 10},${Math.round(y2 * 10) / 10}`;
    const key = p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
    if (!visitedEdges.has(key)) {
      visitedEdges.add(key);
      paths.push(`M ${p1.replace(',', ' ')} L ${p2.replace(',', ' ')}`);
    }
  };

  if (orientation === 'pointy') {
    const hexW = Math.sqrt(3) * radius;
    const hexH = 2 * radius;
    const horizSpacing = hexW;
    const vertSpacing = hexH * 0.75;

    const cols = Math.ceil(width / horizSpacing) + 2;
    const rows = Math.ceil(height / vertSpacing) + 2;

    for (let r = -1; r < rows; r++) {
      const rowOffset = (r % 2 !== 0) ? hexW / 2 : 0;
      for (let c = -1; c < cols; c++) {
        const cx = c * horizSpacing + rowOffset + offsetX;
        const cy = r * vertSpacing + radius + offsetY;

        const pts: [number, number][] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 180) * (60 * i - 30);
          pts.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
        }
        for (let i = 0; i < 6; i++) {
          const [x1, y1] = pts[i];
          const [x2, y2] = pts[(i + 1) % 6];
          addEdge(x1, y1, x2, y2);
        }
      }
    }
  } else {
    const hexW = 2 * radius;
    const hexH = Math.sqrt(3) * radius;
    const horizSpacing = hexW * 0.75;
    const vertSpacing = hexH;

    const cols = Math.ceil(width / horizSpacing) + 2;
    const rows = Math.ceil(height / vertSpacing) + 2;

    for (let c = -1; c < cols; c++) {
      const colOffset = (c % 2 !== 0) ? hexH / 2 : 0;
      for (let r = -1; r < rows; r++) {
        const cx = c * horizSpacing + radius + offsetX;
        const cy = r * vertSpacing + colOffset + offsetY;

        const pts: [number, number][] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 180) * (60 * i);
          pts.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
        }
        for (let i = 0; i < 6; i++) {
          const [x1, y1] = pts[i];
          const [x2, y2] = pts[(i + 1) % 6];
          addEdge(x1, y1, x2, y2);
        }
      }
    }
  }

  return paths.join(' ');
}

/**
 * Calculates effective cell dimensions (and radius for hex).
 */
export function calculateGridMetrics(
  config: MapGridConfig,
  width: number,
  height: number
): { cellW: number; cellH: number; hexRadius: number } {
  let cellW = 50;
  let cellH = 50;
  let hexRadius = 30;

  const rawCellSize = config.cellSizePx || config.cellSize || 50;

  if (config.type === 'square' || !config.type) {
    if (config.mode === 'count' && config.columns && config.columns > 0) {
      cellW = width / config.columns;
      const rows = config.rows && config.rows > 0 ? config.rows : Math.round(height / cellW) || 1;
      cellH = height / rows;
    } else {
      cellW = Math.max(10, rawCellSize);
      cellH = cellW;
    }
  } else {
    // Hexagonal
    const orientation = config.hexOrientation || 'pointy';
    if (config.mode === 'count' && config.columns && config.columns > 0) {
      if (orientation === 'pointy') {
        hexRadius = width / (config.columns * Math.sqrt(3));
      } else {
        hexRadius = width / (config.columns * 1.5);
      }
      cellW = hexRadius * 2;
      cellH = hexRadius * 2;
    } else {
      const size = Math.max(10, rawCellSize);
      hexRadius = orientation === 'pointy' ? size / Math.sqrt(3) : size / 2;
      cellW = size;
      cellH = size;
    }
  }

  return { cellW, cellH, hexRadius };
}

/**
 * Renders or updates the SVG grid layer over the map.
 */
export function renderGridLayer(boardInner: HTMLElement, map: MapData): void {
  // Remove existing grid layer
  const oldGrid = boardInner.querySelector('.dte-grid-layer');
  if (oldGrid) oldGrid.remove();

  if (!map.grid || !map.grid.enabled || map.grid.showOverlay === false) return;

  const config = map.grid;
  const imgEl = boardInner.querySelector('.dte-map-img') as HTMLImageElement | null;

  // If image is still loading, wait for it so natural dimensions are exact
  if (imgEl && imgEl.naturalWidth === 0 && !imgEl.complete) {
    imgEl.addEventListener('load', () => {
      renderGridLayer(boardInner, map);
    }, { once: true });
    return;
  }

  const { width, height } = getGridDimensions(map, boardInner);
  if (width <= 0 || height <= 0) return;

  const { cellW, cellH, hexRadius } = calculateGridMetrics(config, width, height);

  let pathData = '';
  if (config.type === 'square' || !config.type) {
    pathData = generateSquareGridPath(width, height, cellW, cellH, config.offsetX || 0, config.offsetY || 0);
  } else {
    pathData = generateHexGridPath(width, height, hexRadius, config.hexOrientation || 'pointy', config.offsetX || 0, config.offsetY || 0);
  }

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'dte-grid-layer');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '2';

  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', pathData);
  path.setAttribute('stroke', config.color || '#ffffff');
  path.setAttribute('stroke-width', String(config.thickness || 1));
  path.setAttribute('stroke-opacity', String(clamp(config.opacity ?? 0.35, 0.05, 1)));
  path.setAttribute('fill', 'none');

  svg.appendChild(path);
  boardInner.appendChild(svg);
}

/**
 * Snaps (xPct, yPct) percentage coordinates (0-100) to the nearest cell center.
 */
export function snapCoordsToGrid(
  xPct: number,
  yPct: number,
  map: MapData,
  boardInner: HTMLElement
): { x: number; y: number } {
  if (!map.grid || !map.grid.enabled || !map.grid.snapTokens) {
    return { x: xPct, y: yPct };
  }

  const config = map.grid;
  const { width, height } = getGridDimensions(map, boardInner);
  if (width <= 0 || height <= 0) return { x: xPct, y: yPct };

  const offX = config.offsetX || 0;
  const offY = config.offsetY || 0;

  const pxX = (xPct / 100) * width - offX;
  const pxY = (yPct / 100) * height - offY;

  const { cellW, cellH, hexRadius } = calculateGridMetrics(config, width, height);

  if (config.type === 'square' || !config.type) {
    const colIndex = Math.floor(pxX / cellW);
    const rowIndex = Math.floor(pxY / cellH);

    const centerX = (colIndex + 0.5) * cellW + offX;
    const centerY = (rowIndex + 0.5) * cellH + offY;

    const snapXPct = clamp((centerX / width) * 100, 0, 100);
    const snapYPct = clamp((centerY / height) * 100, 0, 100);

    return {
      x: Math.round(snapXPct * 100) / 100,
      y: Math.round(snapYPct * 100) / 100,
    };
  }

  // Hexagonal snap using axial/cube coordinate rounding
  const orientation = config.hexOrientation || 'pointy';
  const R = hexRadius;

  let centerPxX = pxX;
  let centerPxY = pxY;

  if (orientation === 'pointy') {
    const q = ((Math.sqrt(3) / 3) * pxX - (1 / 3) * (pxY - R)) / R;
    const r = ((2 / 3) * (pxY - R)) / R;
    const [rq, rr] = cubeRound(q, r, -q - r);

    centerPxX = R * (Math.sqrt(3) * rq + (Math.sqrt(3) / 2) * rr);
    centerPxY = R * (1.5 * rr) + R;
  } else {
    const q = ((2 / 3) * (pxX - R)) / R;
    const r = ((-1 / 3) * (pxX - R) + (Math.sqrt(3) / 3) * pxY) / R;
    const [rq, rr] = cubeRound(q, r, -q - r);

    centerPxX = R * (1.5 * rq) + R;
    centerPxY = R * ((Math.sqrt(3) / 2) * rq + Math.sqrt(3) * rr);
  }

  const finalX = centerPxX + offX;
  const finalY = centerPxY + offY;

  const snapXPct = clamp((finalX / width) * 100, 0, 100);
  const snapYPct = clamp((finalY / height) * 100, 0, 100);

  return {
    x: Math.round(snapXPct * 100) / 100,
    y: Math.round(snapYPct * 100) / 100,
  };
}

function cubeRound(fracQ: number, fracR: number, fracS: number): [number, number, number] {
  let q = Math.round(fracQ);
  let r = Math.round(fracR);
  let s = Math.round(fracS);

  const qDiff = Math.abs(q - fracQ);
  const rDiff = Math.abs(r - fracR);
  const sDiff = Math.abs(s - fracS);

  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  } else {
    s = -q - r;
  }

  return [q, r, s];
}
