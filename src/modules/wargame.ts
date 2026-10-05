import { App, Menu, Modal, Notice, Setting, setIcon, TFile } from 'obsidian';
import { EngineModule } from './types';
import {
  MapData,
  WargameMatchData,
  WargameSide,
  WargameUnitOnTable,
  WargameModel,
  WargameZone,
  WargameObjective,
  WargameArcs,
} from '../types';
import { clamp, genId } from '../utils';
import { getGridDimensions } from '../grid';
import { MM_PER_UNIT } from './measure';
import { t } from '../i18n';
import { WargameSetupModal } from '../modals/WargameSetupModal';
import { WargameRosterListModal } from '../modals/WargameRosterModals';
import { WargameWoundModal } from '../modals/WargameWoundModal';
import { NamePromptModal } from '../modals/NamePromptModal';

export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Pure function: calculates the firing/facing arc from a model to a target angle.
 */
export function getArc(
  modelFacing: number,
  targetAngle: number,
  arcs: WargameArcs = { front: 90, flank: 90, rear: 180 }
): 'front' | 'flank-right' | 'flank-left' | 'rear' {
  const rel = normalizeAngle(targetAngle - modelFacing);
  const halfFront = (arcs.front || 90) / 2;

  if (rel <= halfFront || rel >= 360 - halfFront) {
    return 'front';
  }

  const flankRightEnd = halfFront + (arcs.flank || 90);
  if (rel > halfFront && rel <= flankRightEnd) {
    return 'flank-right';
  }

  const flankLeftStart = 360 - halfFront - (arcs.flank || 90);
  if (rel < 360 - halfFront && rel >= flankLeftStart) {
    return 'flank-left';
  }

  return 'rear';
}

/**
 * Checks whether a model is farther from all fellow unit models than cohesionDistanceMm.
 */
export function isModelOutOfCohesion(
  model: WargameModel,
  unit: WargameUnitOnTable,
  map: MapData,
  boardWidth: number,
  boardHeight: number
): boolean {
  if (!unit.cohesionDistanceMm || unit.models.length <= 1) return false;

  const mPx = { x: (model.x / 100) * boardWidth, y: (model.y / 100) * boardHeight };
  const cellSizePx = (map.grid && (map.grid.cellSizePx || map.grid.cellSize)) || 50;
  const cellRealSize = (map.grid && map.grid.cellRealSize) || 1.5;
  const unitType = (map.grid && map.grid.unit) || 'm';
  const mmPerPx = (cellRealSize * (MM_PER_UNIT[unitType] || 1000)) / cellSizePx;

  let minDistanceMm = Infinity;
  for (const other of unit.models) {
    if (other.id === model.id) continue;
    const oPx = { x: (other.x / 100) * boardWidth, y: (other.y / 100) * boardHeight };
    const dx = oPx.x - mPx.x;
    const dy = oPx.y - mPx.y;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    const distMm = distPx * mmPerPx;
    if (distMm < minDistanceMm) minDistanceMm = distMm;
  }

  return minDistanceMm > unit.cohesionDistanceMm;
}

/**
 * Renders all wargame layers (Zones, Objectives, Models) on the board.
 */
export function renderWargameBoard(boardInner: HTMLElement, map: MapData, view: any): void {
  // Clean up previous wargame elements
  boardInner.querySelectorAll(
    '.dte-wargame-zones-layer, .dte-wargame-objective, .dte-wargame-model'
  ).forEach((el) => el.remove());

  if (!map.wargame || !map.wargame.enabled) return;

  const wargame = map.wargame;
  const { width, height } = getGridDimensions(map, boardInner);
  if (width <= 0 || height <= 0) return;

  // 1. Render Zones
  renderWargameZones(boardInner, map, width, height, view);

  // 2. Render Objectives
  renderWargameObjectives(boardInner, map, view);

  // 3. Render Models
  renderWargameModels(boardInner, map, width, height, view);
}

