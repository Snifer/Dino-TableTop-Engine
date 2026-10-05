import { EngineModule } from './types';
import {
  MapData,
  MapGridConfig,
  MapRuler,
  MeasureUnit,
  DiagonalRule,
} from '../types';
import { clamp, genId } from '../utils';
import { getGridDimensions } from '../grid';
import { t } from '../i18n';
import { Menu, setIcon } from 'obsidian';
import { GridConfigModal } from '../modals/GridConfigModal';
import { getArc } from './wargame';

export const MM_PER_UNIT: Record<MeasureUnit, number> = {
  in: 25.4,
  cm: 10,
  m: 1000,
};

export interface MeasurementResult {
  cells: number;
  mm: number;
  inVal: string;
  cmVal: string;
  mVal: string;
  cellsVal: string;
  summary: string;
}

/**
 * Calculates distance in cells and canonical millimeters.
 */
export function calculateDistance(
  fromPx: { x: number; y: number },
  toPx: { x: number; y: number },
  grid: MapGridConfig | undefined,
  kind: 'line' | 'radius'
): MeasurementResult {
  const cellSizePx = (grid && (grid.cellSizePx || grid.cellSize)) || 50;
  const cellRealSize = (grid && grid.cellRealSize) || 1.5;
  const unit: MeasureUnit = (grid && grid.unit) || 'm';
  const diagonalRule: DiagonalRule = (grid && grid.diagonalRule) || 'alternating';

  const dxPx = Math.abs(toPx.x - fromPx.x);
  const dyPx = Math.abs(toPx.y - fromPx.y);

  const dxCells = dxPx / cellSizePx;
  const dyCells = dyPx / cellSizePx;

  let cells = 0;
  if (kind === 'radius') {
    cells = Math.sqrt(dxCells * dxCells + dyCells * dyCells);
  } else {
    const minD = Math.min(dxCells, dyCells);
    const maxD = Math.max(dxCells, dyCells);

    switch (diagonalRule) {
      case 'euclidean':
        cells = Math.sqrt(dxCells * dxCells + dyCells * dyCells);
        break;
      case 'chebyshev':
        cells = maxD;
        break;
      case 'manhattan':
        cells = dxCells + dyCells;
        break;
      case 'alternating':
        cells = maxD + Math.floor(minD / 2);
        break;
      case 'diagonal1_5':
        cells = (maxD - minD) + minD * 1.5;
        break;
      default:
        cells = Math.sqrt(dxCells * dxCells + dyCells * dyCells);
    }
  }

  const mmPerCell = cellRealSize * (MM_PER_UNIT[unit] || 1000);
  const mm = cells * mmPerCell;

  const inVal = (mm / MM_PER_UNIT.in).toFixed(1);
  const cmVal = (mm / MM_PER_UNIT.cm).toFixed(1);
  const mVal = (mm / MM_PER_UNIT.m).toFixed(2);
  const cellsVal = (Math.round(cells * 10) / 10).toString();

  const cellUnitLabel = cellsVal === '1' ? t('measure.cellSingular') : t('measure.cellPlural');

  // Format with the primary configured unit first
  let primaryTxt = `${mVal} m`;
  let secondaryTxt = `${cmVal} cm · ${inVal} in`;
  if (unit === 'in') {
    primaryTxt = `${inVal} in`;
    secondaryTxt = `${mVal} m · ${cmVal} cm`;
  } else if (unit === 'cm') {
    primaryTxt = `${cmVal} cm`;
    secondaryTxt = `${mVal} m · ${inVal} in`;
  }

  const summary = `${cellsVal} ${cellUnitLabel} · ${primaryTxt} (${secondaryTxt})`;

  return {
    cells,
    mm,
    inVal,
    cmVal,
    mVal,
    cellsVal,
    summary,
  };
}

/**
 * If measuring originates near a wargame model, calculates the target arc.
 */
