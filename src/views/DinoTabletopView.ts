import { ItemView, Menu, Notice, TAbstractFile, TFile, WorkspaceLeaf } from 'obsidian';
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
import { paintDrawingOnCanvas } from '../drawing';
import { FileSuggestModal } from '../modals/FileSuggestModal';
import { NamePromptModal } from '../modals/NamePromptModal';
import { DamageModal } from '../modals/DamageModal';
import { AdjustCounterModal } from '../modals/AdjustCounterModal';
import { TokenEditModal } from '../modals/TokenEditModal';
import { POIEditModal } from '../modals/POIEditModal';
import { NewDrawnMapModal, DrawingEditorModal } from '../modals/DrawingModals';
import { BestiaryListModal } from '../modals/BestiaryModals';

export class DinoTabletopView extends ItemView {
  plugin: any;
  zoom: number;
  metaListener: any;
  panelsLayer: HTMLElement;
  notePanels: Record<string, NotePanelHandle>;

  constructor(leaf: WorkspaceLeaf, plugin: any) {
    super(leaf);
    this.plugin = plugin;
    this.zoom = 1;
    this.notePanels = {};
  }

  getViewType(): string {
    return VIEW_TYPE_DINO;
  }
  getDisplayText(): string {
    return 'Dino Tabletop Engine';
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

  render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('dte-root');

    this.renderHeader(container);

    const camp = this.getCurrentCampaign();
    if (!camp) {
      container.createDiv({ cls: 'dte-empty', text: 'Crea o selecciona una campaña para empezar.' });
      return;
    }
    const map = this.getCurrentMap();
    if (!map) {
      container.createDiv({ cls: 'dte-empty', text: 'Esta campaña no tiene mapas. Añade uno arriba.' });
      return;
    }
    if (!map.pois) map.pois = [];
    this.renderBoard(container, map);
  }

  renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: 'dte-header' });
    const data = this.getData();

    const campSelect = header.createEl('select', { cls: 'dropdown' });
    campSelect.createEl('option', { text: '— Campaña —', value: '' });
    for (const id in data.campaigns) {
      const opt = campSelect.createEl('option', { text: data.campaigns[id].name, value: id });
      if (id === data.currentCampaignId) opt.selected = true;
    }
    campSelect.addEventListener('change', () => {
      data.currentCampaignId = campSelect.value || null;
      this.plugin.saveSettings();
      this.render();
    });

    header.createEl('button', { text: '+ Campaña' }).addEventListener('click', () => {
      new NamePromptModal(this.app, 'Nueva campaña', 'Nombre de la campaña', (name) => {
        if (!name) return;
        const id = genId();
        data.campaigns[id] = { name, maps: {}, currentMapId: null };
        data.currentCampaignId = id;
        this.plugin.saveSettings();
        this.render();
      }).open();
    });

    header.createEl('button', { text: 'Bestiario' }).addEventListener('click', () => {
      new BestiaryListModal(this.app, this.plugin, this).open();
    });

    const camp = this.getCurrentCampaign();
    if (camp && data.currentCampaignId) {
      header.createEl('button', { text: 'Eliminar campaña' }).addEventListener('click', () => {
        if (!confirm(`¿Eliminar la campaña "${camp.name}"? Se perderán todos sus mapas, tokens y puntos de interés. Esta acción no se puede deshacer.`)) return;
        delete data.campaigns[data.currentCampaignId as string];
        data.currentCampaignId = null;
        this.plugin.saveSettings();
        this.render();
      });

      const mapSelect = header.createEl('select', { cls: 'dropdown' });
      mapSelect.createEl('option', { text: '— Mapa —', value: '' });
      for (const id in camp.maps) {
        const opt = mapSelect.createEl('option', { text: camp.maps[id].name, value: id });
        if (id === camp.currentMapId) opt.selected = true;
      }
      mapSelect.addEventListener('change', () => {
        camp.currentMapId = mapSelect.value || null;
        this.plugin.saveSettings();
        this.render();
      });

      header.createEl('button', { text: '+ Mapa (imagen)' }).addEventListener('click', () => {
        new FileSuggestModal(this.app, IMAGE_EXTS, (file) => {
          new NamePromptModal(this.app, 'Nombre del mapa', file.basename, (name) => {
            const id = genId();
            camp.maps[id] = { name: name || file.basename, imagePath: file.path, drawing: null, tokens: [], pois: [] };
            camp.currentMapId = id;
            this.plugin.saveSettings();
            this.render();
          }).open();
        }).open();
      });

      header.createEl('button', { text: '+ Mapa (dibujar)' }).addEventListener('click', () => {
        new NewDrawnMapModal(this.app, (name, width, height) => {
          const id = genId();
          const drawing: DrawingData = { width, height, strokes: [], images: [], backgroundImagePath: null };
          camp.maps[id] = { name, imagePath: null, drawing, tokens: [], pois: [] };
          camp.currentMapId = id;
          this.plugin.saveSettings();
          this.render();
          new DrawingEditorModal(this.app, this.plugin, this, camp.maps[id]).open();
        }).open();
      });

      const map = this.getCurrentMap();
      if (map && camp.currentMapId) {
        header.createEl('button', { text: 'Eliminar mapa' }).addEventListener('click', () => {
          if (!confirm(`¿Eliminar el mapa "${map.name}"? Se perderán sus tokens, puntos de interés y (si lo tiene) el dibujo. Esta acción no se puede deshacer.`)) return;
          delete camp.maps[camp.currentMapId as string];
          camp.currentMapId = null;
          this.plugin.saveSettings();
          this.render();
        });

        if (map.drawing) {
          header.createEl('button', { text: 'Editar dibujo' }).addEventListener('click', () => {
            new DrawingEditorModal(this.app, this.plugin, this, map).open();
          });
        }

        header.createEl('button', { text: '+ Token' }).addEventListener('click', () => {
          const token: TokenData = {
            id: genId(),
            name: '',
            color: '#4c8bf5',
            size: 44,
            x: 50,
            y: 50,
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

        header.createEl('button', { text: '+ Punto de interés' }).addEventListener('click', () => {
          const poi: POIData = { id: genId(), name: '', size: 36, x: 50, y: 50, imagePath: null, linkedNote: null };
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

        const zoomWrap = header.createDiv({ cls: 'dte-zoom' });
        zoomWrap.createSpan({ text: 'Zoom' });
        const zoomInput = zoomWrap.createEl('input', { type: 'range' });
        zoomInput.min = '0.3';
        zoomInput.max = '2';
        zoomInput.step = '0.05';
        zoomInput.value = String(this.zoom);
        zoomInput.addEventListener('input', () => {
          this.zoom = Number(zoomInput.value);
          const boardImg = container.querySelector('.dte-board-inner') as HTMLElement | null;
          if (boardImg) boardImg.style.transform = `scale(${this.zoom})`;
        });
      }
    }
  }

  renderBoard(container: HTMLElement, map: MapData): void {
    const wrap = container.createDiv({ cls: 'dte-board-wrap' });
    const inner = wrap.createDiv({ cls: 'dte-board-inner' });
    inner.style.transform = `scale(${this.zoom})`;

    if (map.imagePath) {
      const file = this.app.vault.getAbstractFileByPath(map.imagePath);
      const src = file ? this.app.vault.getResourcePath(file as TFile) : '';
      inner.createEl('img', { cls: 'dte-map-img', attr: { src } });
    } else if (map.drawing) {
      const canvas = inner.createEl('canvas', { cls: 'dte-map-canvas' }) as HTMLCanvasElement;
      canvas.width = map.drawing.width;
      canvas.height = map.drawing.height;
      const cache: Record<string, HTMLImageElement> = {};
      const drawing = map.drawing;
      const repaint = () => paintDrawingOnCanvas(this.app, canvas, drawing, { imageCache: cache, onImageLoad: repaint });
      repaint();
    }

    for (const poi of map.pois) {
      this.renderPOI(inner, map, poi);
    }
    for (const token of map.tokens) {
      this.renderToken(inner, map, token);
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
          .setTitle('Editar')
          .setIcon('pencil')
          .onClick(() => this.openPOIEditor(map, poi))
      );
      if (poi.linkedNote) {
        menu.addItem((i) =>
          i
            .setTitle('Abrir nota (panel flotante)')
            .setIcon('file-text')
            .onClick(() => {
              const f = this.app.vault.getAbstractFileByPath(poi.linkedNote as string);
              if (f) this.openNotePanel(f as TFile);
            })
        );
      }
      menu.addItem((i) =>
        i
          .setTitle('Eliminar')
          .setIcon('trash')
          .onClick(() => {
            if (!confirm(`¿Eliminar el punto de interés "${poi.name || 'sin nombre'}"? Esta acción no se puede deshacer.`)) return;
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
          .setTitle('Aplicar daño / curación')
          .setIcon('heart-crack')
          .onClick(() => this.openDamageModal(map, token))
      );
      menu.addItem((i) =>
        i
          .setTitle('Editar token')
          .setIcon('pencil')
          .onClick(() => this.openTokenEditor(map, token))
      );
      if (token.linkedNote) {
        menu.addItem((i) =>
          i
            .setTitle('Abrir nota (panel flotante)')
            .setIcon('file-text')
            .onClick(() => {
              const f = this.app.vault.getAbstractFileByPath(token.linkedNote as string);
              if (f) this.openNotePanel(f as TFile);
            })
        );
      }
      menu.addItem((i) =>
        i
          .setTitle('Eliminar token')
          .setIcon('trash')
          .onClick(() => {
            if (!confirm(`¿Eliminar el token "${token.name || 'sin nombre'}"? Esta acción no se puede deshacer.`)) return;
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
    const toggleBtn = headerBtns.createEl('button', { cls: 'dte-note-panel-toggle', text: 'Editar' });
    const closeBtn = headerBtns.createEl('button', { cls: 'dte-note-panel-close', text: '✕' });

    const body = el.createDiv({ cls: 'dte-note-panel-body' });
    const previewEl = body.createDiv({ cls: 'dte-note-panel-preview markdown-rendered' });
    const textarea = body.createEl('textarea', { cls: 'dte-note-panel-textarea' }) as HTMLTextAreaElement;
    textarea.style.display = 'none';
    textarea.placeholder = 'Cargando...';

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
        toggleBtn.setText('Ver');
        textarea.focus();
      } else {
        if (saveTimeout) clearTimeout(saveTimeout);
        handle.rawContent = textarea.value;
        this.app.vault.modify(file, handle.rawContent).catch(() => {});
        handle.mode = 'preview';
        textarea.style.display = 'none';
        previewEl.style.display = '';
        toggleBtn.setText('Editar');
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
}
