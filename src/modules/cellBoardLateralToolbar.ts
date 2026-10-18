import { setIcon } from 'obsidian';
import { MapData, POIData, TokenData, ToolContext, IDinoTabletopView } from '../types';
import { globalHistoryManager, globalToolManager, globalViewportManager } from './cellBoardCore';
import { isPlayerViewActive, togglePlayerViewActive, openProjectionWindow } from './playerView';
import { TokenEditModal } from '../modals/TokenEditModal';
import { POIEditModal } from '../modals/POIEditModal';
import { BestiaryListModal } from '../modals/BestiaryModals';
import { genId } from '../utils';

export class CellBoardLateralToolbar {
  private view: IDinoTabletopView;
  private container: HTMLElement;
  private map: MapData;
  private mapId: string;
  private boardInner: HTMLElement;
  private toolbarEl: HTMLElement | null = null;
  private bottomContextualBar: HTMLElement | null = null;
  private isCollapsed: boolean = false;
  private unsubscribeToolChange: (() => void) | null = null;
  private static savedPosition: { left: number; top: number } | null = null;

  constructor(view: IDinoTabletopView, container: HTMLElement, map: MapData, mapId: string, boardInner: HTMLElement) {
    this.view = view;
    this.container = container;
    this.map = map;
    this.mapId = mapId;
    this.boardInner = boardInner;
  }

  public render(): void {
    this.destroy();

    // Only render toolbar for world/cell maps or when cell tools are active
    const isCellOrWorld = this.map.coordSpace === 'world' || !!this.map.cellMap;
    if (!isCellOrWorld) return;

    this.toolbarEl = this.container.createDiv({
      cls: `dte-lateral-toolbar ${this.isCollapsed ? 'is-collapsed' : ''}`,
    });

    if (CellBoardLateralToolbar.savedPosition) {
      this.toolbarEl.setCssStyles({
        left: `${CellBoardLateralToolbar.savedPosition.left}px`,
        top: `${CellBoardLateralToolbar.savedPosition.top}px`,
      });
    }

    // ─── Drag handle for repositioning ───
    const dragHandle = this.toolbarEl.createDiv({ cls: 'dte-lateral-drag-handle' });
    setIcon(dragHandle, 'grip-vertical');
    dragHandle.setAttribute('aria-label', 'Arrastrar barra de herramientas');
    let dragStartX = 0;
    let dragStartY = 0;
    let toolbarStartLeft = 0;
    let toolbarStartTop = 0;

    const onDragMove = (ev: PointerEvent) => {
      if (!this.toolbarEl) return;
      const dx = ev.clientX - dragStartX;
      const dy = ev.clientY - dragStartY;
      this.toolbarEl.style.left = `${toolbarStartLeft + dx}px`;
      this.toolbarEl.style.top = `${toolbarStartTop + dy}px`;
    };
    const onDragEnd = (ev: PointerEvent) => {
      dragHandle.releasePointerCapture(ev.pointerId);
      window.removeEventListener('pointermove', onDragMove);
      window.removeEventListener('pointerup', onDragEnd);
      if (this.toolbarEl) {
        CellBoardLateralToolbar.savedPosition = {
          left: this.toolbarEl.offsetLeft,
          top: this.toolbarEl.offsetTop,
        };
      }
    };

    dragHandle.addEventListener('pointerdown', (ev: PointerEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!this.toolbarEl) return;
      dragStartX = ev.clientX;
      dragStartY = ev.clientY;
      toolbarStartLeft = this.toolbarEl.offsetLeft;
      toolbarStartTop = this.toolbarEl.offsetTop;
      dragHandle.setPointerCapture(ev.pointerId);
      window.addEventListener('pointermove', onDragMove);
      window.addEventListener('pointerup', onDragEnd);
    });

    // Top Header: Undo / Redo controls & quick actions
    const topGroup = this.toolbarEl.createDiv({ cls: 'dte-lateral-group dte-lateral-history' });

