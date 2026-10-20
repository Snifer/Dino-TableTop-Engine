import { App, ItemView, Notice, Platform, TFile, WorkspaceLeaf } from 'obsidian';
import { CampaignData, DinoPlugin, MapData, POIData, TokenData, ViewportState } from '../types';
import { clamp } from '../utils';
import { toCss } from './cellCoordinates';
import { getCellStore } from './cellStore';
import { globalViewportManager } from './cellBoardCore';
import { renderGridLayer } from '../grid';
import { LaserEventDetail, PingEventDetail, spawnPingEffect, updateLaserOverlay } from './laserPing';

export const VIEW_TYPE_DINO_PROJECTION = 'dino-tabletop-projection-view';

export let isPlayerViewActive: boolean = false;

export function setPlayerViewActive(active: boolean): void {
  isPlayerViewActive = active;
}

export function togglePlayerViewActive(): boolean {
  isPlayerViewActive = !isPlayerViewActive;
  return isPlayerViewActive;
}

/**
 * Opens a secondary projection popout window (Desktop only).
 */
export async function openProjectionWindow(app: App, plugin: DinoPlugin): Promise<WorkspaceLeaf | null> {
  if (Platform.isMobile) {
    new Notice('La ventana de proyección en ventana separada solo está disponible en Obsidian Desktop.');
    return null;
  }

  if (typeof app.workspace.openPopoutLeaf !== 'function') {
    new Notice('Tu versión de Obsidian no soporta ventanas popout.');
    return null;
  }

  const leaf: WorkspaceLeaf = app.workspace.openPopoutLeaf();
  await leaf.setViewState({
    type: VIEW_TYPE_DINO_PROJECTION,
    active: true,
  });

  return leaf;
}