export function getWargameArcPrefix(
  map: MapData,
  fromPct: { x: number; y: number },
  toPct: { x: number; y: number },
  width: number,
  height: number
): string {
  if (!map.wargame || !map.wargame.enabled || !map.wargame.units) return '';
  const fromPx = { x: (fromPct.x / 100) * width, y: (fromPct.y / 100) * height };
  const toPx = { x: (toPct.x / 100) * width, y: (toPct.y / 100) * height };

  for (const unit of map.wargame.units) {
    const baseRadius = (unit.baseSizePx || 36) / 2;
    for (const model of unit.models) {
      const mPx = { x: (model.x / 100) * width, y: (model.y / 100) * height };
      const dx = fromPx.x - mPx.x;
      const dy = fromPx.y - mPx.y;
      if (Math.sqrt(dx * dx + dy * dy) <= baseRadius + 10) {
        const rad = Math.atan2(toPx.y - mPx.y, toPx.x - mPx.x);
        let deg = (rad * 180) / Math.PI + 90;
        deg = ((deg % 360) + 360) % 360;
        const arc = getArc(model.facing || 0, deg, unit.arcs);
        const arcKey =
          arc === 'front'
            ? 'wargame.arcFrontLabel'
            : arc === 'flank-right'
            ? 'wargame.arcFlankRightLabel'
            : arc === 'flank-left'
            ? 'wargame.arcFlankLeftLabel'
            : 'wargame.arcRearLabel';
        return `[${t(arcKey as any)}] `;
      }
    }
  }
  return '';
}

export class MeasureManager {
  private view: any;
  active: boolean = false;
  mode: 'line' | 'radius' = 'line';
  private isMeasuring: boolean = false;
  private startPct: { x: number; y: number } | null = null;
  private currentPct: { x: number; y: number } | null = null;
  private pendingRuler: {
    kind: 'line' | 'radius';
    from: { x: number; y: number };
    to: { x: number; y: number };
    result: MeasurementResult;
  } | null = null;

  // Calibration state
  isCalibrating: boolean = false;
  private calibrateStep: 1 | 2 = 1;
  private calibratePt1: { x: number; y: number } | null = null;

  constructor(view: any) {
    this.view = view;
  }

  toggleActive(): void {
    this.active = !this.active;
    if (!this.active) {
      this.pendingRuler = null;
      this.isCalibrating = false;
    }
    this.view.render();
  }

  setMode(mode: 'line' | 'radius'): void {
    this.mode = mode;
    this.pendingRuler = null;
    this.view.render();
  }

  clearPending(): void {
    this.pendingRuler = null;
    this.updateOverlay();
  }

  startCalibration(): void {
    this.isCalibrating = true;
    this.calibrateStep = 1;
    this.calibratePt1 = null;
    this.active = true;
    this.pendingRuler = null;
    this.view.render();
  }