    const undoBtn = topGroup.createEl('button', {
      cls: `dte-lateral-btn dte-btn-undo ${!globalHistoryManager.canUndo(this.mapId) ? 'is-disabled' : ''}`,
      attr: { 'aria-label': 'Deshacer (Ctrl+Z)' },
    });
    setIcon(undoBtn, 'undo-2');
    undoBtn.addEventListener('click', async () => {
      await globalHistoryManager.undo(this.mapId);
      this.refreshHistoryState();
    });

    const redoBtn = topGroup.createEl('button', {
      cls: `dte-lateral-btn dte-btn-redo ${!globalHistoryManager.canRedo(this.mapId) ? 'is-disabled' : ''}`,
      attr: { 'aria-label': 'Rehacer (Ctrl+Y)' },
    });
    setIcon(redoBtn, 'redo-2');
    redoBtn.addEventListener('click', async () => {
      await globalHistoryManager.redo(this.mapId);
      this.refreshHistoryState();
    });

    const addTokenBtn = topGroup.createEl('button', {
      cls: 'dte-lateral-btn dte-btn-add-token',
      attr: { 'aria-label': 'Añadir Ficha (+Token)' },
    });
    setIcon(addTokenBtn, 'user-plus');
    addTokenBtn.addEventListener('click', () => {
      const center = this.view.getViewportCenterCoords ? this.view.getViewportCenterCoords() : { x: 200, y: 200 };
      const token: TokenData = {
        id: genId(),
        name: '',
        color: '#4c8bf5',
        size: 44,
        x: center.x,
        y: center.y,
        hp: 10,
        maxHp: 10,
        linkedNote: null,
        imagePath: null,
        counters: [],
      };
      new TokenEditModal(
        this.view.app,
        token,
        (saved) => {
          this.map.tokens.push(saved);
          this.view.plugin?.saveSettings();
          this.view.render();
        },
        null
      ).open();
    });

    const addPoiBtn = topGroup.createEl('button', {
      cls: 'dte-lateral-btn dte-btn-add-poi',
      attr: { 'aria-label': 'Añadir Punto de Interés (+POI)' },
    });
    setIcon(addPoiBtn, 'map-pin');
    addPoiBtn.addEventListener('click', () => {
      const center = this.view.getViewportCenterCoords ? this.view.getViewportCenterCoords() : { x: 200, y: 200 };
      const poi: POIData = { id: genId(), name: '', size: 36, x: center.x, y: center.y, imagePath: null, linkedNote: null };
      new POIEditModal(
        this.view.app,
        poi,
        (saved) => {
          this.map.pois.push(saved);
          this.view.plugin?.saveSettings();
          this.view.render();
        },
        null
      ).open();
    });

    const bestiaryBtn = topGroup.createEl('button', {
      cls: 'dte-lateral-btn dte-btn-bestiary',
      attr: { 'aria-label': 'Abrir Bestiario' },
    });
    setIcon(bestiaryBtn, 'book-open');
    bestiaryBtn.addEventListener('click', () => {
      new BestiaryListModal(this.view.app, this.view.plugin, this.view).open();
    });

    const playerViewBtn = topGroup.createEl('button', {
      cls: `dte-lateral-btn dte-btn-player-view ${isPlayerViewActive ? 'is-active' : ''}`,
      attr: { 'aria-label': 'Ver como Jugador (Modo Testeo)' },
    });
    setIcon(playerViewBtn, 'eye');
    playerViewBtn.addEventListener('click', () => {
      togglePlayerViewActive();
      this.view.render();
    });

    const projBtn = topGroup.createEl('button', {
      cls: 'dte-lateral-btn dte-btn-projection',
      attr: { 'aria-label': 'Ventana de Proyección (Testeo)' },
    });
    setIcon(projBtn, 'tv');
    projBtn.addEventListener('click', async () => {
      await openProjectionWindow(this.view.app, this.view.plugin);
    });

    this.toolbarEl.createDiv({ cls: 'dte-lateral-divider' });

