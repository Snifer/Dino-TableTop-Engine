import { App, Notice, TFile, setIcon } from 'obsidian';
import { DinoPlugin, DinoSettings, IPanel } from '../../types';
import { SheetTemplate } from './types';
import { CharacterSheetRenderer } from './CharacterSheetRenderer';
import { FrontmatterSyncManager } from './frontmatterSync';
import { TemplateEditorModal } from './TemplateEditorModal';
import { SelectTemplateModal } from './SelectTemplateModal';

export class CharacterSheetPanel implements IPanel {
  public app: App;
  public plugin: DinoPlugin;
  public container: HTMLElement;
  public el: HTMLElement;
  public file: TFile;
  public template: SheetTemplate;
  public syncManager: FrontmatterSyncManager;
  public minimized: boolean = false;

  private renderer: CharacterSheetRenderer | null = null;
  private unsubscribeSync: (() => void) | null = null;
  private zoomLevels: number[] = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  private currentZoomIdx: number = 2; // 1.0 default
  private contentEl: HTMLElement | null = null;
  private zoomLabelEl: HTMLElement | null = null;
  private onCloseCb?: (filePath: string) => void;

  constructor(
    app: App,
    plugin: DinoPlugin,
    container: HTMLElement,
    file: TFile,
    template: SheetTemplate,
    syncManager: FrontmatterSyncManager,
    onCloseCb?: (filePath: string) => void
  ) {
    this.app = app;
    this.plugin = plugin;
    this.container = container;
    this.file = file;
    this.template = template;
    this.syncManager = syncManager;
    this.onCloseCb = onCloseCb;

    this.el = createDiv({ cls: 'dte-panel dte-character-sheet-panel' });
    this.container.appendChild(this.el);
  }

  public open(): void {
    this.build();
    this.setupPosition();
  }