function renderWargameZones(
  boardInner: HTMLElement,
  map: MapData,
  width: number,
  height: number,
  view: any
): void {
  const wargame = map.wargame!;
  if (!wargame.zones || wargame.zones.length === 0) return;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'dte-wargame-zones-layer');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '1';

  for (const zone of wargame.zones) {
    const color = zone.color || '#10b981';
    const isTerrain = zone.kind === 'terrain';
    const opacity = isTerrain ? '0.18' : '0.12';
    const dashArray = isTerrain ? 'none' : '6 4';

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', 'dte-wargame-zone-group');
    g.style.pointerEvents = 'all';
    g.style.cursor = 'grab';

    let shapeEl: SVGElement | null = null;
    let labelEl: SVGTextElement | null = null;

    const updateSvg = () => {
      if (zone.shapeType === 'rect' && zone.points.length >= 2) {
        const p1 = zone.points[0];
        const p2 = zone.points[1];
        const x1 = (Math.min(p1.x, p2.x) / 100) * width;
        const y1 = (Math.min(p1.y, p2.y) / 100) * height;
        const w = (Math.abs(p2.x - p1.x) / 100) * width;
        const h = (Math.abs(p2.y - p1.y) / 100) * height;

        if (shapeEl) {
          shapeEl.setAttribute('x', String(x1));
          shapeEl.setAttribute('y', String(y1));
          shapeEl.setAttribute('width', String(w));
          shapeEl.setAttribute('height', String(h));
        }
        if (labelEl) {
          labelEl.setAttribute('x', String(x1 + 8));
          labelEl.setAttribute('y', String(y1 + 18));
          labelEl.textContent = zone.label || '';
        }
      } else if (zone.shapeType === 'circle' && zone.points.length >= 1) {
        const p1 = zone.points[0];
        const cx = (p1.x / 100) * width;
        const cy = (p1.y / 100) * height;
        let r = Math.min(width, height) * 0.08;

        if (zone.points.length >= 2) {
          const p2 = zone.points[1];
          const dx = ((p2.x - p1.x) / 100) * width;
          const dy = ((p2.y - p1.y) / 100) * height;
          r = Math.sqrt(dx * dx + dy * dy);
        }

        if (shapeEl) {
          shapeEl.setAttribute('cx', String(cx));
          shapeEl.setAttribute('cy', String(cy));
          shapeEl.setAttribute('r', String(Math.max(r, 10)));
        }
        if (labelEl) {
          labelEl.setAttribute('x', String(cx));
          labelEl.setAttribute('y', String(cy - r - 6));
          labelEl.textContent = zone.label || '';
        }
      } else if (zone.shapeType === 'polygon' && zone.points.length >= 3) {
        const pointsStr = zone.points
          .map((p) => `${(p.x / 100) * width},${(p.y / 100) * height}`)
          .join(' ');

        if (shapeEl) {
          shapeEl.setAttribute('points', pointsStr);
        }
        if (labelEl) {
          const p0 = zone.points[0];
          labelEl.setAttribute('x', String((p0.x / 100) * width + 6));
          labelEl.setAttribute('y', String((p0.y / 100) * height + 16));
          labelEl.textContent = zone.label || '';
        }
      }
    };

    if (zone.shapeType === 'rect' && zone.points.length >= 2) {
      shapeEl = document.createElementNS(svgNS, 'rect');
      labelEl = document.createElementNS(svgNS, 'text');
    } else if (zone.shapeType === 'circle' && zone.points.length >= 1) {
      shapeEl = document.createElementNS(svgNS, 'circle');
      labelEl = document.createElementNS(svgNS, 'text');
      labelEl.setAttribute('text-anchor', 'middle');
    } else if (zone.shapeType === 'polygon' && zone.points.length >= 3) {
      shapeEl = document.createElementNS(svgNS, 'polygon');
      labelEl = document.createElementNS(svgNS, 'text');
    }

    if (shapeEl && labelEl) {
      shapeEl.setAttribute('fill', color);
      shapeEl.setAttribute('fill-opacity', opacity);
      shapeEl.setAttribute('stroke', color);
      shapeEl.setAttribute('stroke-width', '2');
      shapeEl.setAttribute('stroke-dasharray', dashArray);
      g.appendChild(shapeEl);

      labelEl.setAttribute('fill', color);
      labelEl.setAttribute('font-size', '12');
      labelEl.setAttribute('font-weight', 'bold');
      g.appendChild(labelEl);

      updateSvg();
    }

    // Dragging support for moving zones
    let draggingZone = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let initialPoints: Array<{ x: number; y: number }> = [];

    g.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      draggingZone = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      initialPoints = zone.points.map((p) => ({ x: p.x, y: p.y }));
      g.style.cursor = 'grabbing';
      g.setPointerCapture(e.pointerId);
    });

    g.addEventListener('pointermove', (e: PointerEvent) => {
      if (!draggingZone) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;

      const boardRect = boardInner.getBoundingClientRect();
      const dxPct = (dx / boardRect.width) * 100;
      const dyPct = (dy / boardRect.height) * 100;

      zone.points = initialPoints.map((p) => ({
        x: clamp(p.x + dxPct, 0, 100),
        y: clamp(p.y + dyPct, 0, 100),
      }));

      updateSvg();
    });

    const endZoneDrag = (e: PointerEvent) => {
      if (!draggingZone) return;
      draggingZone = false;
      g.style.cursor = 'grab';
      try {
        g.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* noop */
      }
      if (moved) {
        view.plugin.saveSettings();
      }
    };

    g.addEventListener('pointerup', endZoneDrag);
    g.addEventListener('pointercancel', endZoneDrag);

    // Right-click contextmenu
    g.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const menu = new Menu();

      menu.addItem((item) =>
        item
          .setTitle(t('wargame.editZoneLabel'))
          .setIcon('pencil')
          .onClick(() => {
            new NamePromptModal(
              view.app,
              t('wargame.editZoneLabel'),
              zone.label,
              (newLabel) => {
                if (newLabel && newLabel.trim()) {
                  zone.label = newLabel.trim();
                  view.plugin.saveSettings();
                  view.render();
                }
              }
            ).open();
          })
      );

      if (zone.kind === 'terrain') {
        menu.addItem((item) =>
          item
            .setTitle(t('wargame.switchToDeployment'))
            .setIcon('flag')
            .onClick(() => {
              zone.kind = 'deployment';
              view.plugin.saveSettings();
              view.render();
            })
        );
      } else {
        menu.addItem((item) =>
          item
            .setTitle(t('wargame.switchToTerrain'))
            .setIcon('mountain')
            .onClick(() => {
              zone.kind = 'terrain';
              view.plugin.saveSettings();
              view.render();
            })
        );
      }

      menu.addSeparator();

      menu.addItem((item) =>
        item
          .setTitle(t('wargame.deleteZoneMenu'))
          .setIcon('trash')
          .setWarning(true)
          .onClick(() => {
            if (!confirm(t('wargame.deleteZoneConfirm', { name: zone.label }))) return;
            const idx = wargame.zones.indexOf(zone);
            if (idx >= 0) {
              wargame.zones.splice(idx, 1);
              view.plugin.saveSettings();
              view.render();
            }
          })
      );

      menu.showAtMouseEvent(e);
    });

    svg.appendChild(g);
  }

  boardInner.appendChild(svg);
}

