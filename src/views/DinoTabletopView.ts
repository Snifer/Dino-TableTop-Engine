import { ItemView, Menu, Notice, TAbstractFile, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
import {
  VIEW_TYPE_DINO,
  HP_KEYS,
  MAXHP_KEYS,
  IMAGE_KEYS,
  IMAGE_EXTS,
  WEIGHT_KEYS,
  DinoSettings,
  CampaignData,
  MapData,
  TokenData,
  POIData,
  DrawingData,
  CounterData,
  InventoryItem,
  NotePanelHandle,
} from '../types';
import {
  genId,
  clamp,
  getIconClass,
  readFrontmatterStat,
  readFrontmatterImagePath,
  readFrontmatterWeight,
  renderMarkdownInto,
} from '../utils';
import { t } from '../i18n';
import { paintDrawingOnCanvas } from '../drawing';
import { renderGridLayer, snapCoordsToGrid } from '../grid';
import { FileSuggestModal } from '../modals/FileSuggestModal';
import { NamePromptModal } from '../modals/NamePromptModal';
import { DamageModal } from '../modals/DamageModal';
import { AdjustCounterModal } from '../modals/AdjustCounterModal';
import { TokenEditModal } from '../modals/TokenEditModal';
import { ItemEditModal } from '../modals/ItemEditModal';
import { CapacityEditModal } from '../modals/CapacityEditModal';
import { POIEditModal } from '../modals/POIEditModal';
import { GridConfigModal } from '../modals/GridConfigModal';
import { NewDrawnMapModal, DrawingEditorModal } from '../modals/DrawingModals';
import { BestiaryListModal } from '../modals/BestiaryModals';
import { CampaignExportModal } from '../modals/CampaignExportModal';
import { CampaignImportModal } from '../modals/CampaignImportModal';
import { ModulesModal } from '../modals/ModulesModal';
import { moduleRegistry } from '../modules/registry';
import { CombatTrackerPanel, AdjustConditionModal, AddConditionModal } from '../modules/combatTracker';
import { CardsPanel, findCardByInstanceId, resolveBackImage } from '../modules/cards';
import { TimelinePanel } from '../modules/timeline';
import { CampaignDiaryPanel } from '../modules/campaignDiary';
import { MeasureManager } from '../modules/measure';
import { renderWargameBoard, WargamePhaseTrackerPanel } from '../modules/wargame';
import { DiceTrayPanel } from '../modules/diceTray';
import { MissionListPanel } from '../modules/missions';

export interface InventoryPanelHandle {
  el: HTMLElement;
  tokenId: string;
  rebuild: () => void;
  close: () => void;
}

export class DinoTabletopView extends ItemView {
  plugin: any;
  zoom: number;
  metaListener: any;
  panelsLayer: HTMLElement;
  notePanels: Record<string, NotePanelHandle>;
  inventoryPanels: Record<string, InventoryPanelHandle>;
  combatPanel: CombatTrackerPanel | null;
  cardsPanel: CardsPanel | null;
  timelinePanel: TimelinePanel | null;
  diaryPanel: CampaignDiaryPanel | null;
  diceTrayPanel: DiceTrayPanel | null;
  missionsPanel: MissionListPanel | null;
  measureManager: MeasureManager | null;
  wargamePanel: WargamePhaseTrackerPanel | null;

  constructor(leaf: WorkspaceLeaf, plugin: any) {
    super(leaf);
    this.plugin = plugin;
    this.zoom = 1;
    this.notePanels = {};
    this.inventoryPanels = {};
    this.combatPanel = null;
    this.cardsPanel = null;
    this.timelinePanel = null;
    this.diaryPanel = null;
    this.diceTrayPanel = null;
    this.missionsPanel = null;
    this.measureManager = new MeasureManager(this);
    this.wargamePanel = null;
  }

  getViewType(): string {
    return VIEW_TYPE_DINO;
  }
  getDisplayText(): string {
    return t('commands.openView');
  }
  getIcon(): string {
    return 'swords';
  }

  async onOpen(): Promise<void> {
    this.metaListener = this.app.metadataCache.on('changed', (file: TFile) => this.onNoteChanged(file));
    this.containerEl.style.position = 'relative';
    this.panelsLayer = this.containerEl.createDiv({ cls: 'dte-panels-layer' });
    this.render();
  }

  async onClose(): Promise<void> {
    if (this.metaListener) this.app.metadataCache.offref(this.metaListener);
    if (this.combatPanel) this.combatPanel.destroy();
    if (this.cardsPanel) this.cardsPanel.destroy();
    if (this.timelinePanel) this.timelinePanel.destroy();
    if (this.diaryPanel) this.diaryPanel.destroy();
    if (this.diceTrayPanel) this.diceTrayPanel.destroy();
    if (this.missionsPanel) this.missionsPanel.destroy();
    if (this.wargamePanel) this.wargamePanel.destroy();
    for (const id in this.inventoryPanels) {
      this.inventoryPanels[id].close();
    }
    if (this.panelsLayer) this.panelsLayer.remove();
  }

  onNoteChanged(file: TAbstractFile): void {
    const map = this.getCurrentMap();
    let changed = false;
    if (map) {
      for (const tok of map.tokens) {
        if (tok.linkedNote === file.path) {
          const hp = readFrontmatterStat(this.app, tok.linkedNote, HP_KEYS);
          const maxHp = readFrontmatterStat(this.app, tok.linkedNote, MAXHP_KEYS);
          const img = readFrontmatterImagePath(this.app, tok.linkedNote, IMAGE_KEYS);
          if (hp !== null && hp !== tok.hp) {
            tok.hp = hp;
            changed = true;
          }
          if (maxHp !== null && maxHp !== tok.maxHp) {
            tok.maxHp = maxHp;
            changed = true;
          }
          if (img && img !== tok.imagePath) {
            tok.imagePath = img;
            changed = true;
          }
        }
        if (tok.inventory && tok.inventory.items) {
          for (const item of tok.inventory.items) {
            if (item.note === file.path) {
              const w = readFrontmatterWeight(this.app, item.note, WEIGHT_KEYS);
              const img = readFrontmatterImagePath(this.app, item.note, IMAGE_KEYS);
              if (w !== null && w !== item.weight) {
                item.weight = w;
                changed = true;
              }
              if (img && img !== item.imagePath) {
                item.imagePath = img;
                changed = true;
              }
            }
          }
        }
      }
    }
    if (changed) {
      this.plugin.saveSettings();
      this.render();
      for (const id in this.inventoryPanels) {
        this.inventoryPanels[id].rebuild();
      }
    }
    const panel = this.notePanels[file.path];
    if (panel) {
      if (panel.mode === 'edit') {
        if (document.activeElement !== panel.textarea) {
          this.app.vault
            .read(file as TFile)
            .then((content) => {
              panel.rawContent = content;
              panel.textarea.value = content;
            })
            .catch(() => {});
        }
      } else {
        this.app.vault
          .read(file as TFile)
          .then((content) => {
            panel.rawContent = content;
            renderMarkdownInto(this.app, panel.previewEl, content, file.path, this);
          })
          .catch(() => {});
      }
    }
  }

  getData(): DinoSettings {
    return this.plugin.settings;
  }

  getCurrentCampaign(): CampaignData | null {
    const data = this.getData();
    return (data.currentCampaignId && data.campaigns[data.currentCampaignId]) || null;
  }

  getCurrentMap(): MapData | null {
    const camp = this.getCurrentCampaign();
    if (!camp || !camp.currentMapId) return null;
    return camp.maps[camp.currentMapId] || null;
  }

  getViewportCenterCoords(): { x: number; y: number } {
    const container = this.containerEl.children[1] as HTMLElement;
    const wrap = container?.querySelector('.dte-board-wrap') as HTMLElement | null;
    const inner = container?.querySelector('.dte-board-inner') as HTMLElement | null;
    if (!wrap || !inner) return { x: 50, y: 50 };

    const innerRect = inner.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    if (innerRect.width <= 0 || innerRect.height <= 0) return { x: 50, y: 50 };

    const visibleCenterX = wrapRect.left + wrapRect.width / 2;
    const visibleCenterY = wrapRect.top + wrapRect.height / 2;

    const xPct = clamp(((visibleCenterX - innerRect.left) / innerRect.width) * 100, 5, 95);
    const yPct = clamp(((visibleCenterY - innerRect.top) / innerRect.height) * 100, 5, 95);

    return { x: Math.round(xPct * 10) / 10, y: Math.round(yPct * 10) / 10 };
  }

  render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    const oldWrap = container?.querySelector('.dte-board-wrap') as HTMLElement | null;
    const savedScroll = oldWrap ? { left: oldWrap.scrollLeft, top: oldWrap.scrollTop } : null;

    container.empty();
    container.addClass('dte-root');

    this.renderHeader(container);

    // ── Manage persistent panels based on enabled modules ──
    const data = this.getData();
    if (moduleRegistry.isEnabled(data, 'cards')) {
      if (!this.cardsPanel) {
        this.cardsPanel = new CardsPanel(
          this.app,
          this.plugin,
          this.panelsLayer,
          () => {
            const m = this.getCurrentMap();
            const boardInner = this.containerEl.querySelector('.dte-board-inner') as HTMLElement | null;
            if (boardInner && m) this.renderCardsLayer(boardInner, m);
          },
        );
      } else {
        this.cardsPanel.build();
      }
    } else if (this.cardsPanel) {
      this.cardsPanel.destroy();
      this.cardsPanel = null;
    }

    if (moduleRegistry.isEnabled(data, 'timeline')) {
      if (!this.timelinePanel) {
        this.timelinePanel = new TimelinePanel(
          this.app,
          this.plugin,
          this.panelsLayer,
          () => this.render(),
        );
      } else {
        this.timelinePanel.build();
      }
    } else if (this.timelinePanel) {
      this.timelinePanel.destroy();
      this.timelinePanel = null;
    }

    if (moduleRegistry.isEnabled(data, 'campaign-diary')) {
      if (!this.diaryPanel) {
        this.diaryPanel = new CampaignDiaryPanel(
          this.app,
          this.plugin,
          this.panelsLayer,
        );
      } else {
        this.diaryPanel.build();
      }
    } else if (this.diaryPanel) {
      this.diaryPanel.destroy();
      this.diaryPanel = null;
    }

    if (moduleRegistry.isEnabled(data, 'dice-tray')) {
      if (!this.diceTrayPanel) {
        this.diceTrayPanel = new DiceTrayPanel(
          this.app,
          this.plugin,
          this.panelsLayer,
        );
      } else {
        this.diceTrayPanel.build();
      }
    } else if (this.diceTrayPanel) {
      this.diceTrayPanel.destroy();
      this.diceTrayPanel = null;
    }

    if (moduleRegistry.isEnabled(data, 'missions')) {
      if (!this.missionsPanel) {
        this.missionsPanel = new MissionListPanel(
          this.app,
          this.plugin,
          this.panelsLayer
        );
      } else {
        this.missionsPanel.build();
      }
    } else if (this.missionsPanel) {
      this.missionsPanel.destroy();
      this.missionsPanel = null;
    }

    const camp = this.getCurrentCampaign();
    if (!camp) {
      container.createDiv({ cls: 'dte-empty', text: t('header.emptyCampaigns') });
      return;
    }
    const map = this.getCurrentMap();
    if (!map) {
      container.createDiv({ cls: 'dte-empty', text: t('header.emptyMaps') });
      return;
    }
    if (!map.pois) map.pois = [];
    this.renderBoard(container, map, savedScroll);
  }

  renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: 'dte-header' });
    const data = this.getData();
    const camp = this.getCurrentCampaign();
    const map = this.getCurrentMap();
    const layout = data.toolbarLayout || 'top';

    // ──────────────────────────────────────────
    // LADO IZQUIERDO: BREADCRUMB MODERNO
    // ──────────────────────────────────────────
    const headerLeft = header.createDiv({ cls: 'dte-header-left' });
    const breadcrumb = headerLeft.createDiv({ cls: 'dte-breadcrumb-nav' });

    // 1. Píldora de Campaña
    const campPill = breadcrumb.createEl('button', { cls: 'dte-breadcrumb-pill' });
    const campIcon = campPill.createSpan({ cls: 'dte-pill-icon' });
    setIcon(campIcon, 'folder');
    campPill.createSpan({
      cls: 'dte-pill-text',
      text: camp ? camp.name : t('header.selectCampaignPrompt'),
    });
    const campChevron = campPill.createSpan({ cls: 'dte-pill-chevron' });
    setIcon(campChevron, 'chevron-down');

    campPill.addEventListener('click', (e: MouseEvent) => {
      const menu = new Menu();
      const campaignIds = Object.keys(data.campaigns);

      if (campaignIds.length > 0) {
        for (const id of campaignIds) {
          const isCurrent = id === data.currentCampaignId;
          menu.addItem((item) => {
            item
              .setTitle(data.campaigns[id].name)
              .setIcon(isCurrent ? 'check' : 'folder')
              .setChecked(isCurrent)
              .onClick(() => {
                data.currentCampaignId = id;
                this.plugin.saveSettings();
                this.render();
              });
          });
        }
        menu.addSeparator();
      }

      // Acciones de campaña
      menu.addItem((item) =>
        item
          .setTitle(t('header.newCampaign'))
          .setIcon('folder-plus')
          .onClick(() => {
            new NamePromptModal(this.app, t('header.newCampaign'), t('header.campaignNamePrompt'), (name) => {
              if (!name) return;
              const id = genId();
              data.campaigns[id] = { name, maps: {}, currentMapId: null };
              data.currentCampaignId = id;
              this.plugin.saveSettings();
              this.render();
            }).open();
          })
      );

      menu.addItem((item) =>
        item
          .setTitle(t('exportImport.importCampaignBtn'))
          .setIcon('folder-down')
          .onClick(() => {
            new CampaignImportModal(this.app, this.plugin, this).open();
          })
      );

      if (camp && data.currentCampaignId) {
        menu.addItem((item) =>
          item
            .setTitle(t('exportImport.exportCampaignMenu'))
            .setIcon('download')
            .onClick(() => {
              if (data.currentCampaignId) {
                new CampaignExportModal(this.app, this.plugin, data.currentCampaignId).open();
              }
            })
        );
        menu.addSeparator();
        menu.addItem((item) =>
          item
            .setTitle(t('header.renameCampaign'))
            .setIcon('pencil')
            .onClick(() => {
              new NamePromptModal(this.app, t('header.renameCampaign'), camp.name, (newName) => {
                if (!newName) return;
                camp.name = newName;
                this.plugin.saveSettings();
                this.render();
              }).open();
            })
        );
        menu.addItem((item) =>
          item
            .setTitle(t('header.deleteCampaign'))
            .setIcon('trash')
            .setWarning(true)
            .onClick(() => {
              if (!confirm(t('header.deleteCampaignConfirm', { name: camp.name }))) return;
              delete data.campaigns[data.currentCampaignId as string];
              data.currentCampaignId = null;
              this.plugin.saveSettings();
              this.render();
            })
        );
      }

      menu.showAtMouseEvent(e);
    });

    // 2. Píldora de Mapa (si hay campaña activa)
    if (camp && data.currentCampaignId) {
      breadcrumb.createSpan({ cls: 'dte-breadcrumb-sep', text: '/' });

      const mapPill = breadcrumb.createEl('button', { cls: 'dte-breadcrumb-pill' });
      const mapIcon = mapPill.createSpan({ cls: 'dte-pill-icon' });
      setIcon(mapIcon, 'map');
      mapPill.createSpan({
        cls: 'dte-pill-text',
        text: map ? map.name : t('header.selectMapPrompt'),
      });
      const mapChevron = mapPill.createSpan({ cls: 'dte-pill-chevron' });
      setIcon(mapChevron, 'chevron-down');

      mapPill.addEventListener('click', (e: MouseEvent) => {
        const menu = new Menu();
        const mapIds = Object.keys(camp.maps);

        if (mapIds.length > 0) {
          for (const id of mapIds) {
            const isCurrent = id === camp.currentMapId;
            menu.addItem((item) => {
              item
                .setTitle(camp.maps[id].name)
                .setIcon(isCurrent ? 'check' : 'map')
                .setChecked(isCurrent)
                .onClick(() => {
                  camp.currentMapId = id;
                  this.plugin.saveSettings();
                  this.render();
                });
            });
          }
          menu.addSeparator();
        }

        // Acciones de mapa
        menu.addItem((item) =>
          item
            .setTitle(t('header.addMapFromImage'))
            .setIcon('image')
            .onClick(() => {
              new FileSuggestModal(this.app, IMAGE_EXTS, (file) => {
                new NamePromptModal(this.app, t('header.mapNamePrompt'), file.basename, (name) => {
                  const id = genId();
                  camp.maps[id] = { name: name || file.basename, imagePath: file.path, drawing: null, tokens: [], pois: [] };
                  camp.currentMapId = id;
                  this.plugin.saveSettings();
                  this.render();
                }).open();
              }).open();
            })
        );

        menu.addItem((item) =>
          item
            .setTitle(t('header.createDrawnMap'))
            .setIcon('pen-tool')
            .onClick(() => {
              new NewDrawnMapModal(this.app, (name, width, height) => {
                const id = genId();
                const drawing: DrawingData = { width, height, strokes: [], images: [], backgroundImagePath: null };
                camp.maps[id] = { name, imagePath: null, drawing, tokens: [], pois: [] };
                camp.currentMapId = id;
                this.plugin.saveSettings();
                this.render();
                new DrawingEditorModal(this.app, this.plugin, this, camp.maps[id]).open();
              }).open();
            })
        );

        if (map && camp.currentMapId) {
          menu.addSeparator();
          menu.addItem((item) =>
            item
              .setTitle(t('header.renameMap'))
              .setIcon('pencil')
              .onClick(() => {
                new NamePromptModal(this.app, t('header.renameMap'), map.name, (newName) => {
                  if (!newName) return;
                  map.name = newName;
                  this.plugin.saveSettings();
                  this.render();
                }).open();
              })
          );
          menu.addItem((item) =>
            item
              .setTitle(t('header.deleteMap'))
              .setIcon('trash')
              .setWarning(true)
              .onClick(() => {
                if (!confirm(t('header.deleteMapConfirm', { name: map.name }))) return;
                delete camp.maps[camp.currentMapId as string];
                camp.currentMapId = null;
                this.plugin.saveSettings();
                this.render();
              })
          );
        }

        menu.showAtMouseEvent(e);
      });
    }

    // 3. Botón Bestiario como Píldora
    const bestiaryPill = headerLeft.createEl('button', {
      cls: 'dte-btn dte-pill-btn dte-bestiary-pill',
      attr: { 'aria-label': t('header.bestiary') },
    });
    const bestiaryIcon = bestiaryPill.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(bestiaryIcon, 'book-open');
    bestiaryPill.createSpan({ text: t('header.bestiary') });
    bestiaryPill.addEventListener('click', () => {
      new BestiaryListModal(this.app, this.plugin, this).open();
    });

    // ──────────────────────────────────────────
    // CENTRO: DOCK SUPERIOR (si layout === 'top')
    // ──────────────────────────────────────────
    if (layout === 'top' && map) {
      const headerCenter = header.createDiv({ cls: 'dte-header-center' });
      this.renderToolbarItems(headerCenter, map, data, 'top');
    }

    // ──────────────────────────────────────────
    // LADO DERECHO: CONTROLES DE ZOOM
    // ──────────────────────────────────────────
    if (map) {
      const headerRight = header.createDiv({ cls: 'dte-header-right' });
      const zoomGroup = headerRight.createDiv({ cls: 'dte-toolbar-zoom' });

      const zoomOutBtn = zoomGroup.createEl('button', {
        cls: 'clickable-icon dte-btn-icon',
        attr: { 'aria-label': t('header.zoomOut') },
      });
      setIcon(zoomOutBtn, 'minus');
      zoomOutBtn.addEventListener('click', () => {
        this.setZoom(Math.max(0.3, Math.round((this.zoom - 0.1) * 10) / 10));
      });

      const zoomLabel = zoomGroup.createSpan({
        cls: 'dte-zoom-label',
        text: `${Math.round(this.zoom * 100)}%`,
        attr: { 'aria-label': t('header.zoomResetTooltip') },
      });
      zoomLabel.addEventListener('click', () => {
        this.setZoom(1);
      });

      const zoomInBtn = zoomGroup.createEl('button', {
        cls: 'clickable-icon dte-btn-icon',
        attr: { 'aria-label': t('header.zoomIn') },
      });
      setIcon(zoomInBtn, 'plus');
      zoomInBtn.addEventListener('click', () => {
        this.setZoom(Math.min(2.5, Math.round((this.zoom + 0.1) * 10) / 10));
      });
    }
  }

  /** Renderiza los controles de juego según la posición configurada (top dock o floating) */
  renderToolbarItems(
    container: HTMLElement,
    map: MapData,
    data: DinoSettings,
    layoutMode: 'top' | 'floating',
    boardContainer?: HTMLElement
  ): void {
    const isFloating = layoutMode === 'floating';
    const dock = container.createDiv({
      cls: isFloating ? 'dte-floating-toolbar-dock' : 'dte-toolbar-dock',
    });

    // Handle de arrastre para toolbar flotante
    if (isFloating) {
      const dragHandle = dock.createDiv({
        cls: 'dte-floating-drag-handle',
        attr: { 'aria-label': 'Arrastrar barra de herramientas' },
      });
      setIcon(dragHandle, 'grip-vertical');
      if (boardContainer) {
        this.setupFloatingToolbarDrag(container, dragHandle, boardContainer);
      }
    }

    // Botón + Token
    const addTokenBtn = dock.createEl('button', {
      cls: `dte-btn dte-tool-btn mod-cta`,
      attr: { 'aria-label': t('header.addToken') },
    });
    const tokenIcon = addTokenBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(tokenIcon, 'user-plus');
    if (!isFloating) addTokenBtn.createSpan({ text: t('header.addToken') });
    addTokenBtn.addEventListener('click', () => {
      const center = this.getViewportCenterCoords();
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
        this.app,
        token,
        (saved) => {
          map.tokens.push(saved);
          this.plugin.saveSettings();
          this.render();
        },
        null
      ).open();
    });

    // Botón + Punto de Interés
    const addPoiBtn = dock.createEl('button', {
      cls: `dte-btn dte-tool-btn`,
      attr: { 'aria-label': t('header.addPoi') },
    });
    const poiIcon = addPoiBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(poiIcon, 'map-pin');
    if (!isFloating) addPoiBtn.createSpan({ text: t('header.addPoi') });
    addPoiBtn.addEventListener('click', () => {
      const center = this.getViewportCenterCoords();
      const poi: POIData = { id: genId(), name: '', size: 36, x: center.x, y: center.y, imagePath: null, linkedNote: null };
      new POIEditModal(
        this.app,
        poi,
        (saved) => {
          map.pois.push(saved);
          this.plugin.saveSettings();
          this.render();
        },
        null
      ).open();
    });

    // Botón Grilla de Mapa
    const gridBtn = dock.createEl('button', {
      cls: `dte-btn dte-tool-btn` + (map.grid?.enabled ? ' mod-active' : ''),
      attr: { 'aria-label': t('header.configureGrid') },
    });
    const gridIcon = gridBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(gridIcon, 'grid');
    if (!isFloating) gridBtn.createSpan({ text: t('header.configureGrid') });
    gridBtn.addEventListener('click', () => {
      new GridConfigModal(
        this.app,
        map,
        (config) => {
          map.grid = config;
          this.plugin.saveSettings();
          this.render();
        },
        () => this.measureManager?.startCalibration()
      ).open();
    });

    // Botón Dibujo (si el mapa es dibujado)
    if (map.drawing) {
      const editDrawingBtn = dock.createEl('button', {
        cls: 'dte-btn dte-tool-btn',
        attr: { 'aria-label': t('header.editDrawing') },
      });
      const editIcon = editDrawingBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
      setIcon(editIcon, 'pencil');
      if (!isFloating) editDrawingBtn.createSpan({ text: t('header.editDrawing') });
      editDrawingBtn.addEventListener('click', () => {
        new DrawingEditorModal(this.app, this.plugin, this, map).open();
      });
    }

    // Botón Módulos Integrados
    const modulesBtn = dock.createEl('button', {
      cls: 'clickable-icon dte-btn-icon dte-tool-btn',
      attr: { 'aria-label': t('header.modules') },
    });
    setIcon(modulesBtn, 'puzzle');
    modulesBtn.addEventListener('click', () => {
      new ModulesModal(this.app, this.plugin, this).open();
    });

    // Módulos activos con botón en barra
    const activeMods = moduleRegistry.getAll().filter((m) => moduleRegistry.isEnabled(data, m.id));
    for (const mod of activeMods) {
      if (mod.renderToolbarButton) {
        mod.renderToolbarButton(dock, this);
      }
    }
  }

  /** Permite arrastrar la barra de herramientas flotante a cualquier parte de la vista */
  private setupFloatingToolbarDrag(toolbarEl: HTMLElement, handleEl: HTMLElement, containerEl: HTMLElement): void {
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    handleEl.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;
      handleEl.addClass('is-dragging');

      const rect = toolbarEl.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;

      const onPointerMove = (moveEv: PointerEvent) => {
        if (!isDragging) return;
        const parentRect = containerEl.getBoundingClientRect();
        const x = Math.max(8, Math.min(moveEv.clientX - parentRect.left - dragOffsetX, parentRect.width - rect.width - 8));
        const y = Math.max(8, Math.min(moveEv.clientY - parentRect.top - dragOffsetY, parentRect.height - rect.height - 8));

        toolbarEl.style.left = `${x}px`;
        toolbarEl.style.top = `${y}px`;
        toolbarEl.style.right = 'auto';
        toolbarEl.style.bottom = 'auto';
      };

      const onPointerUp = () => {
        if (isDragging) {
          isDragging = false;
          handleEl.removeClass('is-dragging');
          this.plugin.settings.floatingToolbarPosition = {
            x: parseInt(toolbarEl.style.left || '16', 10),
            y: parseInt(toolbarEl.style.top || '16', 10),
          };
          this.plugin.saveSettings();
        }
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  }

  setZoom(val: number): void {
    this.zoom = clamp(val, 0.3, 3);
    const container = this.containerEl.children[1] as HTMLElement;
    const boardImg = container.querySelector('.dte-board-inner') as HTMLElement | null;
    if (boardImg) boardImg.style.transform = `scale(${this.zoom})`;
    const zoomLabel = container.querySelector('.dte-zoom-label');
    if (zoomLabel) zoomLabel.setText(`${Math.round(this.zoom * 100)}%`);
  }

  renderBoard(container: HTMLElement, map: MapData, savedScroll?: { left: number; top: number } | null): void {
    const wrap = container.createDiv({ cls: 'dte-board-wrap' });
    const inner = wrap.createDiv({ cls: 'dte-board-inner' });
    inner.style.transform = `scale(${this.zoom})`;

    if (map.imagePath) {
      const file = this.app.vault.getAbstractFileByPath(map.imagePath);
      const src = file ? this.app.vault.getResourcePath(file as TFile) : '';
      const imgEl = inner.createEl('img', { cls: 'dte-map-img', attr: { src } });
      if (savedScroll) {
        wrap.scrollLeft = savedScroll.left;
        wrap.scrollTop = savedScroll.top;
        imgEl.addEventListener('load', () => {
          wrap.scrollLeft = savedScroll.left;
          wrap.scrollTop = savedScroll.top;
        }, { once: true });
      }
    } else if (map.drawing) {
      const canvas = inner.createEl('canvas', { cls: 'dte-map-canvas' }) as HTMLCanvasElement;
      canvas.width = map.drawing.width;
      canvas.height = map.drawing.height;
      const cache: Record<string, HTMLImageElement> = {};
      const drawing = map.drawing;
      const repaint = () => paintDrawingOnCanvas(this.app, canvas, drawing, { imageCache: cache, onImageLoad: repaint });
      repaint();
      if (savedScroll) {
        wrap.scrollLeft = savedScroll.left;
        wrap.scrollTop = savedScroll.top;
      }
    }

    renderGridLayer(inner, map);

    for (const poi of map.pois) {
      this.renderPOI(inner, map, poi);
    }
    for (const token of map.tokens) {
      this.renderToken(inner, map, token);
    }
    this.renderCardsLayer(inner, map);

    const data = this.getData();
    if (moduleRegistry.isEnabled(data, 'wargame')) {
      renderWargameBoard(inner, map, this);
    }

    if (moduleRegistry.isEnabled(data, 'measure') && this.measureManager) {
      this.measureManager.attachBoardListeners(inner, map);
    }

    if (savedScroll) {
      wrap.scrollLeft = savedScroll.left;
      wrap.scrollTop = savedScroll.top;
    }

    // Barra lateral flotante si está configurada
    const layout = data.toolbarLayout || 'top';
    if (layout === 'floating' || layout === 'floating-left' || layout === 'floating-right') {
      const floatingToolbar = container.createDiv({
        cls: `dte-floating-toolbar dte-floating-${layout === 'floating-right' ? 'right' : 'left'}`,
      });

      if (data.floatingToolbarPosition && layout === 'floating') {
        floatingToolbar.style.left = `${data.floatingToolbarPosition.x}px`;
        floatingToolbar.style.top = `${data.floatingToolbarPosition.y}px`;
        floatingToolbar.style.right = 'auto';
      }

      this.renderToolbarItems(floatingToolbar, map, data, 'floating', container);
    }
  }

  renderCardsLayer(boardInner: HTMLElement, map: MapData): void {
    // Remove existing card elements
    boardInner.querySelectorAll('.dte-card-on-table').forEach((el) => el.remove());
    const data = this.getData();
    if (!moduleRegistry.isEnabled(data, 'cards')) return;
    const cards = map.cardsOnTable ?? [];
    const sorted = [...cards].sort((a, b) => a.z - b.z);
    for (const card of sorted) {
      this.renderCardOnTable(boardInner, map, card);
    }
  }

  renderCardOnTable(boardInner: HTMLElement, map: MapData, card: import('../types').CardOnTable): void {
    const data = this.getData();
    const deck = data.decks[card.deckId];
    const cardDef = deck ? findCardByInstanceId(deck, card.instanceId) : undefined;

    const el = boardInner.createDiv({ cls: 'dte-card-on-table' });
    el.style.left = card.x + '%';
    el.style.top = card.y + '%';
    el.style.transform = `translate(-50%, -50%) rotate(${card.rotation}deg)`;
    el.style.zIndex = String(card.z + 10);

    // Card face
    const face = el.createDiv({ cls: 'dte-card-face' });
    const showFront = card.faceUp && cardDef?.frontImage;
    const showBack = !card.faceUp;
    const backImgPath = deck ? resolveBackImage(deck, cardDef) : null;

    if (showFront && cardDef?.frontImage) {
      const af = this.app.vault.getAbstractFileByPath(cardDef.frontImage);
      if (af instanceof TFile) {
        face.createEl('img', {
          cls: 'dte-card-img',
          attr: { src: this.app.vault.getResourcePath(af) },
        });
      }
    } else if (showBack && backImgPath) {
      const af = this.app.vault.getAbstractFileByPath(backImgPath);
      if (af instanceof TFile) {
        face.createEl('img', {
          cls: 'dte-card-img',
          attr: { src: this.app.vault.getResourcePath(af) },
        });
      } else {
        face.createEl('div', { cls: 'dte-card-placeholder', text: '🃏' });
      }
    } else {
      face.createEl('div', {
        cls: 'dte-card-placeholder',
        text: card.faceUp ? (cardDef?.name ?? '?') : '🃏',
      });
    }

    // Label
    if (card.faceUp && cardDef?.name) {
      el.createEl('div', { cls: 'dte-card-label', text: cardDef.name });
    }

    // Drag
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
      const inner = boardInner;
      const rect = inner.getBoundingClientRect();
      card.x = clamp(((e.clientX - rect.left) / rect.width) * 100, 1, 99);
      card.y = clamp(((e.clientY - rect.top) / rect.height) * 100, 1, 99);
      el.style.left = card.x + '%';
      el.style.top = card.y + '%';
    });

    el.addEventListener('pointerup', async (e: PointerEvent) => {
      dragging = false;
      if (moved) {
        await this.plugin.saveSettings();
        return;
      }
      // Click: context menu
      const menu = new Menu();
      menu.addItem((item) =>
        item
          .setTitle(card.faceUp ? 'Voltear (boca abajo)' : 'Voltear (boca arriba)')
          .setIcon('refresh-cw')
          .onClick(async () => {
            card.faceUp = !card.faceUp;
            await this.plugin.saveSettings();
            this.renderCardsLayer(boardInner, map);
          })
      );
      menu.addItem((item) =>
        item
          .setTitle('Rotar 90°')
          .setIcon('rotate-cw')
          .onClick(async () => {
            card.rotation = (card.rotation + 90) % 360;
            await this.plugin.saveSettings();
            this.renderCardsLayer(boardInner, map);
          })
      );
      menu.addItem((item) =>
        item
          .setTitle('Descartar')
          .setIcon('trash')
          .onClick(async () => {
            if (!deck) return;
            map.cardsOnTable = (map.cardsOnTable ?? []).filter(
              (c) => c.instanceId !== card.instanceId,
            );
            deck.discardPile.push(card.instanceId);
            await this.plugin.saveSettings();
            this.renderCardsLayer(boardInner, map);
            this.cardsPanel?.build();
          })
      );
      menu.addItem((item) =>
        item
          .setTitle('Traer al frente')
          .setIcon('arrow-up')
          .onClick(async () => {
            const maxZ = (map.cardsOnTable ?? []).reduce((m, c) => Math.max(m, c.z), 0);
            card.z = maxZ + 1;
            await this.plugin.saveSettings();
            this.renderCardsLayer(boardInner, map);
          })
      );
      menu.showAtMouseEvent(e as unknown as MouseEvent);
    });
  }

  /* ---------------- Puntos de interés ---------------- */

  renderPOI(boardInner: HTMLElement, map: MapData, poi: POIData): void {
    const el = boardInner.createDiv({ cls: 'dte-poi' });
    el.style.left = poi.x + '%';
    el.style.top = poi.y + '%';
    el.style.width = (poi.size || 36) + 'px';
    el.style.height = (poi.size || 36) + 'px';

    const mark = el.createDiv({ cls: 'dte-poi-mark' });
    if (poi.color) {
      mark.style.background = poi.color;
      mark.style.color = '#fff';
    }
    const imgFile = poi.imagePath ? this.app.vault.getAbstractFileByPath(poi.imagePath) : null;
    if (imgFile) {
      const src = this.app.vault.getResourcePath(imgFile as TFile);
      mark.style.backgroundImage = `url("${src}")`;
      mark.style.backgroundSize = 'cover';
      mark.style.backgroundPosition = 'center';
    } else if (poi.icon && this.plugin.settings.enableCustomFont) {
      const iconCls = getIconClass(poi.icon, this.plugin.settings.customFontPrefix);
      const iconEl = mark.createEl('i', { cls: iconCls });
      iconEl.style.fontSize = Math.max(12, Math.round((poi.size || 36) * 0.5)) + 'px';
    } else {
      mark.setText('📍');
    }
    if (poi.name) el.createDiv({ cls: 'dte-poi-label', text: poi.name });

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
      poi.x = xPct;
      poi.y = yPct;
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
        this.plugin.saveSettings();
      } else if (poi.linkedNote) {
        const f = this.app.vault.getAbstractFileByPath(poi.linkedNote);
        if (f) this.openNotePanel(f as TFile);
        else this.openPOIEditor(map, poi);
      } else {
        this.openPOIEditor(map, poi);
      }
    };
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    el.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      const menu = new Menu();
      menu.addItem((i) =>
        i
          .setTitle(t('poi.editMenu'))
          .setIcon('pencil')
          .onClick(() => this.openPOIEditor(map, poi))
      );
      if (poi.linkedNote) {
        menu.addItem((i) =>
          i
            .setTitle(t('poi.openNotePanelMenu'))
            .setIcon('file-text')
            .onClick(() => {
              const f = this.app.vault.getAbstractFileByPath(poi.linkedNote as string);
              if (f) this.openNotePanel(f as TFile);
            })
        );
      }
      menu.addItem((i) =>
        i
          .setTitle(t('poi.deleteMenu'))
          .setIcon('trash')
          .onClick(() => {
            if (!confirm(t('poi.deleteConfirm', { name: poi.name || t('common.unnamed') }))) return;
            map.pois = map.pois.filter((p) => p.id !== poi.id);
            this.plugin.saveSettings();
            this.render();
          })
      );
      menu.showAtMouseEvent(e);
    });
  }

  openPOIEditor(map: MapData, poi: POIData): void {
    new POIEditModal(
      this.app,
      Object.assign({}, poi),
      (saved) => {
        Object.assign(poi, saved);
        this.plugin.saveSettings();
        this.render();
      },
      (toDelete) => {
        map.pois = map.pois.filter((p) => p.id !== toDelete.id);
        this.plugin.saveSettings();
        this.render();
      }
    ).open();
  }

  /* ---------------- Tokens ---------------- */

  applyTokenDelta(map: MapData, token: TokenData, delta: number): void {
    const newHp = clamp((token.hp ?? 0) + delta, 0, token.maxHp || 0);
    token.hp = newHp;
    if (token.linkedNote) {
      const file = this.app.vault.getAbstractFileByPath(token.linkedNote);
      if (file) {
        this.app.fileManager
          .processFrontMatter(file as TFile, (fm: Record<string, any>) => {
            let key = HP_KEYS.find((k) => fm[k] !== undefined);
            if (!key) key = 'hp';
            fm[key] = newHp;
          })
          .catch(() => {});
      }
    }
    this.plugin.saveSettings();
    this.render();
  }

  applyCounterDelta(token: TokenData, counter: CounterData, delta: number): void {
    let newVal = (counter.value || 0) + delta;
    newVal = Math.max(0, newVal);
    if (counter.max !== null && counter.max !== undefined) newVal = Math.min(counter.max, newVal);
    counter.value = newVal;
    this.plugin.saveSettings();
    this.render();
  }

  openDamageModal(map: MapData, token: TokenData): void {
    new DamageModal(this.app, token, (delta) => this.applyTokenDelta(map, token, delta)).open();
  }

  openTokenEditor(map: MapData, token: TokenData): void {
    new TokenEditModal(
      this.app,
      Object.assign({}, token),
      (saved) => {
        Object.assign(token, saved);
        this.plugin.saveSettings();
        this.render();
      },
      (toDelete) => {
        map.tokens = map.tokens.filter((t) => t.id !== toDelete.id);
        this.plugin.saveSettings();
        this.render();
      },
      (tok) => {
        this.openInventoryPanel(tok, map);
      }
    ).open();
  }

  renderToken(boardInner: HTMLElement, map: MapData, token: TokenData): void {
    const el = boardInner.createDiv({ cls: 'dte-token' });
    if (map.combat?.active && map.combat.combatants.length > 0) {
      const activeCombatant = map.combat.combatants[map.combat.turnIndex];
      if (activeCombatant && activeCombatant.tokenId === token.id) {
        el.addClass('dte-token-active-turn');
      }
    }
    el.style.left = token.x + '%';
    el.style.top = token.y + '%';
    el.style.width = (token.size || 44) + 'px';
    el.style.height = (token.size || 44) + 'px';

    const circle = el.createDiv({ cls: 'dte-token-circle' });
    const imgFile = token.imagePath ? this.app.vault.getAbstractFileByPath(token.imagePath) : null;
    if (imgFile) {
      const src = this.app.vault.getResourcePath(imgFile as TFile);
      circle.style.backgroundImage = `url("${src}")`;
      circle.style.backgroundSize = 'cover';
      circle.style.backgroundPosition = 'center';
    } else if (token.icon && this.plugin.settings.enableCustomFont) {
      circle.style.background = token.color || '#4c8bf5';
      const iconCls = getIconClass(token.icon, this.plugin.settings.customFontPrefix);
      const iconEl = circle.createEl('i', { cls: iconCls });
      iconEl.style.fontSize = Math.max(12, Math.round((token.size || 44) * 0.55)) + 'px';
    } else {
      circle.style.background = token.color || '#4c8bf5';
      circle.setText((token.name || '?').slice(0, 2).toUpperCase());
    }

    const maxHp = token.maxHp || 1;
    const ratio = clamp((token.hp ?? 0) / maxHp, 0, 1);
    const barOuter = el.createDiv({ cls: 'dte-hpbar-outer' });
    const barInner = barOuter.createDiv({ cls: 'dte-hpbar-inner' });
    barInner.style.width = ratio * 100 + '%';
    barInner.style.background = ratio > 0.66 ? '#4caf50' : ratio > 0.33 ? '#ffc107' : '#f44336';
    el.createDiv({ cls: 'dte-token-label', text: `${token.hp ?? 0}/${maxHp}` });

    // Pinned inventory badges (replaces legacy counters)
    const badges = token.inventory ? token.inventory.items.filter((i) => i.pinned) : [];
    if (badges.length > 0) {
      const row = el.createDiv({ cls: 'dte-counters-row' });
      for (const item of badges) {
        const maxTxt = item.max !== null && item.max !== undefined ? `/${item.max}` : '';
        const badge = row.createDiv({ cls: 'dte-counter-badge', text: `${item.label}: ${item.value}${maxTxt}` });
        badge.addEventListener('pointerdown', (e: PointerEvent) => e.stopPropagation());
        badge.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation();
          new ItemEditModal(
            this.app,
            item,
            async (updated) => {
              Object.assign(item, updated);
              await this.plugin.saveSettings();
              this.render();
              if (this.inventoryPanels[token.id]) this.inventoryPanels[token.id].rebuild();
            },
            async (delId) => {
              if (token.inventory) {
                token.inventory.items = token.inventory.items.filter((it) => it.id !== delId);
                await this.plugin.saveSettings();
                this.render();
                if (this.inventoryPanels[token.id]) this.inventoryPanels[token.id].rebuild();
              }
            }
          ).open();
        });
      }
    }

    if (token.conditions && token.conditions.length) {
      const condRow = el.createDiv({ cls: 'dte-token-conditions-row' });
      for (let cIdx = 0; cIdx < token.conditions.length; cIdx++) {
        const cond = token.conditions[cIdx];
        const dur = cond.roundsRemaining !== null ? `${cond.roundsRemaining}r` : '';
        const badge = condRow.createDiv({
          cls: 'dte-token-condition-badge',
          text: `${cond.icon || '✨'}${dur ? ' ' + dur : ''}`,
          attr: { 'aria-label': `${cond.name}${dur ? ' (' + dur + ')' : ''}` },
        });
        if (cond.color) {
          badge.style.borderColor = cond.color;
        }
        badge.addEventListener('pointerdown', (e: PointerEvent) => e.stopPropagation());
        badge.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation();
          new AdjustConditionModal(this.app, cond, token.name, (updated) => {
            if (updated === null) {
              token.conditions?.splice(cIdx, 1);
            }
            if (map.combat?.combatants) {
              const combatant = map.combat.combatants.find((cb) => cb.tokenId === token.id);
              if (combatant) {
                combatant.conditions = [...(token.conditions || [])];
              }
            }
            this.plugin.saveSettings();
            this.render();
            if (this.combatPanel) this.combatPanel.render();
          }).open();
        });
      }
    }

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
      token.x = xPct;
      token.y = yPct;
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
        if (map.grid?.enabled && map.grid.snapTokens) {
          const snapped = snapCoordsToGrid(token.x, token.y, map, boardInner);
          token.x = snapped.x;
          token.y = snapped.y;
          el.style.left = token.x + '%';
          el.style.top = token.y + '%';
        }
        this.plugin.saveSettings();
      } else {
        this.openDamageModal(map, token);
      }
    };

    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    el.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      const menu = new Menu();
      menu.addItem((i) =>
        i
          .setTitle(t('token.applyDamageHeal'))
          .setIcon('heart-crack')
          .onClick(() => this.openDamageModal(map, token))
      );
      menu.addItem((i) =>
        i
          .setTitle(t('modules.combatAddCondition'))
          .setIcon('sparkles')
          .onClick(() => {
            new AddConditionModal(this.app, (newCond) => {
              token.conditions = token.conditions || [];
              token.conditions.push(newCond);
              if (map.combat?.combatants) {
                const combatant = map.combat.combatants.find((cb) => cb.tokenId === token.id);
                if (combatant) {
                  combatant.conditions = [...token.conditions];
                }
              }
              this.plugin.saveSettings();
              this.render();
              if (this.combatPanel) this.combatPanel.render();
            }).open();
          })
      );
      menu.addItem((i) =>
        i
          .setTitle(t('token.editTokenMenu'))
          .setIcon('pencil')
          .onClick(() => this.openTokenEditor(map, token))
      );
      if (!token.inventory) {
        menu.addItem((i) =>
          i
            .setTitle(t('inventory.addInventory'))
            .setIcon('package-plus')
            .onClick(() => {
              token.inventory = {
                items: [],
                capacity: { mode: 'none', value: 0, label: '' },
              };
              this.plugin.saveSettings();
              this.render();
              this.openInventoryPanel(token, map);
            })
        );
      } else {
        const count = token.inventory.items.length;
        menu.addItem((i) =>
          i
            .setTitle(t('inventory.viewInventory', { count }))
            .setIcon('package')
            .onClick(() => {
              this.openInventoryPanel(token, map);
            })
        );
      }
      if (token.linkedNote) {
        menu.addItem((i) =>
          i
            .setTitle(t('token.openNotePanelMenu'))
            .setIcon('file-text')
            .onClick(() => {
              const f = this.app.vault.getAbstractFileByPath(token.linkedNote as string);
              if (f) this.openNotePanel(f as TFile);
            })
        );
      }
      menu.addItem((i) =>
        i
          .setTitle(t('token.deleteTokenMenu'))
          .setIcon('trash')
          .onClick(() => {
            if (!confirm(t('token.deleteConfirm', { name: token.name || t('common.unnamed') }))) return;
            map.tokens = map.tokens.filter((t) => t.id !== token.id);
            this.plugin.saveSettings();
            this.render();
          })
      );
      menu.showAtMouseEvent(e);
    });
  }

  /* ---------------- Panel flotante de inventario ---------------- */

  openInventoryPanel(token: TokenData, map: MapData): void {
    if (!this.panelsLayer) {
      this.containerEl.style.position = 'relative';
      this.panelsLayer = this.containerEl.createDiv({ cls: 'dte-panels-layer' });
    }

    if (!token.inventory) {
      token.inventory = {
        items: [],
        capacity: { mode: 'none', value: 0, label: '' },
      };
      this.plugin.saveSettings();
    }

    const existing = this.inventoryPanels[token.id];
    if (existing) {
      this.panelsLayer.appendChild(existing.el);
      existing.rebuild();
      return;
    }

    const el = this.panelsLayer.createDiv({ cls: 'dte-panel dte-inventory-panel' });
    const offset = (Object.keys(this.inventoryPanels).length % 5) * 20;
    el.style.left = 40 + offset + 'px';
    el.style.top = 40 + offset + 'px';
    el.style.right = 'auto';
    el.style.pointerEvents = 'auto';

    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const setupDrag = (handle: HTMLElement) => {
      handle.addEventListener('mousedown', (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('button, input, select')) return;
        isDragging = true;
        const rect = el.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;

        const onMouseMove = (ev: MouseEvent) => {
          if (!isDragging) return;
          const parent = el.parentElement?.getBoundingClientRect();
          if (!parent) return;
          const x = Math.max(0, Math.min(ev.clientX - parent.left - dragOffsetX, parent.width - 150));
          const y = Math.max(0, Math.min(ev.clientY - parent.top - dragOffsetY, parent.height - 50));
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
        };

        const onMouseUp = () => {
          isDragging = false;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    };

    const handle: InventoryPanelHandle = {
      el,
      tokenId: token.id,
      rebuild: () => {},
      close: () => {
        el.remove();
        delete this.inventoryPanels[token.id];
      },
    };
    this.inventoryPanels[token.id] = handle;

    handle.rebuild = () => {
      el.empty();
      if (!token.inventory) {
        handle.close();
        return;
      }

      // Header
      const header = el.createDiv({ cls: 'dte-panel-header dte-inventory-header' });
      setupDrag(header);

      const titleWrap = header.createDiv({ cls: 'dte-panel-title' });
      const iconSpan = titleWrap.createSpan({ cls: 'dte-panel-icon' });
      setIcon(iconSpan, 'package');
      titleWrap.createSpan({
        cls: 'dte-panel-title-text',
        text: `${t('inventory.title')} — ${token.name || t('common.unnamed')}`,
      });

      const actions = header.createDiv({ cls: 'dte-panel-actions' });
      const closeBtn = actions.createEl('button', {
        cls: 'clickable-icon dte-panel-btn',
        attr: { 'aria-label': t('common.close') },
      });
      setIcon(closeBtn, 'x');
      closeBtn.addEventListener('click', () => handle.close());

      const body = el.createDiv({ cls: 'dte-inventory-body' });

      // Capacity Bar
      const cap = token.inventory.capacity;
      if (cap && cap.mode !== 'none') {
        const capCard = body.createDiv({ cls: 'dte-inventory-capacity-card' });
        let total = 0;
        if (cap.mode === 'weight') {
          total = token.inventory.items.reduce((acc, it) => acc + (it.weight !== null ? it.weight * (it.value || 0) : 0), 0);
          total = Math.round(total * 10) / 10;
        } else {
          total = token.inventory.items.reduce((acc, it) => acc + (it.value || 0), 0);
        }

        const maxVal = Math.max(1, cap.value || 1);
        const ratio = total / maxVal;
        const pct = Math.min(100, Math.max(0, ratio * 100));

        const barOuter = capCard.createDiv({ cls: 'dte-inventory-capacity-bar-outer' });
        const barInner = barOuter.createDiv({ cls: 'dte-inventory-capacity-bar-inner' });
        barInner.style.width = `${pct}%`;
        barInner.style.backgroundColor = ratio > 1 ? '#f44336' : ratio > 0.75 ? '#ff9800' : '#4caf50';

        const capLabel = capCard.createDiv({ cls: 'dte-inventory-capacity-label' });
        const modeText = cap.mode === 'weight' ? t('inventory.capacityWeightLabel') : t('inventory.capacitySlotsLabel');
        capLabel.createSpan({
          text: `${modeText}: ${total} / ${cap.value} ${cap.label || ''}`.trim(),
        });
      }

      // Items List
      const list = body.createDiv({ cls: 'dte-inventory-items-list' });
      if (token.inventory.items.length === 0) {
        list.createDiv({ cls: 'dte-hint dte-inventory-empty', text: t('inventory.empty') });
      } else {
        for (const item of token.inventory.items) {
          const row = list.createDiv({ cls: 'dte-inventory-row' });

          // Pinned checkbox
          const checkWrap = row.createDiv({ cls: 'dte-inventory-row-pinned-wrap' });
          const pinCb = checkWrap.createEl('input', {
            type: 'checkbox',
            cls: 'dte-inventory-pinned-cb',
          });
          pinCb.checked = !!item.pinned;
          pinCb.title = t('inventory.pinnedTooltip');
          pinCb.addEventListener('change', async (e: Event) => {
            e.stopPropagation();
            item.pinned = pinCb.checked;
            await this.plugin.saveSettings();
            this.render();
          });

          // Thumbnail
          if (item.imagePath) {
            const imgFile = this.app.vault.getAbstractFileByPath(item.imagePath);
            if (imgFile) {
              const src = this.app.vault.getResourcePath(imgFile as TFile);
              const thumb = row.createDiv({ cls: 'dte-inventory-thumb' });
              thumb.style.backgroundImage = `url("${src}")`;
            }
          }

          // Main info
          const info = row.createDiv({ cls: 'dte-inventory-row-info' });
          info.createSpan({ cls: 'dte-inventory-row-name', text: item.label || t('common.unnamed') });

          if (item.weight !== null) {
            const wTxt = item.value > 1 && cap.mode === 'weight'
              ? `${Math.round(item.weight * item.value * 10) / 10} ${cap.label || 'kg'}`
              : `${item.weight} ${cap.label || 'kg'}`;
            info.createSpan({ cls: 'dte-inventory-row-weight', text: `(${wTxt})` });
          }

          if (item.note) {
            const noteIcon = row.createEl('button', {
              cls: 'clickable-icon dte-btn-icon dte-inventory-note-btn',
              attr: { 'aria-label': t('common.openNote') },
            });
            setIcon(noteIcon, 'file-text');
            noteIcon.addEventListener('click', (e: MouseEvent) => {
              e.stopPropagation();
              const f = this.app.vault.getAbstractFileByPath(item.note as string);
              if (f) this.openNotePanel(f as TFile);
            });
          }

          // Steppers
          const stepper = row.createDiv({ cls: 'dte-inventory-stepper' });
          const decBtn = stepper.createEl('button', { cls: 'dte-stepper-btn', text: '-' });
          decBtn.addEventListener('click', async (e: MouseEvent) => {
            e.stopPropagation();
            item.value = Math.max(0, item.value - 1);
            await this.plugin.saveSettings();
            handle.rebuild();
            this.render();
          });

          const maxStr = item.max !== null ? `/${item.max}` : '';
          stepper.createSpan({ cls: 'dte-stepper-val', text: `${item.value}${maxStr}` });

          const incBtn = stepper.createEl('button', { cls: 'dte-stepper-btn', text: '+' });
          incBtn.addEventListener('click', async (e: MouseEvent) => {
            e.stopPropagation();
            if (item.max === null || item.value < item.max) {
              item.value = item.value + 1;
              await this.plugin.saveSettings();
              handle.rebuild();
              this.render();
            }
          });

          // Click row to edit item
          row.addEventListener('click', (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('button, input')) return;
            new ItemEditModal(
              this.app,
              item,
              async (savedItem) => {
                Object.assign(item, savedItem);
                await this.plugin.saveSettings();
                handle.rebuild();
                this.render();
              },
              async (delId) => {
                if (token.inventory) {
                  token.inventory.items = token.inventory.items.filter((it) => it.id !== delId);
                  await this.plugin.saveSettings();
                  handle.rebuild();
                  this.render();
                }
              }
            ).open();
          });
        }
      }

      // Footer
      const footer = el.createDiv({ cls: 'dte-inventory-footer' });

      const addItemBtn = footer.createEl('button', {
        cls: 'dte-btn mod-cta',
        text: t('inventory.addItem'),
      });
      const addIcon = addItemBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
      setIcon(addIcon, 'plus');
      addItemBtn.prepend(addIcon);
      addItemBtn.addEventListener('click', () => {
        new ItemEditModal(
          this.app,
          null,
          async (newItem) => {
            if (!token.inventory) token.inventory = { items: [], capacity: { mode: 'none', value: 0, label: '' } };
            token.inventory.items.push(newItem);
            await this.plugin.saveSettings();
            handle.rebuild();
            this.render();
          },
          null
        ).open();
      });

      const capBtn = footer.createEl('button', {
        cls: 'dte-btn',
        text: t('inventory.configureCapacity'),
      });
      const capIcon = capBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
      setIcon(capIcon, 'settings');
      capBtn.prepend(capIcon);
      capBtn.addEventListener('click', () => {
        new CapacityEditModal(
          this.app,
          token.inventory ? token.inventory.capacity : { mode: 'none', value: 0, label: '' },
          async (newCap) => {
            if (token.inventory) {
              token.inventory.capacity = newCap;
              await this.plugin.saveSettings();
              handle.rebuild();
            }
          }
        ).open();
      });

      const removeInvBtn = footer.createEl('button', {
        cls: 'dte-btn mod-warning dte-inventory-remove-btn',
        text: t('inventory.removeInventory'),
      });
      removeInvBtn.addEventListener('click', async () => {
        if (confirm(t('inventory.removeInventoryConfirm', { name: token.name || t('common.unnamed') }))) {
          delete token.inventory;
          await this.plugin.saveSettings();
          handle.close();
          this.render();
        }
      });
    };

    handle.rebuild();
  }

  /* ---------------- Panel flotante de nota ---------------- */

  openNotePanel(file: TFile): void {
    if (!this.panelsLayer) {
      this.containerEl.style.position = 'relative';
      this.panelsLayer = this.containerEl.createDiv({ cls: 'dte-panels-layer' });
    }

    const existing = this.notePanels[file.path];
    if (existing) {
      this.panelsLayer.appendChild(existing.el); // trae al frente (último en el DOM)
      return;
    }

    const el = this.panelsLayer.createDiv({ cls: 'dte-note-panel' });
    const offset = (Object.keys(this.notePanels).length % 6) * 24;
    el.style.left = 30 + offset + 'px';
    el.style.top = 30 + offset + 'px';

    const header = el.createDiv({ cls: 'dte-note-panel-header' });
    header.createSpan({ cls: 'dte-note-panel-title', text: file.basename });
    const headerBtns = header.createDiv({ cls: 'dte-note-panel-header-btns' });
    const toggleBtn = headerBtns.createEl('button', { cls: 'dte-note-panel-toggle', text: t('panel.editMode') });
    const closeBtn = headerBtns.createEl('button', { cls: 'dte-note-panel-close', text: '✕' });

    const body = el.createDiv({ cls: 'dte-note-panel-body' });
    const previewEl = body.createDiv({ cls: 'dte-note-panel-preview markdown-rendered' });
    const textarea = body.createEl('textarea', { cls: 'dte-note-panel-textarea' }) as HTMLTextAreaElement;
    textarea.style.display = 'none';
    textarea.placeholder = t('panel.loading');

    const handle: NotePanelHandle = { el, file, textarea, previewEl, mode: 'preview', rawContent: '' };
    this.notePanels[file.path] = handle;

    const renderPreview = () => renderMarkdownInto(this.app, previewEl, handle.rawContent, file.path, this);

    this.app.vault
      .read(file)
      .then((content) => {
        handle.rawContent = content;
        if (handle.mode === 'preview') renderPreview();
        else textarea.value = content;
      })
      .catch(() => {});

    let saveTimeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleSave = () => {
      handle.rawContent = textarea.value;
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        this.app.vault.modify(file, textarea.value).catch(() => {});
      }, 600);
    };
    textarea.addEventListener('input', scheduleSave);

    toggleBtn.addEventListener('click', () => {
      if (handle.mode === 'preview') {
        handle.mode = 'edit';
        textarea.value = handle.rawContent;
        previewEl.style.display = 'none';
        textarea.style.display = '';
        toggleBtn.setText(t('panel.previewMode'));
        textarea.focus();
      } else {
        if (saveTimeout) clearTimeout(saveTimeout);
        handle.rawContent = textarea.value;
        this.app.vault.modify(file, handle.rawContent).catch(() => {});
        handle.mode = 'preview';
        textarea.style.display = 'none';
        previewEl.style.display = '';
        toggleBtn.setText(t('panel.editMode'));
        renderPreview();
      }
    });

    closeBtn.addEventListener('click', () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      const finalContent = handle.mode === 'edit' ? textarea.value : handle.rawContent;
      this.app.vault.modify(file, finalContent).catch(() => {});
      el.remove();
      delete this.notePanels[file.path];
    });

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    header.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.target === closeBtn || e.target === toggleBtn) return;
      dragging = true;
      const rect = el.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      header.setPointerCapture(e.pointerId);
      el.addClass('dte-note-panel-dragging');
    });
    header.addEventListener('pointermove', (e: PointerEvent) => {
      if (!dragging) return;
      const layerRect = this.panelsLayer.getBoundingClientRect();
      let x = e.clientX - layerRect.left - offsetX;
      let y = e.clientY - layerRect.top - offsetY;
      x = clamp(x, 0, Math.max(0, layerRect.width - el.offsetWidth));
      y = clamp(y, 0, Math.max(0, layerRect.height - el.offsetHeight));
      el.style.left = x + 'px';
      el.style.top = y + 'px';
    });
    const endDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try {
        header.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* noop */
      }
      el.removeClass('dte-note-panel-dragging');
    };
    header.addEventListener('pointerup', endDrag);
    header.addEventListener('pointercancel', endDrag);
  }

  toggleCombatTracker(): void {
    const map = this.getCurrentMap();
    if (!map) return;
    if (this.combatPanel) {
      this.combatPanel.toggleMinimize();
    } else {
      this.combatPanel = new CombatTrackerPanel(this);
    }
  }
}