  public async build(): Promise<void> {
    this.el.empty();

    // 1. Header with drag handle, title, zoom controls, minimize, close
    const header = this.el.createDiv({ cls: 'dte-panel-header' });
    this.setupDrag(header);

    const titleWrap = header.createDiv({ cls: 'dte-panel-title-wrap' });
    const iconEl = titleWrap.createSpan({ cls: 'dte-panel-icon' });
    setIcon(iconEl, 'file-text');
    titleWrap.createSpan({ text: this.file.basename, cls: 'dte-panel-title' });

    const controls = header.createDiv({ cls: 'dte-panel-controls' });

    // Zoom Out
    const zoomOutBtn = controls.createEl('button', { cls: 'dte-panel-btn', title: 'Reducir zoom' });
    setIcon(zoomOutBtn, 'minus');
    zoomOutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentZoomIdx > 0) {
        this.currentZoomIdx--;
        this.applyZoom();
      }
    });

    // Zoom Indicator
    this.zoomLabelEl = controls.createSpan({
      cls: 'dte-sheet-zoom-label',
      text: `${Math.round(this.zoomLevels[this.currentZoomIdx] * 100)}%`,
    });

    // Zoom In
    const zoomInBtn = controls.createEl('button', { cls: 'dte-panel-btn', title: 'Aumentar zoom' });
    setIcon(zoomInBtn, 'plus');
    zoomInBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentZoomIdx < this.zoomLevels.length - 1) {
        this.currentZoomIdx++;
        this.applyZoom();
      }
    });

    // Edit Template Button
    const editTplBtn = controls.createEl('button', { cls: 'dte-panel-btn', title: 'Editar diseño de plantilla' });
    setIcon(editTplBtn, 'layout-template');
    editTplBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      new TemplateEditorModal(this.app, this.plugin, this.template, (updatedTpl) => {
        this.template = updatedTpl;
        this.rebuildSheet();
      }).open();
    });

    // Switch Template Button
    const switchTplBtn = controls.createEl('button', { cls: 'dte-panel-btn', title: 'Cambiar plantilla de hoja' });
    setIcon(switchTplBtn, 'repeat');
    switchTplBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      new SelectTemplateModal(this.app, this.plugin, this.file, (chosen) => {
        this.setTemplate(chosen);
      }).open();
    });

    // Unlink / Remove Sheet Button
    const unlinkBtn = controls.createEl('button', { cls: 'dte-panel-btn', title: 'Retirar hoja de personaje' });
    setIcon(unlinkBtn, 'file-minus');
    unlinkBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const s = this.plugin.settings as DinoSettings;
      const propKey = s.characterSheets?.property || 'dte-sheet';
      try {
        await this.app.fileManager.processFrontMatter(this.file, (fm) => {
          delete fm[propKey];
        });
        this.destroy();
        new Notice(`Hoja de personaje retirada de "${this.file.basename}".`);
      } catch (err) {
        console.error('[CharacterSheet] Error removing sheet:', err);
        new Notice('Error al retirar la hoja de personaje.');
      }
    });

    // Minimize Button
    const minBtn = controls.createEl('button', { cls: 'dte-panel-btn', title: 'Minimizar' });
    setIcon(minBtn, 'chevron-down');
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMinimize(minBtn);
    });

    // Close Button
    const closeBtn = controls.createEl('button', { cls: 'dte-panel-btn', title: 'Cerrar' });
    setIcon(closeBtn, 'x');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.destroy();
    });

    // 2. Sheet Content Container
    this.contentEl = this.el.createDiv({ cls: 'dte-panel-body dte-sheet-panel-body' });

    // Load data and render
    await this.rebuildSheet();

    // Subscribe to external changes
    if (this.unsubscribeSync) this.unsubscribeSync();
    this.unsubscribeSync = this.syncManager.subscribe(this.file.path, (newData) => {
      if (this.renderer) {
        this.renderer.updateData(newData);
      }
    });
  }

  public async setTemplate(template: SheetTemplate): Promise<void> {
    this.template = template;
    await this.rebuildSheet();
  }

  private async rebuildSheet(): Promise<void> {
    if (!this.contentEl) return;
    this.contentEl.empty();

    const data = await this.syncManager.readData(this.file);

    const sheetContainer = this.contentEl.createDiv({ cls: 'dte-sheet-viewport' });

    this.renderer = new CharacterSheetRenderer(
      this.app,
      this.plugin,
      this.template,
      data,
      sheetContainer,
      {
        onUpdateKey: (key, val) => {
          this.syncManager.updateKeyDebounced(this.file, key, val);
        },
        onReadHeading: (heading) => {
          return this.syncManager.readHeadingSection(this.file, heading);
        },
      },
      this.file
    );

    this.renderer.render();
    this.applyZoom();
  }

  private applyZoom(): void {
    const scale = this.zoomLevels[this.currentZoomIdx];
    if (this.renderer) {
      this.renderer.setScale(scale);
    }
    if (this.zoomLabelEl) {
      this.zoomLabelEl.setText(`${Math.round(scale * 100)}%`);
    }
  }

  private toggleMinimize(btn: HTMLElement): void {
    this.minimized = !this.minimized;
    if (this.minimized) {
      this.el.addClass('dte-panel-minimized');
      if (this.contentEl) this.contentEl.style.display = 'none';
      setIcon(btn, 'chevron-up');
    } else {
      this.el.removeClass('dte-panel-minimized');
      if (this.contentEl) this.contentEl.style.display = '';
      setIcon(btn, 'chevron-down');
    }
  }

  public destroy(): void {
    if (this.unsubscribeSync) {
      this.unsubscribeSync();
      this.unsubscribeSync = null;
    }
    if (this.onCloseCb) {
      this.onCloseCb(this.file.path);
    }
    this.el.remove();
  }

  private setupPosition(): void {
    this.el.setCssStyles({
      position: 'absolute',
      left: '120px',
      top: '100px',
      zIndex: '150',
    });
  }

  private setupDrag(handleEl: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, select, input, textarea')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.el.getBoundingClientRect();
      const parentRect = this.container.getBoundingClientRect();
      origLeft = rect.left - parentRect.left;
      origTop = rect.top - parentRect.top;

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newX = Math.max(0, origLeft + dx);
      const newY = Math.max(0, origTop + dy);
      this.el.style.left = `${newX}px`;
      this.el.style.top = `${newY}px`;
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    handleEl.addEventListener('mousedown', onMouseDown);
  }
}