    // Middle Group: Tools list
    const toolsGroup = this.toolbarEl.createDiv({ cls: 'dte-lateral-group dte-lateral-tools' });
    const tools = globalToolManager.getTools().filter((t) => !t.available || t.available(this.map));

    const activeToolId = globalToolManager.getActiveToolId();

    tools.forEach((tool) => {
      const isSelected = activeToolId === tool.id;
      const btn = toolsGroup.createEl('button', {
        cls: `dte-lateral-btn dte-tool-select-btn ${isSelected ? 'is-active' : ''}`,
        attr: { 'aria-label': `${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}` },
      });
      setIcon(btn, tool.icon.replace('lucide-', ''));

      if (!this.isCollapsed) {
        btn.createSpan({ cls: 'dte-lateral-btn-label', text: tool.label });
      }

      btn.addEventListener('click', () => {
        const deactivateCtx: ToolContext = {
          view: this.view,
          map: this.map,
          mapId: this.mapId,
          viewport: globalViewportManager.getViewport(this.mapId),
          containerEl: this.boardInner,
        };
        globalToolManager.setActiveTool(tool.id, deactivateCtx);
        this.render();
      });
    });

    // Bottom contextual options bar
    this.bottomContextualBar = this.container.createDiv({ cls: 'dte-contextual-bottom-bar' });
    this.renderContextualOptions();

    // Subscribe to tool changes
    this.unsubscribeToolChange = globalToolManager.onToolChange(() => {
      this.updateActiveToolAttributes();
      this.renderContextualOptions();
    });

    this.updateActiveToolAttributes();
  }

  private updateActiveToolAttributes(): void {
    const activeTool = globalToolManager.getActiveTool();
    const activeToolId = globalToolManager.getActiveToolId();

    if (this.boardInner) {
      this.boardInner.setAttribute('data-tool', activeToolId);
      this.boardInner.setCssStyles({ cursor: activeTool?.cursor || 'default' });
    }

    // Highlight button in sidebar
    if (this.toolbarEl) {
      this.toolbarEl.querySelectorAll('.dte-tool-select-btn').forEach((btn, idx) => {
        const tools = globalToolManager.getTools().filter((t) => !t.available || t.available(this.map));
        if (tools[idx]?.id === activeToolId) {
          btn.addClass('is-active');
        } else {
          btn.removeClass('is-active');
        }
      });
    }
  }

  private renderContextualOptions(): void {
    if (!this.bottomContextualBar) return;
    this.bottomContextualBar.empty();

    const activeTool = globalToolManager.getActiveTool();
    if (!activeTool || !activeTool.renderOptions) {
      this.bottomContextualBar.hide();
      return;
    }

    this.bottomContextualBar.show();
    const ctx: ToolContext = {
      view: this.view,
      map: this.map,
      mapId: this.mapId,
      viewport: globalViewportManager.getViewport(this.mapId),
      containerEl: this.boardInner,
    };

    activeTool.renderOptions(this.bottomContextualBar, ctx, () => {
      this.renderContextualOptions();
    });
  }

  public refreshHistoryState(): void {
    if (!this.toolbarEl) return;
    const undoBtn = this.toolbarEl.querySelector('.dte-btn-undo') as HTMLElement | null;
    const redoBtn = this.toolbarEl.querySelector('.dte-btn-redo') as HTMLElement | null;

    if (undoBtn) {
      if (globalHistoryManager.canUndo(this.mapId)) undoBtn.removeClass('is-disabled');
      else undoBtn.addClass('is-disabled');
    }
    if (redoBtn) {
      if (globalHistoryManager.canRedo(this.mapId)) redoBtn.removeClass('is-disabled');
      else redoBtn.addClass('is-disabled');
    }
  }

  public destroy(): void {
    if (this.unsubscribeToolChange) {
      this.unsubscribeToolChange();
      this.unsubscribeToolChange = null;
    }
    if (this.toolbarEl) {
      this.toolbarEl.remove();
      this.toolbarEl = null;
    }
    if (this.bottomContextualBar) {
      this.bottomContextualBar.remove();
      this.bottomContextualBar = null;
    }
  }
}
