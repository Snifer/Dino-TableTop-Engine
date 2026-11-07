import { App, Modal, Notice, setIcon, Setting, TFile } from 'obsidian';
import { DinoPlugin, DinoSettings } from '../../types';
import { SheetTemplate, SheetWidget, WidgetType } from './types';
import { genId } from '../../utils';
import { CharacterSheetRenderer } from './CharacterSheetRenderer';

export class TemplateEditorModal extends Modal {
  private plugin: DinoPlugin;
  private template: SheetTemplate;
  private onSaveCallback: (template: SheetTemplate) => void;
  private dirty: boolean = false;
  private isPreview: boolean = false;
  private zoom: number = 1.0;
  private snapToGrid: boolean = true;
  private gridSize: number = 10;
  private selectedWidgetId: string | null = null;
  private sidebarEl: HTMLElement | null = null;
  private canvasContainer: HTMLElement | null = null;

  // Dummy test data for preview
  private previewData: Record<string, any> = {
    nombre: 'Valeros',
    clase: 'Guerrero',
    nivel: 5,
    fuerza: 16,
    destreza: 12,
    constitucion: 14,
    hp: 28,
    maxHp: 35,
    vida: 28,
    vidaMax: 35,
    inspiracion: true,
    inventario: ['Espada larga +1', 'Escudo de roble', 'Poción de curación x2', 'Cuerda de cáñamo 15m'],
    armas: [
      { nombre: 'Espada larga', ataque: '+6', dano: '1d8+4' },
      { nombre: 'Arco corto', ataque: '+4', dano: '1d6+2' },
    ],
  };

  constructor(
    app: App,
    plugin: DinoPlugin,
    template: SheetTemplate,
    onSave: (template: SheetTemplate) => void
  ) {
    super(app);
    this.plugin = plugin;
    this.template = JSON.parse(JSON.stringify(template));
    this.onSaveCallback = onSave;
  }

  onOpen(): void {
    const { modalEl } = this;
    modalEl.addClass('dte-template-editor-modal');
    modalEl.style.width = '96vw';
    modalEl.style.maxWidth = '1400px';
    modalEl.style.height = '90vh';
    modalEl.style.display = 'flex';
    modalEl.style.flexDirection = 'column';

    this.render();
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.style.display = 'flex';
    contentEl.style.flexDirection = 'column';
    contentEl.style.height = '100%';
    contentEl.style.overflow = 'hidden';

    // 1. Top Header Bar
    this.renderHeader(contentEl);

    // 2. Main Content (Canvas + Inspector Sidebar)
    const mainArea = contentEl.createDiv({ cls: 'dte-editor-main-area' });
    mainArea.style.display = 'flex';
    mainArea.style.flex = '1';
    mainArea.style.overflow = 'hidden';
    mainArea.style.position = 'relative';

    if (this.isPreview) {
      this.renderPreview(mainArea);
    } else {
      this.renderCanvas(mainArea);
      this.sidebarEl = mainArea.createDiv({ cls: 'dte-editor-sidebar' });
      this.renderSidebar();
    }

    // 3. Bottom Tools Palette Bar
    this.renderToolPalette(contentEl);
  }

  /* ---------------- Header Bar ---------------- */