function renderWargameObjectives(boardInner: HTMLElement, map: MapData, view: any): void {
  const wargame = map.wargame!;
  if (!wargame.objectives || wargame.objectives.length === 0) return;

  for (const obj of wargame.objectives) {
    const el = boardInner.createDiv({ cls: 'dte-wargame-objective' });
    el.style.left = obj.x + '%';
    el.style.top = obj.y + '%';

    const controlledSide = wargame.sides.find((s) => s.id === obj.controlledBy);
    if (controlledSide) {
      el.style.borderColor = controlledSide.color;
    }

    const flagIcon = el.createSpan({ cls: 'dte-obj-icon', text: '🚩' });
    const labelSpan = el.createSpan({ cls: 'dte-obj-label', text: obj.label });

    if (controlledSide) {
      const ownerSpan = el.createSpan({ cls: 'dte-obj-owner', text: `(${controlledSide.name})` });
      ownerSpan.style.color = controlledSide.color;
    }

    // Dragging
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;

    el.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;

      const boardRect = boardInner.getBoundingClientRect();
      const xPct = clamp(((e.clientX - boardRect.left) / boardRect.width) * 100, 0, 100);
      const yPct = clamp(((e.clientY - boardRect.top) / boardRect.height) * 100, 0, 100);
      obj.x = xPct;
      obj.y = yPct;
      el.style.left = xPct + '%';
      el.style.top = yPct + '%';
    });

    const endDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* noop */
      }
      if (moved) {
        view.plugin.saveSettings();
      }
    };

    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    // Right-click menu to assign control or delete
    el.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const menu = new Menu();

      // Assign control to side
      for (const side of wargame.sides) {
        menu.addItem((item) =>
          item
            .setTitle(t('wargame.assignControlTo', { side: side.name }))
            .setIcon('flag')
            .onClick(() => {
              obj.controlledBy = side.id;
              view.plugin.saveSettings();
              view.render();
            })
        );
      }

      menu.addItem((item) =>
        item
          .setTitle(t('wargame.clearControl'))
          .setIcon('x')
          .onClick(() => {
            obj.controlledBy = null;
            view.plugin.saveSettings();
            view.render();
          })
      );

      menu.addSeparator();

      menu.addItem((item) =>
        item
          .setTitle(t('wargame.deleteObjective'))
          .setIcon('trash')
          .setWarning(true)
          .onClick(() => {
            if (!confirm(t('wargame.deleteObjectiveConfirm', { name: obj.label }))) return;
            wargame.objectives = wargame.objectives.filter((o) => o.id !== obj.id);
            view.plugin.saveSettings();
            view.render();
          })
      );

      menu.showAtMouseEvent(e);
    });
  }
}