  attachBoardListeners(boardInner: HTMLElement, map: MapData): void {
    // Render pinned persistent rulers
    this.renderPinnedRulers(boardInner, map);

    if (!this.active) return;

    boardInner.addClass('dte-measuring-cursor');

    const handlePointerDown = (e: PointerEvent) => {
      // Left click only
      if (e.button !== 0) return;

      // Ignore clicks on tokens, pois, cards, buttons or badges
      const target = e.target as HTMLElement;
      if (
        target.closest('.dte-token') ||
        target.closest('.dte-poi') ||
        target.closest('.dte-card-on-table') ||
        target.closest('.dte-measure-badge') ||
        target.closest('.dte-ruler-badge')
      ) {
        return;
      }

      const boardRect = boardInner.getBoundingClientRect();
      if (boardRect.width <= 0 || boardRect.height <= 0) return;

      const xPct = clamp(((e.clientX - boardRect.left) / boardRect.width) * 100, 0, 100);
      const yPct = clamp(((e.clientY - boardRect.top) / boardRect.height) * 100, 0, 100);

      if (this.isCalibrating) {
        e.preventDefault();
        e.stopPropagation();
        if (this.calibrateStep === 1) {
          this.calibratePt1 = { x: xPct, y: yPct };
          this.calibrateStep = 2;
          this.updateOverlay();
        } else {
          // Second click -> compute calibration
          const pt1 = this.calibratePt1!;
          const { width, height } = getGridDimensions(map, boardInner);
          const px1X = (pt1.x / 100) * width;
          const px1Y = (pt1.y / 100) * height;
          const px2X = (xPct / 100) * width;
          const px2Y = (yPct / 100) * height;

          const dx = Math.abs(px2X - px1X);
          const dy = Math.abs(px2Y - px1Y);
          const cellSizePx = Math.max(10, Math.round((dx + dy) / 2) || Math.round(dx) || 50);
          const offsetX = Math.round(Math.min(px1X, px2X) % cellSizePx);
          const offsetY = Math.round(Math.min(px1Y, px2Y) % cellSizePx);

          this.isCalibrating = false;
          this.calibrateStep = 1;
          this.calibratePt1 = null;

          if (!map.grid) {
            map.grid = {
              enabled: true,
              cellSizePx,
              offsetX,
              offsetY,
              cellRealSize: 1.5,
              unit: 'm',
              diagonalRule: 'alternating',
              showOverlay: true,
              color: '#ffffff',
              opacity: 0.35,
              thickness: 1,
              type: 'square',
              snapTokens: false,
            };
          } else {
            map.grid.cellSizePx = cellSizePx;
            map.grid.offsetX = offsetX;
            map.grid.offsetY = offsetY;
            map.grid.enabled = true;
            map.grid.showOverlay = true;
          }

          this.view.plugin.saveSettings();
          this.view.render();

          new GridConfigModal(this.view.app, map, (updated) => {
            map.grid = updated;
            this.view.plugin.saveSettings();
            this.view.render();
          }, () => this.startCalibration()).open();
        }
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      this.isMeasuring = true;
      this.startPct = { x: xPct, y: yPct };
      this.currentPct = { x: xPct, y: yPct };
      this.pendingRuler = null;

      boardInner.setPointerCapture(e.pointerId);
      this.updateOverlay();
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!this.isMeasuring || !this.startPct) return;
      const boardRect = boardInner.getBoundingClientRect();
      const xPct = clamp(((e.clientX - boardRect.left) / boardRect.width) * 100, 0, 100);
      const yPct = clamp(((e.clientY - boardRect.top) / boardRect.height) * 100, 0, 100);
      this.currentPct = { x: xPct, y: yPct };
      this.updateOverlay();
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!this.isMeasuring || !this.startPct) return;
      this.isMeasuring = false;
      try {
        boardInner.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* noop */
      }

      const boardRect = boardInner.getBoundingClientRect();
      const xPct = clamp(((e.clientX - boardRect.left) / boardRect.width) * 100, 0, 100);
      const yPct = clamp(((e.clientY - boardRect.top) / boardRect.height) * 100, 0, 100);
      this.currentPct = { x: xPct, y: yPct };

      const { width, height } = getGridDimensions(map, boardInner);
      const pxFrom = { x: (this.startPct.x / 100) * width, y: (this.startPct.y / 100) * height };
      const pxTo = { x: (this.currentPct.x / 100) * width, y: (this.currentPct.y / 100) * height };

      const res = calculateDistance(pxFrom, pxTo, map.grid, this.mode);
      const arcPrefix = getWargameArcPrefix(map, this.startPct, this.currentPct, width, height);
      if (arcPrefix) {
        res.summary = `${arcPrefix}${res.summary}`;
      }

      this.pendingRuler = {
        kind: this.mode,
        from: { ...this.startPct },
        to: { ...this.currentPct },
        result: res,
      };

      this.startPct = null;
      this.currentPct = null;
      this.updateOverlay();
    };