  private renderHeader(parent: HTMLElement): void {
    const header = parent.createDiv({ cls: 'dte-editor-header' });
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.padding = '8px 12px';
    header.style.borderBottom = '1px solid var(--background-modifier-border)';
    header.style.gap = '12px';

    // Left: Back button & Title input
    const leftGroup = header.createDiv({ cls: 'dte-editor-header-left' });
    leftGroup.style.display = 'flex';
    leftGroup.style.alignItems = 'center';
    leftGroup.style.gap = '8px';

    const backBtn = leftGroup.createEl('button', { cls: 'dte-editor-btn', text: '← Atrás' });
    backBtn.addEventListener('click', () => {
      if (this.dirty) {
        if (confirm('Hay cambios sin guardar. ¿Deseas salir sin guardar?')) {
          this.close();
        }
      } else {
        this.close();
      }
    });

    const titleInput = leftGroup.createEl('input', {
      type: 'text',
      cls: 'dte-editor-title-input',
      value: this.template.name,
    });
    titleInput.style.fontWeight = 'bold';
    titleInput.style.fontSize = '16px';
    titleInput.addEventListener('change', () => {
      this.template.name = titleInput.value.trim() || 'Sin título';
      this.dirty = true;
    });

    // Center: Zoom & Grid Snap controls
    const centerGroup = header.createDiv({ cls: 'dte-editor-header-center' });
    centerGroup.style.display = 'flex';
    centerGroup.style.alignItems = 'center';
    centerGroup.style.gap = '6px';

    const zoomOut = centerGroup.createEl('button', { text: '−', cls: 'dte-editor-btn' });
    zoomOut.addEventListener('click', () => {
      if (this.zoom > 0.5) {
        this.zoom = Math.max(0.5, Math.round((this.zoom - 0.1) * 10) / 10);
        this.render();
      }
    });

    centerGroup.createSpan({ text: `${Math.round(this.zoom * 100)}%`, cls: 'dte-editor-zoom-num' });

    const zoomIn = centerGroup.createEl('button', { text: '+', cls: 'dte-editor-btn' });
    zoomIn.addEventListener('click', () => {
      if (this.zoom < 2.0) {
        this.zoom = Math.min(2.0, Math.round((this.zoom + 0.1) * 10) / 10);
        this.render();
      }
    });

    const snapBtn = centerGroup.createEl('button', {
      cls: `dte-editor-btn ${this.snapToGrid ? 'mod-cta' : ''}`,
      text: this.snapToGrid ? '🧲 Cuadrícula 10px' : 'Cuadrícula libre',
    });
    snapBtn.addEventListener('click', () => {
      this.snapToGrid = !this.snapToGrid;
      this.render();
    });

    // Right: Actions (Preview toggle, Save, Export, Duplicate)
    const rightGroup = header.createDiv({ cls: 'dte-editor-header-right' });
    rightGroup.style.display = 'flex';
    rightGroup.style.alignItems = 'center';
    rightGroup.style.gap = '8px';

    const previewBtn = rightGroup.createEl('button', {
      cls: `dte-editor-btn ${this.isPreview ? 'mod-cta' : ''}`,
      text: this.isPreview ? '✏️ Modo Editor' : '👁 Previsualizar',
    });
    previewBtn.addEventListener('click', () => {
      this.isPreview = !this.isPreview;
      this.render();
    });

    const saveBtn = rightGroup.createEl('button', { cls: 'mod-cta', text: '💾 Guardar' });
    saveBtn.addEventListener('click', () => {
      this.saveTemplate();
    });

    const exportBtn = rightGroup.createEl('button', { cls: 'dte-editor-btn', text: 'JSON' });
    exportBtn.title = 'Exportar plantilla como JSON';
    exportBtn.addEventListener('click', () => {
      const json = JSON.stringify(this.template, null, 2);
      navigator.clipboard.writeText(json);
      new Notice('Plantilla copiada al portapapeles en formato JSON');
    });
  }

  /* ---------------- Canvas Area ---------------- */

  private selectWidget(widgetId: string | null): void {
    this.selectedWidgetId = widgetId;
    if (this.canvasContainer) {
      this.canvasContainer.querySelectorAll('.dte-canvas-widget').forEach((node) => {
        const el = node as HTMLElement;
        const isSel = el.dataset.widgetId === widgetId;
        if (isSel) {
          el.addClass('dte-canvas-widget-selected');
          el.style.border = '2px solid var(--interactive-accent)';
        } else {
          el.removeClass('dte-canvas-widget-selected');
          el.style.border = '1px dashed var(--text-muted)';
        }
      });
    }
    this.renderSidebar();
  }

  private renderCanvas(parent: HTMLElement): void {
    const scrollContainer = parent.createDiv({ cls: 'dte-editor-scroll-container' });
    scrollContainer.style.flex = '1';
    scrollContainer.style.overflow = 'auto';
    scrollContainer.style.backgroundColor = 'var(--background-secondary)';
    scrollContainer.style.padding = '30px';
    scrollContainer.style.position = 'relative';

    // Deselect widget when clicking on empty canvas
    scrollContainer.addEventListener('mousedown', (e) => {
      if (e.target === scrollContainer || (e.target as HTMLElement).classList.contains('dte-editor-canvas')) {
        this.selectWidget(null);
      }
    });

    const canvas = scrollContainer.createDiv({ cls: 'dte-editor-canvas' });
    this.canvasContainer = canvas;
    canvas.style.width = `${this.template.width || 800}px`;
    canvas.style.height = `${this.template.height || 1000}px`;
    canvas.style.position = 'relative';
    canvas.style.backgroundColor = 'var(--background-primary)';
    canvas.style.border = '1px solid var(--background-modifier-border)';
    canvas.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';
    canvas.style.transform = `scale(${this.zoom})`;
    canvas.style.transformOrigin = 'top left';

    // Background preview
    if (this.template.background?.path) {
      const bg = canvas.createDiv({ cls: 'dte-editor-canvas-bg' });
      bg.style.position = 'absolute';
      bg.style.inset = '0';
      bg.style.opacity = String(this.template.background.opacity ?? 1);
      bg.style.pointerEvents = 'none';
      const file = this.app.metadataCache.getFirstLinkpathDest(this.template.background.path, '') ||
        this.app.vault.getAbstractFileByPath(this.template.background.path);
      if (file && file instanceof TFile) {
        bg.style.backgroundImage = `url("${this.app.vault.getResourcePath(file)}")`;
        bg.style.backgroundSize = this.template.background.fit === 'contain' ? 'contain' : 'cover';
        bg.style.backgroundPosition = 'center';
      }
    }

    // Render widgets
    for (const widget of this.template.widgets) {
      this.renderCanvasWidget(canvas, widget);
    }
  }