function renderWargameModels(
  boardInner: HTMLElement,
  map: MapData,
  width: number,
  height: number,
  view: any
): void {
  const wargame = map.wargame!;
  if (!wargame.units || wargame.units.length === 0) return;

  for (const unit of wargame.units) {
    const side = wargame.sides.find((s) => s.id === unit.sideId);
    const unitColor = unit.color || (side ? side.color : '#4c8bf5');
    const size = unit.baseSizePx || 36;

    for (let mIdx = 0; mIdx < unit.models.length; mIdx++) {
      const model = unit.models[mIdx];
      const isOutOfCohesion = isModelOutOfCohesion(model, unit, map, width, height);

      const el = boardInner.createDiv({ cls: 'dte-wargame-model' });
      if (isOutOfCohesion) el.addClass('dte-model-out-of-cohesion');

      el.style.left = model.x + '%';
      el.style.top = model.y + '%';
      el.style.width = size + 'px';
      el.style.height = size + 'px';

      // Model Circle
      const circle = el.createDiv({ cls: 'dte-wargame-model-circle' });
      circle.style.borderColor = unitColor;

      if (unit.imagePath) {
        const af = view.app.vault.getAbstractFileByPath(unit.imagePath);
        if (af instanceof TFile) {
          circle.style.backgroundImage = `url("${view.app.vault.getResourcePath(af)}")`;
          circle.style.backgroundSize = 'cover';
          circle.style.backgroundPosition = 'center';
        }
      } else {
        circle.style.background = unitColor;
        circle.setText((unit.name || '?').slice(0, 2).toUpperCase());
      }

      // Facing Arrow Indicator
      const facingIndicator = el.createDiv({ cls: 'dte-wargame-facing-indicator' });
      facingIndicator.style.transform = `translate(-50%, -50%) rotate(${model.facing || 0}deg)`;

      const arrow = facingIndicator.createDiv({ cls: 'dte-facing-arrow' });
      arrow.style.borderBottomColor = unitColor;

      // Rotation Handle on the rim
      const rotateHandle = facingIndicator.createDiv({ cls: 'dte-facing-rotate-handle' });

      // Wound bar
      const maxW = model.woundsMax || 1;
      const curW = clamp(model.woundsCurrent ?? maxW, 0, maxW);
      const ratio = curW / maxW;

      const barOuter = el.createDiv({ cls: 'dte-hpbar-outer dte-wounds-bar-outer' });
      const barInner = barOuter.createDiv({ cls: 'dte-hpbar-inner' });
      barInner.style.width = ratio * 100 + '%';
      barInner.style.background = ratio > 0.66 ? '#4caf50' : ratio > 0.33 ? '#ffc107' : '#f44336';

      // Dragging Model
      let draggingModel = false;
      let moved = false;
      let startX = 0;
      let startY = 0;

      el.addEventListener('pointerdown', (e: PointerEvent) => {
        // If clicking rotate handle, let handle take it
        if ((e.target as HTMLElement).closest('.dte-facing-rotate-handle')) return;
        if (e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();
        draggingModel = true;
        moved = false;
        startX = e.clientX;
        startY = e.clientY;
        el.setPointerCapture(e.pointerId);
      });

      el.addEventListener('pointermove', (e: PointerEvent) => {
        if (!draggingModel) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;

        const boardRect = boardInner.getBoundingClientRect();
        const xPct = clamp(((e.clientX - boardRect.left) / boardRect.width) * 100, 0, 100);
        const yPct = clamp(((e.clientY - boardRect.top) / boardRect.height) * 100, 0, 100);
        model.x = xPct;
        model.y = yPct;
        el.style.left = xPct + '%';
        el.style.top = yPct + '%';
      });

      const endModelDrag = (e: PointerEvent) => {
        if (!draggingModel) return;
        draggingModel = false;
        try {
          el.releasePointerCapture(e.pointerId);
        } catch (err) {
          /* noop */
        }
        if (moved) {
          view.plugin.saveSettings();
          view.render();
        } else {
          // Click -> Open Wounds Modal
          new WargameWoundModal(view.app, model, unit, () => {
            view.plugin.saveSettings();
            view.render();
          }).open();
        }
      };

      el.addEventListener('pointerup', endModelDrag);
      el.addEventListener('pointercancel', endModelDrag);

      // Rotating Handle Dragging
      let rotating = false;
      rotateHandle.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        rotating = true;
        rotateHandle.setPointerCapture(e.pointerId);
      });

      rotateHandle.addEventListener('pointermove', (e: PointerEvent) => {
        if (!rotating) return;
        const modelRect = el.getBoundingClientRect();
        const centerX = modelRect.left + modelRect.width / 2;
        const centerY = modelRect.top + modelRect.height / 2;
        const rad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        let deg = (rad * 180) / Math.PI + 90;
        deg = normalizeAngle(Math.round(deg));

        model.facing = deg;
        facingIndicator.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
      });

      const endRotate = (e: PointerEvent) => {
        if (!rotating) return;
        rotating = false;
        try {
          rotateHandle.releasePointerCapture(e.pointerId);
        } catch (err) {
          /* noop */
        }
        view.plugin.saveSettings();
      };
      rotateHandle.addEventListener('pointerup', endRotate);
      rotateHandle.addEventListener('pointercancel', endRotate);

      // Right-click context menu for rotation shortcuts & deletion
      el.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const menu = new Menu();

        menu.addItem((i) =>
          i
            .setTitle(t('wargame.rotatePlus45'))
            .setIcon('rotate-cw')
            .onClick(() => {
              model.facing = normalizeAngle((model.facing || 0) + 45);
              view.plugin.saveSettings();
              view.render();
            })
        );

        menu.addItem((i) =>
          i
            .setTitle(t('wargame.rotateMinus45'))
            .setIcon('rotate-ccw')
            .onClick(() => {
              model.facing = normalizeAngle((model.facing || 0) - 45);
              view.plugin.saveSettings();
              view.render();
            })
        );

        menu.addItem((i) =>
          i
            .setTitle(t('wargame.rotate180'))
            .setIcon('refresh-cw')
            .onClick(() => {
              model.facing = normalizeAngle((model.facing || 0) + 180);
              view.plugin.saveSettings();
              view.render();
            })
        );

        menu.addSeparator();

        menu.addItem((i) =>
          i
            .setTitle(t('wargame.adjustWoundsMenu'))
            .setIcon('heart-crack')
            .onClick(() => {
              new WargameWoundModal(view.app, model, unit, () => {
                view.plugin.saveSettings();
                view.render();
              }).open();
            })
        );

        menu.addSeparator();

        menu.addItem((i) =>
          i
            .setTitle(t('wargame.deleteModelMenu'))
            .setIcon('trash')
            .setWarning(true)
            .onClick(() => {
              if (!confirm(t('wargame.deleteModelConfirm'))) return;
              unit.models.splice(mIdx, 1);
              if (unit.models.length === 0) {
                wargame.units = wargame.units.filter((u) => u.id !== unit.id);
              }
              view.plugin.saveSettings();
              view.render();
            })
        );

        menu.addItem((i) =>
          i
            .setTitle(t('wargame.deleteUnitMenu'))
            .setIcon('trash')
            .setWarning(true)
            .onClick(() => {
              if (!confirm(t('wargame.deleteUnitOnTableConfirm', { name: unit.name }))) return;
              wargame.units = wargame.units.filter((u) => u.id !== unit.id);
              view.plugin.saveSettings();
              view.render();
            })
        );

        menu.showAtMouseEvent(e);
      });
    }
  }
}