    boardInner.addEventListener('pointerdown', handlePointerDown);
    boardInner.addEventListener('pointermove', handlePointerMove);
    boardInner.addEventListener('pointerup', handlePointerUp);
    boardInner.addEventListener('pointercancel', handlePointerUp);
  }

  private updateOverlay(): void {
    const boardInner = this.view.containerEl.querySelector('.dte-board-inner') as HTMLElement | null;
    if (!boardInner) return;

    // Remove existing active measure elements
    boardInner.querySelectorAll('.dte-measure-layer, .dte-measure-badge').forEach((el) => el.remove());

    const map = this.view.getCurrentMap() as MapData | null;
    if (!map) return;

    const { width, height } = getGridDimensions(map, boardInner);
    if (width <= 0 || height <= 0) return;

    // 1. Calibrating hint
    if (this.isCalibrating) {
      const hint = boardInner.createDiv({ cls: 'dte-measure-badge dte-calibrate-hint' });
      hint.style.left = '50%';
      hint.style.top = '20px';
      hint.style.transform = 'translateX(-50%)';
      hint.setText(
        this.calibrateStep === 1
          ? t('measure.calibrateStep1')
          : t('measure.calibrateStep2')
      );
      return;
    }

    // 2. Active measuring stroke
    if (this.isMeasuring && this.startPct && this.currentPct) {
      const pxFrom = { x: (this.startPct.x / 100) * width, y: (this.startPct.y / 100) * height };
      const pxTo = { x: (this.currentPct.x / 100) * width, y: (this.currentPct.y / 100) * height };
      const res = calculateDistance(pxFrom, pxTo, map.grid, this.mode);
      const arcPrefix = getWargameArcPrefix(map, this.startPct, this.currentPct, width, height);

      this.drawMeasureShape(boardInner, width, height, this.mode, pxFrom, pxTo, '#4c8bf5', false);

      const badge = boardInner.createDiv({ cls: 'dte-measure-badge' });
      badge.style.left = this.currentPct.x + '%';
      badge.style.top = this.currentPct.y + '%';
      badge.setText(arcPrefix + res.summary);
      return;
    }

    // 3. Pending completed measurement (visible until dismissed or pinned)
    if (this.pendingRuler) {
      const r = this.pendingRuler;
      const pxFrom = { x: (r.from.x / 100) * width, y: (r.from.y / 100) * height };
      const pxTo = { x: (r.to.x / 100) * width, y: (r.to.y / 100) * height };

      this.drawMeasureShape(boardInner, width, height, r.kind, pxFrom, pxTo, '#e91e63', true);

      const badge = boardInner.createDiv({ cls: 'dte-measure-badge dte-measure-badge-pending' });
      badge.style.left = r.to.x + '%';
      badge.style.top = r.to.y + '%';

      const label = badge.createSpan({ text: r.result.summary });

      // Pin button
      const pinBtn = badge.createEl('button', {
        cls: 'clickable-icon dte-btn-icon-mini',
        attr: { 'aria-label': t('measure.pinRuler') },
      });
      setIcon(pinBtn, 'pin');
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!map.rulers) map.rulers = [];
        const ruler: MapRuler = {
          id: genId(),
          kind: r.kind,
          from: { ...r.from },
          to: { ...r.to },
          distanceMm: r.result.mm,
          color: '#e91e63',
          label: r.result.summary,
        };
        map.rulers.push(ruler);
        this.pendingRuler = null;
        this.view.plugin.saveSettings();
        this.view.render();
      });

      // Close button
      const closeBtn = badge.createEl('button', {
        cls: 'clickable-icon dte-btn-icon-mini',
        attr: { 'aria-label': t('common.close') },
      });
      setIcon(closeBtn, 'x');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pendingRuler = null;
        this.updateOverlay();
      });
    }
  }

  private drawMeasureShape(
    boardInner: HTMLElement,
    width: number,
    height: number,
    kind: 'line' | 'radius',
    fromPx: { x: number; y: number },
    toPx: { x: number; y: number },
    color: string,
    isDashed: boolean
  ): void {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'dte-measure-layer');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '4';

    if (kind === 'line') {
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', String(fromPx.x));
      line.setAttribute('y1', String(fromPx.y));
      line.setAttribute('x2', String(toPx.x));
      line.setAttribute('y2', String(toPx.y));
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '3');
      if (isDashed) line.setAttribute('stroke-dasharray', '6 4');
      svg.appendChild(line);

      // Start dot
      const dot1 = document.createElementNS(svgNS, 'circle');
      dot1.setAttribute('cx', String(fromPx.x));
      dot1.setAttribute('cy', String(fromPx.y));
      dot1.setAttribute('r', '5');
      dot1.setAttribute('fill', color);
      svg.appendChild(dot1);

      // End dot
      const dot2 = document.createElementNS(svgNS, 'circle');
      dot2.setAttribute('cx', String(toPx.x));
      dot2.setAttribute('cy', String(toPx.y));
      dot2.setAttribute('r', '5');
      dot2.setAttribute('fill', color);
      svg.appendChild(dot2);
    } else {
      // Radius circle
      const dx = toPx.x - fromPx.x;
      const dy = toPx.y - fromPx.y;
      const radius = Math.sqrt(dx * dx + dy * dy);

      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', String(fromPx.x));
      circle.setAttribute('cy', String(fromPx.y));
      circle.setAttribute('r', String(radius));
      circle.setAttribute('stroke', color);
      circle.setAttribute('stroke-width', '2.5');
      circle.setAttribute('fill', color);
      circle.setAttribute('fill-opacity', '0.12');
      if (isDashed) circle.setAttribute('stroke-dasharray', '6 4');
      svg.appendChild(circle);

      // Radius line from center to cursor
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', String(fromPx.x));
      line.setAttribute('y1', String(fromPx.y));
      line.setAttribute('x2', String(toPx.x));
      line.setAttribute('y2', String(toPx.y));
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '4 4');
      svg.appendChild(line);

      // Center dot
      const dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', String(fromPx.x));
      dot.setAttribute('cy', String(fromPx.y));
      dot.setAttribute('r', '4');
      dot.setAttribute('fill', color);
      svg.appendChild(dot);
    }

    boardInner.appendChild(svg);
  }

  private renderPinnedRulers(boardInner: HTMLElement, map: MapData): void {
    boardInner.querySelectorAll('.dte-pinned-rulers-layer, .dte-ruler-badge').forEach((el) => el.remove());

    if (!map.rulers || map.rulers.length === 0) return;

    const { width, height } = getGridDimensions(map, boardInner);
    if (width <= 0 || height <= 0) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'dte-pinned-rulers-layer');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '3';

    for (const ruler of map.rulers) {
      const pxFrom = { x: (ruler.from.x / 100) * width, y: (ruler.from.y / 100) * height };
      const pxTo = { x: (ruler.to.x / 100) * width, y: (ruler.to.y / 100) * height };
      const color = ruler.color || '#ff9800';

      if (ruler.kind === 'line') {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', String(pxFrom.x));
        line.setAttribute('y1', String(pxFrom.y));
        line.setAttribute('x2', String(pxTo.x));
        line.setAttribute('y2', String(pxTo.y));
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '2.5');
        line.setAttribute('stroke-dasharray', '5 3');
        svg.appendChild(line);

        const dot1 = document.createElementNS(svgNS, 'circle');
        dot1.setAttribute('cx', String(pxFrom.x));
        dot1.setAttribute('cy', String(pxFrom.y));
        dot1.setAttribute('r', '4');
        dot1.setAttribute('fill', color);
        svg.appendChild(dot1);
      } else {
        const dx = pxTo.x - pxFrom.x;
        const dy = pxTo.y - pxFrom.y;
        const radius = Math.sqrt(dx * dx + dy * dy);

        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', String(pxFrom.x));
        circle.setAttribute('cy', String(pxFrom.y));
        circle.setAttribute('r', String(radius));
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('fill', color);
        circle.setAttribute('fill-opacity', '0.08');
        circle.setAttribute('stroke-dasharray', '5 3');
        svg.appendChild(circle);
      }

      // Render pinned badge
      const badge = boardInner.createDiv({ cls: 'dte-ruler-badge' });
      badge.style.left = ruler.to.x + '%';
      badge.style.top = ruler.to.y + '%';
      badge.style.borderColor = color;
      badge.setText(`📌 ${ruler.label || ''}`);

      badge.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const menu = new Menu();
        menu.addItem((item) =>
          item
            .setTitle(t('measure.deleteRuler'))
            .setIcon('trash')
            .setWarning(true)
            .onClick(() => {
              if (!confirm(t('measure.deleteRulerConfirm'))) return;
              map.rulers = (map.rulers || []).filter((r) => r.id !== ruler.id);
              this.view.plugin.saveSettings();
              this.view.render();
            })
        );
        menu.showAtMouseEvent(e);
      });
    }

    boardInner.appendChild(svg);
  }
}