  private renderCanvasWidget(canvas: HTMLElement, widget: SheetWidget): void {
    const isSelected = this.selectedWidgetId === widget.id;
    const el = canvas.createDiv({
      cls: `dte-canvas-widget ${isSelected ? 'dte-canvas-widget-selected' : ''}`,
    });
    el.dataset.widgetId = widget.id;
    el.style.position = 'absolute';
    el.style.left = `${widget.x}px`;
    el.style.top = `${widget.y}px`;
    el.style.width = `${widget.w}px`;
    el.style.height = `${widget.h}px`;
    el.style.zIndex = String(widget.z || 1);
    el.style.boxSizing = 'border-box';
    el.style.cursor = 'move';
    el.style.border = isSelected ? '2px solid var(--interactive-accent)' : '1px dashed var(--text-muted)';
    el.style.borderRadius = `${widget.style?.borderRadius || 4}px`;
    if (widget.style?.backgroundColor) {
      el.style.backgroundColor = widget.style.backgroundColor;
    }

    // Label / info preview
    const badge = el.createDiv({ cls: 'dte-canvas-widget-badge' });
    badge.setText(`${widget.type}${widget.bind ? `: ${widget.bind}` : ''}`);
    badge.style.fontSize = '10px';
    badge.style.color = 'var(--text-muted)';
    badge.style.padding = '2px 4px';
    badge.style.pointerEvents = 'none';

    // Drag move handler
    el.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).classList.contains('dte-widget-resize-handle')) return;
      e.stopPropagation();
      this.selectWidget(widget.id);

      const startX = e.clientX;
      const startY = e.clientY;
      const origX = widget.x;
      const origY = widget.y;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dx = (moveEvent.clientX - startX) / this.zoom;
        const dy = (moveEvent.clientY - startY) / this.zoom;
        let newX = origX + dx;
        let newY = origY + dy;

        if (this.snapToGrid) {
          newX = Math.round(newX / this.gridSize) * this.gridSize;
          newY = Math.round(newY / this.gridSize) * this.gridSize;
        }

        widget.x = Math.max(0, Math.min((this.template.width || 800) - widget.w, Math.round(newX)));
        widget.y = Math.max(0, Math.min((this.template.height || 1000) - widget.h, Math.round(newY)));

        el.style.left = `${widget.x}px`;
        el.style.top = `${widget.y}px`;
        this.dirty = true;
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        if (this.selectedWidgetId === widget.id) {
          this.renderSidebar();
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Resize handle on bottom-right corner
    if (isSelected) {
      const resizeHandle = el.createDiv({ cls: 'dte-widget-resize-handle' });
      resizeHandle.style.position = 'absolute';
      resizeHandle.style.right = '-4px';
      resizeHandle.style.bottom = '-4px';
      resizeHandle.style.width = '10px';
      resizeHandle.style.height = '10px';
      resizeHandle.style.backgroundColor = 'var(--interactive-accent)';
      resizeHandle.style.cursor = 'se-resize';

      resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const origW = widget.w;
        const origH = widget.h;

        const onResizeMove = (moveEvent: MouseEvent) => {
          const dx = (moveEvent.clientX - startX) / this.zoom;
          const dy = (moveEvent.clientY - startY) / this.zoom;
          let newW = origW + dx;
          let newH = origH + dy;

          if (this.snapToGrid) {
            newW = Math.round(newW / this.gridSize) * this.gridSize;
            newH = Math.round(newH / this.gridSize) * this.gridSize;
          }

          widget.w = Math.max(20, Math.round(newW));
          widget.h = Math.max(20, Math.round(newH));

          el.style.width = `${widget.w}px`;
          el.style.height = `${widget.h}px`;
          this.dirty = true;
        };

        const onResizeUp = () => {
          window.removeEventListener('mousemove', onResizeMove);
          window.removeEventListener('mouseup', onResizeUp);
          this.render();
        };

        window.addEventListener('mousemove', onResizeMove);
        window.addEventListener('mouseup', onResizeUp);
      });
    }
  }

  /* ---------------- Sidebar Inspector ---------------- */

  private renderSidebar(parent?: HTMLElement): void {
    if (parent) {
      this.sidebarEl = parent.createDiv({ cls: 'dte-editor-sidebar' });
    }
    if (!this.sidebarEl) return;

    this.sidebarEl.empty();
    const sidebar = this.sidebarEl;
    sidebar.style.width = '320px';
    sidebar.style.borderLeft = '1px solid var(--background-modifier-border)';
    sidebar.style.overflowY = 'auto';
    sidebar.style.padding = '12px';
    sidebar.style.backgroundColor = 'var(--background-secondary)';

    const selectedWidget = this.template.widgets.find((w) => w.id === this.selectedWidgetId);

    if (!selectedWidget) {
      sidebar.createEl('h3', { text: 'Configuración general' });

      new Setting(sidebar)
        .setName('Ancho del lienzo')
        .addText((txt) =>
          txt.setValue(String(this.template.width || 800)).onChange((val) => {
            const num = parseInt(val, 10);
            if (!isNaN(num) && num >= 300) {
              this.template.width = num;
              this.dirty = true;
            }
          })
        );

      new Setting(sidebar)
        .setName('Alto del lienzo')
        .addText((txt) =>
          txt.setValue(String(this.template.height || 1000)).onChange((val) => {
            const num = parseInt(val, 10);
            if (!isNaN(num) && num >= 300) {
              this.template.height = num;
              this.dirty = true;
            }
          })
        );

      new Setting(sidebar)
        .setName('Imagen de Fondo')
        .setDesc('Ruta en la bóveda')
        .addText((txt) =>
          txt.setValue(this.template.background?.path || '').onChange((val) => {
            if (!this.template.background) {
              this.template.background = { path: '', fit: 'cover', opacity: 1 };
            }
            this.template.background.path = val.trim();
            this.dirty = true;
          })
        );

      new Setting(sidebar)
        .setName('Ajuste de Fondo')
        .addDropdown((dd) =>
          dd
            .addOption('cover', 'Cubrir (cover)')
            .addOption('contain', 'Contener (contain)')
            .setValue(this.template.background?.fit || 'cover')
            .onChange((val) => {
              if (this.template.background) {
                this.template.background.fit = val as 'cover' | 'contain';
                this.dirty = true;
                this.render();
              }
            })
        );

      new Setting(sidebar)
        .setName('Opacidad de Fondo')
        .addSlider((sl) =>
          sl
            .setLimits(0.1, 1, 0.05)
            .setValue(this.template.background?.opacity ?? 1)
            .onChange((val) => {
              if (this.template.background) {
                this.template.background.opacity = val;
                this.dirty = true;
              }
            })
        );

      sidebar.createEl('hr');
      const hint = sidebar.createDiv({ cls: 'dte-sidebar-hint' });
      hint.setText('Haz clic en un widget del lienzo para editar sus propiedades o arrastra una herramienta abajo para crearlo.');
      return;
    }

    // Widget specific inspector
    sidebar.createEl('h3', { text: `Widget: ${selectedWidget.type.toUpperCase()}` });

    // Position & Size row
    const posRow = sidebar.createDiv({ cls: 'dte-sidebar-pos-row' });
    posRow.style.display = 'grid';
    posRow.style.gridTemplateColumns = '1fr 1fr';
    posRow.style.gap = '8px';
    posRow.style.marginBottom = '12px';

    posRow.createDiv({ text: `X: ${selectedWidget.x}px  Y: ${selectedWidget.y}px` });
    posRow.createDiv({ text: `W: ${selectedWidget.w}px  H: ${selectedWidget.h}px` });

    // Bind property
    new Setting(sidebar)
      .setName('Propiedad vinculada (bind)')
      .setDesc('Clave frontmatter en la nota (ej. exp, fuerza, oro). Obligatorio para que los datos se guarden en la nota.')
      .addText((txt) =>
        txt.setValue(selectedWidget.bind || '').setPlaceholder('ej. fuerza, exp, oro').onChange((val) => {
          selectedWidget.bind = val.trim();
          this.dirty = true;
          if (this.canvasContainer) {
            const badge = this.canvasContainer.querySelector(`[data-widget-id="${selectedWidget.id}"] .dte-canvas-widget-badge`);
            if (badge) {
              badge.setText(`${selectedWidget.type}${selectedWidget.bind ? `: ${selectedWidget.bind}` : ''}`);
            }
          }
        })
      );

    // Title / Label text
    new Setting(sidebar)
      .setName('Título / Etiqueta')
      .addText((txt) =>
        txt.setValue(selectedWidget.style?.title || '').onChange((val) => {
          if (!selectedWidget.style) selectedWidget.style = {};
          selectedWidget.style.title = val;
          this.dirty = true;
        })
      );

    // Specific Widget Settings
    if (selectedWidget.type === 'counter') {
      new Setting(sidebar)
        .setName('Mínimo')
        .setDesc('Número o @clave (opcional)')
        .addText((txt) =>
          txt.setValue(selectedWidget.min !== undefined ? String(selectedWidget.min) : '').onChange((val) => {
            const trimmed = val.trim();
            if (trimmed === '' || trimmed.toLowerCase() === 'none') {
              delete selectedWidget.min;
            } else {
              selectedWidget.min = trimmed;
            }
            this.dirty = true;
          })
        );

      const hasMax = selectedWidget.max !== undefined && selectedWidget.max !== null && String(selectedWidget.max).trim() !== '' && String(selectedWidget.max).trim().toLowerCase() !== 'none';

      new Setting(sidebar)
        .setName('Límite máximo (tope)')
        .setDesc('Actívalo si el recurso tiene un tope (ej. PS / 20). Desactívalo para contadores sin límite (ej. Experiencia, Oro, Raciones).')
        .addToggle((toggle) =>
          toggle.setValue(hasMax).onChange((enabled) => {
            if (enabled) {
              selectedWidget.max = 100;
              selectedWidget.display = 'both';
            } else {
              delete selectedWidget.max;
              selectedWidget.display = 'number';
            }
            this.dirty = true;
            this.renderSidebar();
          })
        );

      if (hasMax) {
        new Setting(sidebar)
          .setName('Valor Máximo')
          .setDesc('Número fijo (ej. 20) o @clave de otra propiedad (ej. @vidaMax)')
          .addText((txt) =>
            txt.setValue(String(selectedWidget.max ?? '')).onChange((val) => {
              const trimmed = val.trim();
              if (trimmed === '' || trimmed.toLowerCase() === 'none') {
                delete selectedWidget.max;
              } else {
                selectedWidget.max = trimmed;
              }
              this.dirty = true;
            })
          );
      }

      new Setting(sidebar)
        .setName('Paso (+/-)')
        .addText((txt) =>
          txt.setValue(String(selectedWidget.step ?? 1)).onChange((val) => {
            selectedWidget.step = parseFloat(val) || 1;
            this.dirty = true;
          })
        );

      new Setting(sidebar)
        .setName('Modo visualización')
        .addDropdown((dd) => {
          dd.addOption('number', 'Solo número');
          if (hasMax) {
            dd.addOption('bar', 'Solo barra');
            dd.addOption('both', 'Ambos (número y barra)');
          }
          dd.setValue(selectedWidget.display || (hasMax ? 'both' : 'number'))
            .onChange((val) => {
              selectedWidget.display = val as any;
              this.dirty = true;
            });
        });
    }

    if (selectedWidget.type === 'button' || selectedWidget.type === 'counter') {
      new Setting(sidebar)
        .setName('Fórmula de tirada')
        .setDesc('Ej. 1d20 + @fuerza')
        .addText((txt) =>
          txt.setValue(selectedWidget.action?.formula || '').onChange((val) => {
            if (!selectedWidget.action) selectedWidget.action = { formula: '' };
            selectedWidget.action.formula = val;
            this.dirty = true;
          })
        );

      new Setting(sidebar)
        .setName('Motivo de tirada')
        .addText((txt) =>
          txt.setValue(selectedWidget.action?.reason || '').onChange((val) => {
            if (!selectedWidget.action) selectedWidget.action = { formula: '' };
            selectedWidget.action.reason = val;
            this.dirty = true;
          })
        );
    }

    if (selectedWidget.type === 'calculated') {
      new Setting(sidebar)
        .setName('Fórmula matemática')
        .setDesc('Ej. floor((@fuerza - 10) / 2)')
        .addText((txt) =>
          txt.setValue(selectedWidget.formula || '').onChange((val) => {
            selectedWidget.formula = val;
            this.dirty = true;
          })
        );
    }

    if (selectedWidget.type === 'text') {
      new Setting(sidebar)
        .setName('Líneas')
        .addText((txt) =>
          txt.setValue(String(selectedWidget.lines || 1)).onChange((val) => {
            selectedWidget.lines = parseInt(val, 10) || 1;
            this.dirty = true;
          })
        );

      new Setting(sidebar)
        .setName('Placeholder')
        .addText((txt) =>
          txt.setValue(selectedWidget.placeholder || '').onChange((val) => {
            selectedWidget.placeholder = val;
            this.dirty = true;
          })
        );
    }

    if (selectedWidget.type === 'image') {
      new Setting(sidebar)
        .setName('Forma de la imagen')
        .addDropdown((dd) =>
          dd
            .addOption('square', 'Cuadrada')
            .addOption('circle', 'Circular')
            .setValue(selectedWidget.shape || 'square')
            .onChange((val) => {
              selectedWidget.shape = val as any;
              this.dirty = true;
            })
        );

      new Setting(sidebar)
        .setName('Ajuste')
        .addDropdown((dd) =>
          dd
            .addOption('cover', 'Cubrir (cover)')
            .addOption('contain', 'Contener (contain)')
            .setValue(selectedWidget.fit || 'cover')
            .onChange((val) => {
              selectedWidget.fit = val as any;
              this.dirty = true;
            })
        );
    }

    // ── Typography Section ──────────────────────────────────────────────────
    if (['label', 'text', 'counter', 'frame', 'calculated', 'button', 'check', 'list', 'grid'].includes(selectedWidget.type)) {
      sidebar.createEl('hr');
      sidebar.createEl('h4', { text: 'Tipografía' });

      // Bold / Italic — icon toggle buttons
      const fmtRow = sidebar.createDiv({ cls: 'dte-typo-fmt-row' });
      fmtRow.style.display = 'flex';
      fmtRow.style.gap = '6px';
      fmtRow.style.marginBottom = '10px';

      const isBold = selectedWidget.style?.fontWeight === 'bold';
      const boldBtn = fmtRow.createEl('button', { text: 'B', cls: `dte-editor-btn${isBold ? ' is-active' : ''}` });
      boldBtn.style.fontWeight = 'bold';
      boldBtn.style.minWidth = '36px';
      boldBtn.setAttribute('aria-label', 'Negrita');
      boldBtn.addEventListener('click', () => {
        if (!selectedWidget.style) selectedWidget.style = {};
        selectedWidget.style.fontWeight = selectedWidget.style.fontWeight === 'bold' ? 'normal' : 'bold';
        this.dirty = true;
        this.renderSidebar();
      });

      const isItalic = selectedWidget.style?.fontStyle === 'italic';
      const italicBtn = fmtRow.createEl('button', { text: 'I', cls: `dte-editor-btn${isItalic ? ' is-active' : ''}` });
      italicBtn.style.fontStyle = 'italic';
      italicBtn.style.minWidth = '36px';
      italicBtn.setAttribute('aria-label', 'Cursiva');
      italicBtn.addEventListener('click', () => {
        if (!selectedWidget.style) selectedWidget.style = {};
        selectedWidget.style.fontStyle = selectedWidget.style.fontStyle === 'italic' ? 'normal' : 'italic';
        this.dirty = true;
        this.renderSidebar();
      });

      const isUnderline = selectedWidget.style?.textDecoration === 'underline';
      const underlineBtn = fmtRow.createEl('button', { text: 'U', cls: `dte-editor-btn${isUnderline ? ' is-active' : ''}` });
      underlineBtn.style.textDecoration = 'underline';
      underlineBtn.style.minWidth = '36px';
      underlineBtn.setAttribute('aria-label', 'Subrayado');
      underlineBtn.addEventListener('click', () => {
        if (!selectedWidget.style) selectedWidget.style = {};
        selectedWidget.style.textDecoration = selectedWidget.style.textDecoration === 'underline' ? 'none' : 'underline';
        this.dirty = true;
        this.renderSidebar();
      });

      const isStrike = selectedWidget.style?.textDecoration === 'line-through';
      const strikeBtn = fmtRow.createEl('button', { text: 'S̶', cls: `dte-editor-btn${isStrike ? ' is-active' : ''}` });
      strikeBtn.style.minWidth = '36px';
      strikeBtn.setAttribute('aria-label', 'Tachado');
      strikeBtn.addEventListener('click', () => {
        if (!selectedWidget.style) selectedWidget.style = {};
        selectedWidget.style.textDecoration = selectedWidget.style.textDecoration === 'line-through' ? 'none' : 'line-through';
        this.dirty = true;
        this.renderSidebar();
      });

      // Text Align — 3-button toggle
      const alignRow = sidebar.createDiv({ cls: 'dte-typo-align-row' });
      alignRow.style.display = 'flex';
      alignRow.style.gap = '6px';
      alignRow.style.marginBottom = '10px';

      const currentAlign = selectedWidget.style?.textAlign || 'left';
      (['left', 'center', 'right'] as const).forEach((align) => {
        const icon = align === 'left' ? '⬛◻◻' : align === 'center' ? '◻⬛◻' : '◻◻⬛';
        const label = align === 'left' ? 'Izquierda' : align === 'center' ? 'Centrado' : 'Derecha';
        const btn = alignRow.createEl('button', {
          text: label,
          cls: `dte-editor-btn${currentAlign === align ? ' is-active' : ''}`,
        });
        btn.style.flex = '1';
        btn.setAttribute('aria-label', label);
        btn.addEventListener('click', () => {
          if (!selectedWidget.style) selectedWidget.style = {};
          selectedWidget.style.textAlign = align;
          this.dirty = true;
          this.renderSidebar();
        });
      });

      // Font Size
      new Setting(sidebar)
        .setName('Tamaño de fuente')
        .setDesc('Píxeles (ej. 14). Dejar vacío para heredar.')
        .addText((txt) =>
          txt
            .setValue(selectedWidget.style?.fontSize !== undefined ? String(selectedWidget.style.fontSize) : '')
            .setPlaceholder('ej. 14')
            .onChange((val) => {
              if (!selectedWidget.style) selectedWidget.style = {};
              const num = parseInt(val, 10);
              if (isNaN(num) || val.trim() === '') {
                delete selectedWidget.style.fontSize;
              } else {
                selectedWidget.style.fontSize = num;
              }
              this.dirty = true;
            })
        );

      // Text Color
      new Setting(sidebar)
        .setName('Color de texto')
        .addColorPicker((cp) =>
          cp.setValue(selectedWidget.style?.textColor || '#ffffff').onChange((val) => {
            if (!selectedWidget.style) selectedWidget.style = {};
            selectedWidget.style.textColor = val;
            this.dirty = true;
          })
        );
    }

    // Layers (Z-Index)
    sidebar.createEl('h4', { text: 'Capas y orden' });
    const layerRow = sidebar.createDiv({ cls: 'dte-layer-btn-row' });
    layerRow.style.display = 'flex';
    layerRow.style.gap = '6px';
    layerRow.style.marginBottom = '12px';

    const bringFwd = layerRow.createEl('button', { text: 'Al frente', cls: 'dte-editor-btn' });
    bringFwd.addEventListener('click', () => {
      selectedWidget.z = (selectedWidget.z || 1) + 1;
      this.dirty = true;
      this.render();
    });

    const sendBwd = layerRow.createEl('button', { text: 'Atrás', cls: 'dte-editor-btn' });
    sendBwd.addEventListener('click', () => {
      selectedWidget.z = Math.max(1, (selectedWidget.z || 1) - 1);
      this.dirty = true;
      this.render();
    });

    // Delete Widget
    sidebar.createEl('hr');
    const delBtn = sidebar.createEl('button', { cls: 'mod-warning', text: '🗑 Eliminar Widget' });
    delBtn.style.width = '100%';
    delBtn.addEventListener('click', () => {
      this.template.widgets = this.template.widgets.filter((w) => w.id !== selectedWidget.id);
      this.selectedWidgetId = null;
      this.dirty = true;
      this.render();
    });
  }

  /* ---------------- Preview Area ---------------- */

  private renderPreview(parent: HTMLElement): void {
    const previewWrap = parent.createDiv({ cls: 'dte-editor-preview-wrap' });
    previewWrap.style.flex = '1';
    previewWrap.style.overflow = 'auto';
    previewWrap.style.backgroundColor = 'var(--background-secondary)';
    previewWrap.style.padding = '30px';

    const sheetContainer = previewWrap.createDiv({ cls: 'dte-preview-sheet-container' });

    const renderer = new CharacterSheetRenderer(
      this.app,
      this.plugin,
      this.template,
      this.previewData,
      sheetContainer,
      {
        onUpdateKey: (key, val) => {
          this.previewData[key] = val;
        },
      }
    );

    renderer.setScale(this.zoom);
    renderer.render();
  }

  /* ---------------- Tool Palette ---------------- */

  private renderToolPalette(parent: HTMLElement): void {
    const palette = parent.createDiv({ cls: 'dte-editor-palette' });
    palette.style.display = 'flex';
    palette.style.alignItems = 'center';
    palette.style.gap = '8px';
    palette.style.padding = '10px 14px';
    palette.style.borderTop = '1px solid var(--background-modifier-border)';
    palette.style.backgroundColor = 'var(--background-primary)';
    palette.style.flexWrap = 'wrap';

    palette.createSpan({ text: 'Añadir:', cls: 'dte-palette-label', attr: { style: 'font-weight:bold;' } });

    const tools: { type: WidgetType; label: string; icon: string; w: number; h: number }[] = [
      { type: 'frame', label: 'Recuadro', icon: 'square', w: 240, h: 180 },
      { type: 'counter', label: 'Contador', icon: 'hash', w: 160, h: 70 },
      { type: 'label', label: 'Literal', icon: 'type', w: 140, h: 36 },
      { type: 'check', label: 'Casilla', icon: 'check-square', w: 120, h: 36 },
      { type: 'button', label: 'Botón', icon: 'play', w: 120, h: 40 },
      { type: 'grid', label: 'Cuadrícula', icon: 'table', w: 320, h: 160 },
      { type: 'text', label: 'Texto', icon: 'file-text', w: 200, h: 40 },
      { type: 'list', label: 'Lista', icon: 'list', w: 200, h: 150 },
      { type: 'image', label: 'Imagen', icon: 'image', w: 120, h: 120 },
      { type: 'calculated', label: 'Calculado', icon: 'calculator', w: 140, h: 50 },
    ];

    for (const tool of tools) {
      const btn = palette.createEl('button', { cls: 'dte-palette-btn' });
      btn.style.display = 'inline-flex';
      btn.style.alignItems = 'center';
      btn.style.gap = '6px';
      const icon = btn.createSpan();
      setIcon(icon, tool.icon);
      btn.createSpan({ text: tool.label });

      btn.addEventListener('click', () => {
        this.addWidget(tool.type, tool.w, tool.h, tool.label);
      });
    }
  }

  private addWidget(type: WidgetType, w: number, h: number, defaultTitle: string): void {
    const centerX = Math.round(((this.template.width || 800) / 2) - (w / 2));
    const centerY = Math.round(((this.template.height || 1000) / 2) - (h / 2));

    const maxZ = this.template.widgets.reduce((acc, curr) => Math.max(acc, curr.z || 1), 1);

    const newWidget: SheetWidget = {
      id: genId(),
      type,
      x: this.snapToGrid ? Math.round(centerX / this.gridSize) * this.gridSize : centerX,
      y: this.snapToGrid ? Math.round(centerY / this.gridSize) * this.gridSize : centerY,
      w,
      h,
      z: maxZ + 1,
      style: {
        title: defaultTitle,
        border: type === 'frame',
        borderWidth: 1,
        borderRadius: 4,
        backgroundColor: type === 'frame' ? 'var(--background-secondary)' : undefined,
      },
    };

    if (type === 'counter') {
      newWidget.min = 0;
      delete newWidget.max;
      newWidget.step = 1;
      newWidget.display = 'number';
    } else if (type === 'calculated') {
      newWidget.formula = '@fuerza + 2';
    } else if (type === 'grid') {
      newWidget.columns = [
        { key: 'name', label: 'Nombre', type: 'text' },
        { key: 'qty', label: 'Cantidad', type: 'number' },
      ];
    } else if (type === 'button') {
      newWidget.action = {
        formula: '1d20 + @fuerza',
        reason: 'Ataque',
        render: true,
      };
    }

    this.template.widgets.push(newWidget);
    this.selectedWidgetId = newWidget.id;
    this.dirty = true;
    this.render();
  }

  private saveTemplate(): void {
    const s = this.plugin.settings as DinoSettings;
    if (!s.sheetTemplates) s.sheetTemplates = [];
    if (!s.characterSheets) s.characterSheets = { property: 'dte-sheet', templates: [] };

    // Update in settings
    const idx = s.sheetTemplates.findIndex((t) => t.id === this.template.id);
    if (idx >= 0) {
      s.sheetTemplates[idx] = this.template;
    } else {
      s.sheetTemplates.push(this.template);
    }
    s.characterSheets.templates = s.sheetTemplates;

    this.plugin.saveSettings().then(() => {
      this.dirty = false;
      this.onSaveCallback(this.template);
      new Notice(`Plantilla "${this.template.name}" guardada.`);
    });
  }
}