/**
 * Floating Phase Tracker Panel for Wargame.
 */
export class WargamePhaseTrackerPanel {
  private view: any;
  private el: HTMLElement;
  private isMinimized: boolean = false;

  constructor(view: any) {
    this.view = view;
    this.init();
  }

  private init(): void {
    if (!this.view.panelsLayer) {
      this.view.containerEl.style.position = 'relative';
      this.view.panelsLayer = this.view.containerEl.createDiv({ cls: 'dte-panels-layer' });
    }

    this.el = this.view.panelsLayer.createDiv({ cls: 'dte-wargame-panel' });
    this.el.style.left = '24px';
    this.el.style.top = '64px';

    this.render();
  }

  build(): void {
    this.render();
  }

  destroy(): void {
    if (this.el) this.el.remove();
  }

  render(): void {
    this.el.empty();
    const map = this.view.getCurrentMap() as MapData | null;
    if (!map || !map.wargame || !map.wargame.enabled) {
      this.destroy();
      return;
    }

    const wargame = map.wargame;
    const phases = wargame.phases;
    const currentSide = wargame.sides[phases.currentSideIndex] || wargame.sides[0];
    const currentPhase = phases.names[phases.currentPhaseIndex] || phases.names[0] || 'Turno';

    // ── Header ──
    const header = this.el.createDiv({ cls: 'dte-combat-panel-header dte-wargame-header' });

    const titleBox = header.createDiv({ cls: 'dte-combat-panel-title' });
    titleBox.createSpan({ text: '⚔️ ' + t('wargame.panelTitle') });
    titleBox.createSpan({
      cls: 'dte-combat-round-badge',
      text: t('wargame.roundBadge', { round: phases.round }),
    });

    const headerBtns = header.createDiv({ cls: 'dte-combat-panel-header-btns' });

    const minBtn = headerBtns.createEl('button', {
      cls: 'dte-note-panel-toggle',
      text: this.isMinimized ? '➕' : '➖',
    });
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isMinimized = !this.isMinimized;
      this.render();
    });

    const closeBtn = headerBtns.createEl('button', {
      cls: 'dte-note-panel-close',
      text: '✕',
    });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.destroy();
    });

    this.attachHeaderDragging(header, minBtn, closeBtn);

    if (this.isMinimized) {
      this.el.addClass('dte-combat-minimized');
      return;
    }
    this.el.removeClass('dte-combat-minimized');

    // ── Current Side & Phase Box ──
    const statusBox = this.el.createDiv({ cls: 'dte-wargame-status-box' });
    if (currentSide) {
      statusBox.style.borderLeftColor = currentSide.color;
    }

    const sideRow = statusBox.createDiv({ cls: 'dte-status-side-row' });
    sideRow.createSpan({ cls: 'dte-status-label', text: t('wargame.sideLabel') + ':' });
    const sideNameEl = sideRow.createSpan({ cls: 'dte-status-val', text: currentSide ? currentSide.name : '?' });
    if (currentSide) sideNameEl.style.color = currentSide.color;

    const phaseRow = statusBox.createDiv({ cls: 'dte-status-phase-row' });
    phaseRow.createSpan({ cls: 'dte-status-label', text: t('wargame.phaseLabel') + ':' });
    phaseRow.createSpan({ cls: 'dte-status-val', text: currentPhase });

    // ── Phase Controls (Prev / Next Phase) ──
    const controlsRow = this.el.createDiv({ cls: 'dte-combat-controls-row' });

    const prevBtn = controlsRow.createEl('button', {
      cls: 'dte-btn',
      text: t('wargame.prevPhase'),
    });
    prevBtn.addEventListener('click', () => {
      this.advancePhase(-1, map, wargame);
    });

    const nextBtn = controlsRow.createEl('button', {
      cls: 'mod-cta dte-btn dte-combat-next-btn',
      text: t('wargame.nextPhase'),
    });
    nextBtn.addEventListener('click', () => {
      this.advancePhase(1, map, wargame);
    });

    // ── Victory Points Section ──
    this.el.createEl('h4', { cls: 'dte-wargame-section-title', text: t('wargame.victoryPointsSection') });
    const vpGrid = this.el.createDiv({ cls: 'dte-wargame-vp-grid' });

    for (const side of wargame.sides) {
      const vpCard = vpGrid.createDiv({ cls: 'dte-vp-side-card' });
      vpCard.style.borderColor = side.color;

      const top = vpCard.createDiv({ cls: 'dte-vp-top' });
      top.createSpan({ cls: 'dte-vp-side-name', text: side.name });
      top.createSpan({ cls: 'dte-vp-num', text: String(side.victoryPoints) });

      const btns = vpCard.createDiv({ cls: 'dte-vp-btns' });
      const minus = btns.createEl('button', { cls: 'dte-btn dte-vp-btn', text: '-1' });
      minus.addEventListener('click', () => {
        side.victoryPoints = Math.max(0, side.victoryPoints - 1);
        this.view.plugin.saveSettings();
        this.render();
      });

      const plus = btns.createEl('button', { cls: 'dte-btn dte-vp-btn', text: '+1' });
      plus.addEventListener('click', () => {
        side.victoryPoints++;
        this.view.plugin.saveSettings();
        this.render();
      });
    }

    // ── Objectives Status ──
    if (wargame.objectives && wargame.objectives.length > 0) {
      this.el.createEl('h4', { cls: 'dte-wargame-section-title', text: t('wargame.objectivesSection') });
      const objList = this.el.createDiv({ cls: 'dte-wargame-obj-status-list' });

      for (const obj of wargame.objectives) {
        const row = objList.createDiv({ cls: 'dte-obj-status-row' });
        const controlledSide = wargame.sides.find((s) => s.id === obj.controlledBy);

        row.createSpan({ text: '🚩 ' + obj.label });
        const badge = row.createSpan({ cls: 'dte-obj-status-badge' });

        if (controlledSide) {
          badge.setText(`${controlledSide.name} (+${obj.pointsPerTurn ?? 1}/r)`);
          badge.style.color = controlledSide.color;
          badge.style.borderColor = controlledSide.color;
        } else {
          badge.setText(t('wargame.uncontrolled'));
          badge.style.color = 'var(--text-muted)';
        }
      }
    }
  }

  private advancePhase(dir: 1 | -1, map: MapData, wargame: WargameMatchData): void {
    const phases = wargame.phases;
    const numPhases = Math.max(1, phases.names.length);
    const numSides = Math.max(1, wargame.sides.length);

    if (dir === 1) {
      phases.currentPhaseIndex++;
      if (phases.currentPhaseIndex >= numPhases) {
        phases.currentPhaseIndex = 0;
        if (phases.turnMode === 'perSideAllPhases') {
          phases.currentSideIndex++;
          if (phases.currentSideIndex >= numSides) {
            phases.currentSideIndex = 0;
            // Cross to new round -> award objective points!
            this.crossToNewRound(wargame);
          }
        } else {
          // Alternating mode
          this.crossToNewRound(wargame);
        }
      }
    } else {
      phases.currentPhaseIndex--;
      if (phases.currentPhaseIndex < 0) {
        phases.currentPhaseIndex = numPhases - 1;
        if (phases.turnMode === 'perSideAllPhases') {
          phases.currentSideIndex--;
          if (phases.currentSideIndex < 0) {
            phases.currentSideIndex = numSides - 1;
            if (phases.round > 1) phases.round--;
          }
        } else if (phases.round > 1) {
          phases.round--;
        }
      }
    }

    this.view.plugin.saveSettings();
    this.render();
  }

  private crossToNewRound(wargame: WargameMatchData): void {
    wargame.phases.round++;

    // Auto-award victory points for controlled objectives
    for (const obj of wargame.objectives || []) {
      if (obj.controlledBy && (obj.pointsPerTurn || 0) > 0) {
        const side = wargame.sides.find((s) => s.id === obj.controlledBy);
        if (side) {
          side.victoryPoints += obj.pointsPerTurn || 1;
        }
      }
    }

    new Notice(t('wargame.roundAdvancedNotice', { round: wargame.phases.round }));
  }

  private attachHeaderDragging(header: HTMLElement, minBtn: HTMLElement, closeBtn: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    header.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.target === minBtn || e.target === closeBtn) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = this.el.getBoundingClientRect();
      const parentRect = this.el.parentElement?.getBoundingClientRect() || { left: 0, top: 0 };
      initialLeft = rect.left - parentRect.left;
      initialTop = rect.top - parentRect.top;

      this.el.style.left = `${initialLeft}px`;
      this.el.style.top = `${initialTop}px`;
      this.el.style.right = 'auto';

      header.setPointerCapture(e.pointerId);
    });

    header.addEventListener('pointermove', (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this.el.style.left = `${initialLeft + dx}px`;
      this.el.style.top = `${initialTop + dy}px`;
    });

    const endDrag = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      try {
        header.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* noop */
      }
    };

    header.addEventListener('pointerup', endDrag);
    header.addEventListener('pointercancel', endDrag);
  }
}

