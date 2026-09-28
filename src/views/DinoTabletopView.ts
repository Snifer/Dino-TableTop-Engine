import { ItemView, Menu, Notice, TAbstractFile, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
import {
  VIEW_TYPE_DINO,
  HP_KEYS,
  MAXHP_KEYS,
  IMAGE_KEYS,
  IMAGE_EXTS,
  DinoSettings,
  CampaignData,
  MapData,
  TokenData,
  POIData,
  DrawingData,
  CounterData,
  NotePanelHandle,
} from '../types';
import {
  genId,
  clamp,
  getIconClass,
  readFrontmatterStat,
  readFrontmatterImagePath,
  renderMarkdownInto,
} from '../utils';
import { t } from '../i18n';
import { paintDrawingOnCanvas } from '../drawing';
import { FileSuggestModal } from '../modals/FileSuggestModal';
import { NamePromptModal } from '../modals/NamePromptModal';
import { DamageModal } from '../modals/DamageModal';
import { AdjustCounterModal } from '../modals/AdjustCounterModal';
import { TokenEditModal } from '../modals/TokenEditModal';
import { POIEditModal } from '../modals/POIEditModal';
import { NewDrawnMapModal, DrawingEditorModal } from '../modals/DrawingModals';
import { BestiaryListModal } from '../modals/BestiaryModals';
import { ModulesModal } from '../modals/ModulesModal';
import { moduleRegistry } from '../modules/registry';
import { CombatTrackerPanel, AdjustConditionModal, AddConditionModal } from '../modules/combatTracker';

export class DinoTabletopView extends ItemView {
  plugin: any;
  zoom: number;
  metaListener: any;
  panelsLayer: HTMLElement;
  notePanels: Record<string, NotePanelHandle>;
  combatPanel: CombatTrackerPanel | null;

  constructor(leaf: WorkspaceLeaf, plugin: any) {
    super(leaf);
    this.plugin = plugin;
    this.zoom = 1;
    this.notePanels = {};
    this.combatPanel = null;
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
    if (this.combatPanel) {
      this.combatPanel.destroy();
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
      }
    }
    if (changed) {
      this.plugin.saveSettings();
      this.render();
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

    // ==========================================
    // SECCIÓN 1: CAMPAÑA
    // ==========================================
    const campGroup = header.createDiv({ cls: 'dte-toolbar-group' });

    // Dropdown de Campañas
    const campSelect = campGroup.createEl('select', { cls: 'dropdown dte-select' });
    campSelect.createEl('option', { text: t('header.selectCampaign'), value: '' });
    for (const id in data.campaigns) {
      const opt = campSelect.createEl('option', { text: data.campaigns[id].name, value: id });
      if (id === data.currentCampaignId) opt.selected = true;
    }
    campSelect.addEventListener('change', () => {
      data.currentCampaignId = campSelect.value || null;
      this.plugin.saveSettings();
      this.render();
    });

    // Botón + Campaña
    const addCampBtn = campGroup.createEl('button', {
      cls: 'clickable-icon dte-btn-icon',
      attr: { 'aria-label': t('header.newCampaign') },
    });
    setIcon(addCampBtn, 'folder-plus');
    addCampBtn.addEventListener('click', () => {
      new NamePromptModal(this.app, t('header.newCampaign'), t('header.campaignNamePrompt'), (name) => {
        if (!name) return;
        const id = genId();
        data.campaigns[id] = { name, maps: {}, currentMapId: null };
        data.currentCampaignId = id;
        this.plugin.saveSettings();
        this.render();
      }).open();
    });

    // Botón Bestiario
    const bestiaryBtn = campGroup.createEl('button', { cls: 'dte-btn', text: t('header.bestiary') });
    const bestiaryIcon = bestiaryBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(bestiaryIcon, 'book-open');
    bestiaryBtn.prepend(bestiaryIcon);
    bestiaryBtn.addEventListener('click', () => {
      new BestiaryListModal(this.app, this.plugin, this).open();
    });

    // Menú de opciones de Campaña (acciones secundarias / destructivas)
    if (camp && data.currentCampaignId) {
      const campMenuBtn = campGroup.createEl('button', {
        cls: 'clickable-icon dte-btn-icon',
        attr: { 'aria-label': t('header.campaignOptions') },
      });
      setIcon(campMenuBtn, 'more-vertical');
      campMenuBtn.addEventListener('click', (e: MouseEvent) => {
        const menu = new Menu();
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
        menu.addSeparator();
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
        menu.showAtMouseEvent(e);
      });
    }

    // ==========================================
    // SECCIÓN 2: MAPA (si hay campaña activa)
    // ==========================================
    if (camp && data.currentCampaignId) {
      const mapGroup = header.createDiv({ cls: 'dte-toolbar-group' });

      // Dropdown de Mapas
      const mapSelect = mapGroup.createEl('select', { cls: 'dropdown dte-select' });
      mapSelect.createEl('option', { text: t('header.selectMap'), value: '' });
      for (const id in camp.maps) {
        const opt = mapSelect.createEl('option', { text: camp.maps[id].name, value: id });
        if (id === camp.currentMapId) opt.selected = true;
      }
      mapSelect.addEventListener('change', () => {
        camp.currentMapId = mapSelect.value || null;
        this.plugin.saveSettings();
        this.render();
      });

      // Botón + Mapa con submenú (Imagen o Dibujar)
      const addMapBtn = mapGroup.createEl('button', { cls: 'dte-btn', text: t('header.addMap') });
      const addMapIcon = addMapBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
      setIcon(addMapIcon, 'map');
      addMapBtn.prepend(addMapIcon);
      addMapBtn.addEventListener('click', (e: MouseEvent) => {
        const menu = new Menu();
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
        menu.showAtMouseEvent(e);
      });

      // Si el mapa actual es dibujado, botón para editar dibujo
      if (map && map.drawing) {
        const editDrawingBtn = mapGroup.createEl('button', { cls: 'dte-btn', text: t('header.editDrawing') });
        const editIcon = editDrawingBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
        setIcon(editIcon, 'pencil');
        editDrawingBtn.prepend(editIcon);
        editDrawingBtn.addEventListener('click', () => {
          new DrawingEditorModal(this.app, this.plugin, this, map).open();
        });
      }

      // Menú de opciones de Mapa (acciones secundarias / destructivas)
      if (map && camp.currentMapId) {
        const mapMenuBtn = mapGroup.createEl('button', {
          cls: 'clickable-icon dte-btn-icon',
          attr: { 'aria-label': t('header.mapOptions') },
        });
        setIcon(mapMenuBtn, 'more-vertical');
        mapMenuBtn.addEventListener('click', (e: MouseEvent) => {
          const menu = new Menu();
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
          menu.addSeparator();
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
          menu.showAtMouseEvent(e);
        });
      }
    }

    // ==========================================
    // SECCIÓN 3: ACCIONES DE TABLERO (Tokens y POIs)
    // ==========================================
    if (map) {
      const boardGroup = header.createDiv({ cls: 'dte-toolbar-group' });

      // Botón + Token (destacado)
      const addTokenBtn = boardGroup.createEl('button', { cls: 'mod-cta dte-btn', text: t('header.addToken') });
      const tokenIcon = addTokenBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
      setIcon(tokenIcon, 'user-plus');
      addTokenBtn.prepend(tokenIcon);
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
      const addPoiBtn = boardGroup.createEl('button', { cls: 'dte-btn', text: t('header.addPoi') });
      const poiIcon = addPoiBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
      setIcon(poiIcon, 'map-pin');
      addPoiBtn.prepend(poiIcon);
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

      // Botón de Gestión de Módulos (rápido en tablero)
      const modulesBtn = boardGroup.createEl('button', {
        cls: 'clickable-icon dte-btn-icon',
        attr: { 'aria-label': t('header.modules') },
      });
      setIcon(modulesBtn, 'puzzle');
      modulesBtn.addEventListener('click', () => {
        new ModulesModal(this.app, this.plugin, this).open();
      });

      // ==========================================
      // SECCIÓN 4: MÓDULOS ACTIVOS
      // ==========================================
      const activeMods = moduleRegistry.getAll().filter((m) => moduleRegistry.isEnabled(data, m.id));
      if (activeMods.length > 0) {
        const modGroup = header.createDiv({ cls: 'dte-toolbar-group' });
        for (const mod of activeMods) {
          if (mod.renderToolbarButton) {
            mod.renderToolbarButton(modGroup, this);
          }
        }
      }

      // ==========================================
      // SECCIÓN 5: CONTROLES DE ZOOM COMPACTOS
      // ==========================================
      const zoomGroup = header.createDiv({ cls: 'dte-toolbar-zoom' });

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

    for (const poi of map.pois) {
      this.renderPOI(inner, map, poi);
    }
    for (const token of map.tokens) {
      this.renderToken(inner, map, token);
    }

    if (savedScroll) {
      wrap.scrollLeft = savedScroll.left;
      wrap.scrollTop = savedScroll.top;
    }
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
      Object.assign({}, token, { counters: (token.counters || []).map((c) => Object.assign({}, c)) }),
      (saved) => {
        Object.assign(token, saved);
        this.plugin.saveSettings();
        this.render();
      },
      (toDelete) => {
        map.tokens = map.tokens.filter((t) => t.id !== toDelete.id);
        this.plugin.saveSettings();
        this.render();
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

    if (token.counters && token.counters.length) {
      const row = el.createDiv({ cls: 'dte-counters-row' });
      for (const c of token.counters) {
        const maxTxt = c.max !== null && c.max !== undefined ? `/${c.max}` : '';
        const badge = row.createDiv({ cls: 'dte-counter-badge', text: `${c.label}: ${c.value}${maxTxt}` });
        badge.addEventListener('pointerdown', (e: PointerEvent) => e.stopPropagation());
        badge.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation();
          new AdjustCounterModal(this.app, c, (delta) => this.applyCounterDelta(token, c, delta)).open();
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