export const MeasureModule: EngineModule = {
  id: 'measure',
  nameKey: 'modules.measureName',
  descKey: 'modules.measureDesc',
  icon: 'ruler',
  defaultEnabled: true,
  renderToolbarButton(container: HTMLElement, view: any): void {
    const map = view.getCurrentMap();
    if (!map) return;

    if (!view.measureManager) {
      view.measureManager = new MeasureManager(view);
    }
    const mgr: MeasureManager = view.measureManager;

    const measureBtn = container.createEl('button', {
      cls: 'dte-btn' + (mgr.active ? ' mod-active' : ''),
      text: t('measure.btnMeasure'),
    });
    const rulerIcon = measureBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(rulerIcon, 'ruler');
    measureBtn.prepend(rulerIcon);
    measureBtn.addEventListener('click', () => {
      mgr.toggleActive();
    });

    if (mgr.active) {
      // Mode selector: Line vs Radius
      const modeGroup = container.createDiv({ cls: 'dte-segmented-group' });

      const lineBtn = modeGroup.createEl('button', {
        cls: 'dte-btn dte-btn-segment' + (mgr.mode === 'line' ? ' mod-active' : ''),
        text: t('measure.modeLine'),
      });
      lineBtn.addEventListener('click', () => mgr.setMode('line'));

      const radiusBtn = modeGroup.createEl('button', {
        cls: 'dte-btn dte-btn-segment' + (mgr.mode === 'radius' ? ' mod-active' : ''),
        text: t('measure.modeRadius'),
      });
      radiusBtn.addEventListener('click', () => mgr.setMode('radius'));

      // Quick Grid Calibration / Config modal button
      const gridBtn = container.createEl('button', {
        cls: 'clickable-icon dte-btn-icon',
        attr: { 'aria-label': t('grid.modalTitle') },
      });
      setIcon(gridBtn, 'grid');
      gridBtn.addEventListener('click', () => {
        new GridConfigModal(
          view.app,
          map,
          (config) => {
            map.grid = config;
            view.plugin.saveSettings();
            view.render();
          },
          () => mgr.startCalibration()
        ).open();
      });
    }
  },
};