export const WargameModule: EngineModule = {
  id: 'wargame',
  nameKey: 'modules.wargameName',
  descKey: 'modules.wargameDesc',
  icon: 'swords',
  defaultEnabled: false,
  renderToolbarButton(container: HTMLElement, view: any): void {
    const map = view.getCurrentMap();
    if (!map) return;

    const btn = container.createEl('button', {
      cls: 'dte-btn' + (map.wargame?.enabled ? ' mod-active' : ''),
      text: t('wargame.btnWargame'),
    });
    const swordsIcon = btn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(swordsIcon, 'swords');
    btn.prepend(swordsIcon);

    btn.addEventListener('click', (e: MouseEvent) => {
      const menu = new Menu();

      menu.addItem((item) =>
        item
          .setTitle(t('wargame.setupMatchMenu'))
          .setIcon('settings')
          .onClick(() => {
            new WargameSetupModal(view.app, view, map).open();
          })
      );

      menu.addItem((item) =>
        item
          .setTitle(t('wargame.rostersMenu'))
          .setIcon('book-open')
          .onClick(() => {
            new WargameRosterListModal(view.app, view.plugin, view).open();
          })
      );

      if (map.wargame?.enabled) {
        menu.addSeparator();
        menu.addItem((item) =>
          item
            .setTitle(t('wargame.togglePhaseTracker'))
            .setIcon('layout')
            .onClick(() => {
              if (view.wargamePanel) {
                view.wargamePanel.destroy();
                view.wargamePanel = null;
              } else {
                view.wargamePanel = new WargamePhaseTrackerPanel(view);
              }
            })
        );
      }

      menu.showAtMouseEvent(e);
    });
  },
};