export class DinoProjectionView extends ItemView {
  plugin: DinoPlugin;
  zoom: number = 1;
  private mapUpdateListener: EventListener | null = null;
  private laserListener: EventListener | null = null;
  private pingListener: EventListener | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: DinoPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_DINO_PROJECTION;
  }

  getDisplayText(): string {
    return 'Dino Tabletop — Vista de Jugador (Testeo / Proyección)';
  }

  getIcon(): string {
    return 'tv';
  }

  async onOpen(): Promise<void> {
    this.containerEl.addClass('dte-projection-root');

    // Live sync event listener
    this.mapUpdateListener = () => {
      this.render();
    };
    window.addEventListener('dino-tabletop:map-updated', this.mapUpdateListener);

    // Laser pointer sync listener
    this.laserListener = ((e: CustomEvent<LaserEventDetail>) => {
      const inner = this.containerEl.querySelector('.dte-board-inner') as HTMLElement | null;
      if (!inner) return;
      const d = e.detail;
      if (!d || !d.active || d.x === undefined || d.y === undefined) {
        updateLaserOverlay(inner, 0, 0, '#ff3838', false);
      } else {
        updateLaserOverlay(inner, d.x, d.y, d.color || '#ff3838', true);
      }
    }) as EventListener;
    window.addEventListener('dino-tabletop:laser', this.laserListener);

    // Attention ping sync listener
    this.pingListener = ((e: CustomEvent<PingEventDetail>) => {
      const inner = this.containerEl.querySelector('.dte-board-inner') as HTMLElement | null;
      if (!inner) return;
      const d = e.detail;
      if (d && d.x !== undefined && d.y !== undefined) {
        spawnPingEffect(inner, d.x, d.y, d.color, d.icon);
      }
    }) as EventListener;
    window.addEventListener('dino-tabletop:ping', this.pingListener);

    this.render();
  }

  async onClose(): Promise<void> {
    if (this.mapUpdateListener) {
      window.removeEventListener('dino-tabletop:map-updated', this.mapUpdateListener);
      this.mapUpdateListener = null;
    }
    if (this.laserListener) {
      window.removeEventListener('dino-tabletop:laser', this.laserListener);
      this.laserListener = null;
    }
    if (this.pingListener) {
      window.removeEventListener('dino-tabletop:ping', this.pingListener);
      this.pingListener = null;
    }
  }

  getCurrentCampaign(): CampaignData | null {
    const data = this.plugin.settings;
    return (data.currentCampaignId && data.campaigns[data.currentCampaignId]) || null;
  }

  getCurrentMap(): MapData | null {
    const camp = this.getCurrentCampaign();
    if (!camp || !camp.currentMapId) return null;
    return camp.maps[camp.currentMapId] || null;
  }

  render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    if (!container) return;
    container.empty();
    container.addClass('dte-root', 'dte-player-mode');

    const camp = this.getCurrentCampaign();
    const map = this.getCurrentMap();
    if (!camp || !map || !camp.currentMapId) {
      const empty = container.createDiv({ cls: 'dte-empty-state' });
      empty.createEl('h3', { text: 'Sin mapa activo' });
      empty.createEl('p', { text: 'El director de juego aún no ha seleccionado un mapa.' });
      return;
    }

    // Top status banner
    const banner = container.createDiv({ cls: 'dte-player-banner' });
    const bannerText = banner.createSpan({ cls: 'dte-player-banner-text' });
    bannerText.setText(`👁️ ${map.name} — Vista de Jugador (Modo Testeo / Proyección)`);

    const isCellOrWorld = map.coordSpace === 'world' || !!map.cellMap;
    const mapId = camp.currentMapId;

    const wrap = container.createDiv({
      cls: `dte-board-wrap ${isCellOrWorld ? 'dte-cell-board-wrap' : ''}`,
    });

    if (isCellOrWorld && map.cellMap) {
      const cellCanvas = wrap.createEl('canvas', { cls: 'dte-cell-map-canvas' }) as HTMLCanvasElement;
      const inner = wrap.createDiv({ cls: 'dte-board-inner dte-cell-board-inner' });

      const vp = globalViewportManager.getViewport(mapId);
      inner.style.transform = `translate(${vp.x}px, ${vp.y}px) scale(${vp.scale})`;

      // Load & render canvas
      const store = getCellStore(mapId, this.plugin);
      store.loadFromDisk().then(() => {
        this.renderCellCanvas(wrap, cellCanvas, map, mapId);
      });
      this.renderCellCanvas(wrap, cellCanvas, map, mapId);

      // Render non-DM-only tokens and POIs
      for (const poi of map.pois) {
        if (!poi.dmOnly) this.renderPlayerPOI(inner, map, poi, vp);
      }
      for (const token of map.tokens) {
        if (!token.dmOnly) this.renderPlayerToken(inner, map, token, camp, vp);
      }

      // Independent zoom/pan for projector screen
      wrap.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.88;
        const rect = wrap.getBoundingClientRect();
        globalViewportManager.zoomAtPointer(mapId, e.clientX, e.clientY, factor, rect);
        inner.style.transform = `translate(${vp.x}px, ${vp.y}px) scale(${vp.scale})`;
        this.renderCellCanvas(wrap, cellCanvas, map, mapId);
      }, { passive: false });

      let isPan = false;
      let panStart = { x: 0, y: 0 };
      wrap.addEventListener('pointerdown', (e: PointerEvent) => {
        isPan = true;
        panStart = { x: e.clientX, y: e.clientY };
        wrap.setCssStyles({ cursor: 'grabbing' });
      });
      wrap.addEventListener('pointermove', (e: PointerEvent) => {
        if (!isPan) return;
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        panStart = { x: e.clientX, y: e.clientY };
        globalViewportManager.pan(mapId, dx, dy);
        inner.style.transform = `translate(${vp.x}px, ${vp.y}px) scale(${vp.scale})`;
        this.renderCellCanvas(wrap, cellCanvas, map, mapId);
      });
      wrap.addEventListener('pointerup', () => {
        isPan = false;
        wrap.setCssStyles({ cursor: 'default' });
      });
    } else {
      // Legacy image/drawing map
      const inner = wrap.createDiv({ cls: 'dte-board-inner' });
      inner.style.transform = `scale(${this.zoom})`;

      if (map.imagePath) {
        const file = this.app.vault.getAbstractFileByPath(map.imagePath);
        const src = file instanceof TFile ? this.app.vault.getResourcePath(file) : '';
        inner.createEl('img', { cls: 'dte-map-img', attr: { src } });
      }

      renderGridLayer(inner, map);

      for (const poi of map.pois) {
        if (!poi.dmOnly) this.renderPlayerPOI(inner, map, poi);
      }
      for (const token of map.tokens) {
        if (!token.dmOnly) this.renderPlayerToken(inner, map, token, camp);
      }
    }
  }

  private renderCellCanvas(
    wrap: HTMLElement,
    canvas: HTMLCanvasElement,
    map: MapData,
    mapId: string
  ): void {
    if (!map.cellMap) return;
    const width = wrap.clientWidth || 800;
    const height = wrap.clientHeight || 600;
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const vp = globalViewportManager.getViewport(mapId);
    ctx.translate(vp.x, vp.y);
    ctx.scale(vp.scale, vp.scale);

    const minWorldX = -vp.x / vp.scale - 200;
    const minWorldY = -vp.y / vp.scale - 200;
    const maxWorldX = (width - vp.x) / vp.scale + 200;
    const maxWorldY = (height - vp.y) / vp.scale + 200;

    const store = getCellStore(mapId, this.plugin);
    store.renderToCanvas(ctx, map.cellMap, minWorldX, minWorldY, maxWorldX, maxWorldY, map.fog, true);

    ctx.restore();
  }

  private renderPlayerToken(
    boardInner: HTMLElement,
    map: MapData,
    token: TokenData,
    camp: CampaignData,
    viewport?: ViewportState
  ): void {
    if (map.fog?.enabled && map.cellMap && camp.currentMapId) {
      const store = getCellStore(camp.currentMapId, this.plugin);
      const cellSize = map.cellMap.cellSizePx || 48;
      const cx = Math.floor(token.x / cellSize);
      const cy = Math.floor(token.y / cellSize);
      if (store.getFog(cx, cy) === 0) {
        return; // Hidden under fog of war
      }
    }

    const el = boardInner.createDiv({ cls: 'dte-token is-player-view-token' });
    const pos = toCss(map, token, viewport);
    el.style.left = pos.left;
    el.style.top = pos.top;
    el.style.width = (token.size || 44) + 'px';
    el.style.height = (token.size || 44) + 'px';

    const circle = el.createDiv({ cls: 'dte-token-circle' });
    const imgFile = token.imagePath ? this.app.vault.getAbstractFileByPath(token.imagePath) : null;
    if (imgFile instanceof TFile) {
      const src = this.app.vault.getResourcePath(imgFile);
      circle.style.backgroundImage = `url("${src}")`;
    } else {
      circle.style.background = token.color || '#4c8bf5';
      circle.setText((token.name || '?').slice(0, 2).toUpperCase());
    }

    const hpMode = camp.playerHpDisplay || 'bar';
    if (hpMode !== 'hidden') {
      const maxHp = token.maxHp || 1;
      const ratio = clamp((token.hp ?? 0) / maxHp, 0, 1);
      const barOuter = el.createDiv({ cls: 'dte-hpbar-outer' });
      const barInner = barOuter.createDiv({ cls: 'dte-hpbar-inner' });
      barInner.style.width = ratio * 100 + '%';
      barInner.style.background = ratio > 0.66 ? '#4caf50' : ratio > 0.33 ? '#ffc107' : '#f44336';

      if (hpMode === 'exact') {
        el.createDiv({ cls: 'dte-token-label', text: `${token.hp ?? 0}/${maxHp}` });
      }
    }
  }

  private renderPlayerPOI(
    boardInner: HTMLElement,
    map: MapData,
    poi: POIData,
    viewport?: ViewportState
  ): void {
    if (map.fog?.enabled && map.cellMap) {
      const camp = this.getCurrentCampaign();
      if (camp?.currentMapId) {
        const store = getCellStore(camp.currentMapId, this.plugin);
        const cellSize = map.cellMap.cellSizePx || 48;
        const cx = Math.floor(poi.x / cellSize);
        const cy = Math.floor(poi.y / cellSize);
        if (store.getFog(cx, cy) === 0) {
          return; // Hidden under fog of war
        }
      }
    }

    const el = boardInner.createDiv({ cls: 'dte-poi is-player-view-poi' });
    const pos = toCss(map, poi, viewport);
    el.style.left = pos.left;
    el.style.top = pos.top;
    el.style.width = (poi.size || 36) + 'px';
    el.style.height = (poi.size || 36) + 'px';

    const mark = el.createDiv({ cls: 'dte-poi-mark' });
    if (poi.color) {
      mark.style.background = poi.color;
    }
    mark.setText('📍');
    if (poi.name) el.createDiv({ cls: 'dte-poi-label', text: poi.name });
  }
}
