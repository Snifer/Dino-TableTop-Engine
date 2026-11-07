import { App, Modal, Notice, setIcon, Setting } from 'obsidian';
import { DinoPlugin, DinoSettings } from '../../types';
import { SheetTemplate } from './types';
import { genId } from '../../utils';
import { TemplateEditorModal } from './TemplateEditorModal';
import { ExportSheetPackageModal } from './ExportSheetPackageModal';
import { importSheetFromBuffer } from './sheetExportImport';

export class TemplateManagerModal extends Modal {
  private plugin: DinoPlugin;

  constructor(app: App, plugin: DinoPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.render();
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-template-manager-modal');

    contentEl.createEl('h2', { text: 'Plantillas de Hoja de Personaje' });
    contentEl.createEl('p', {
      text: 'Diseña y gestiona las plantillas que tus personajes usarán en las partidas.',
      cls: 'dte-manager-desc',
    });

    const s = this.plugin.settings as DinoSettings;
    const templates = s.sheetTemplates || [];

    // Action buttons bar
    const topBar = contentEl.createDiv({ cls: 'dte-manager-topbar' });
    topBar.style.display = 'flex';
    topBar.style.gap = '8px';
    topBar.style.marginBottom = '16px';

    const newBtn = topBar.createEl('button', { cls: 'mod-cta', text: '+ Nueva Plantilla' });
    newBtn.addEventListener('click', () => {
      this.createNewTemplate();
    });

    const importFileBtn = topBar.createEl('button', { cls: 'dte-btn', text: '📥 Importar (.dinovtt / JSON)' });
    importFileBtn.addEventListener('click', () => {
      this.pickAndImportFile();
    });

    const importJsonPromptBtn = topBar.createEl('button', { text: 'Pegar JSON' });
    importJsonPromptBtn.addEventListener('click', () => {
      this.importTemplateJson();
    });

    if (templates.length === 0) {
      const sampleBtn = topBar.createEl('button', { text: 'Crear plantilla de ejemplo' });
      sampleBtn.addEventListener('click', () => {
        this.createSampleTemplate();
      });

      const emptyWrap = contentEl.createDiv({ cls: 'dte-manager-empty' });
      emptyWrap.createEl('p', { text: 'No hay plantillas creadas todavía.' });
      return;
    }

    // List of templates
    const listEl = contentEl.createDiv({ cls: 'dte-template-list' });

    for (const tpl of templates) {
      const itemEl = listEl.createDiv({ cls: 'dte-template-item' });
      itemEl.style.display = 'flex';
      itemEl.style.alignItems = 'center';
      itemEl.style.justifyContent = 'space-between';
      itemEl.style.padding = '10px 14px';
      itemEl.style.border = '1px solid var(--background-modifier-border)';
      itemEl.style.borderRadius = '6px';
      itemEl.style.marginBottom = '8px';

      const infoEl = itemEl.createDiv({ cls: 'dte-template-info' });
      infoEl.createEl('strong', { text: tpl.name, cls: 'dte-template-name' });
      infoEl.createDiv({
        text: `${tpl.width || 800}x${tpl.height || 1000}px • ${tpl.widgets.length} widgets`,
        cls: 'dte-template-meta',
      });

      const btnGroup = itemEl.createDiv({ cls: 'dte-template-actions' });
      btnGroup.style.display = 'flex';
      btnGroup.style.gap = '6px';

      const editBtn = btnGroup.createEl('button', { text: 'Editar' });
      editBtn.addEventListener('click', () => {
        new TemplateEditorModal(this.app, this.plugin, tpl, () => {
          this.render();
        }).open();
      });

      const dupBtn = btnGroup.createEl('button', { text: 'Duplicar' });
      dupBtn.addEventListener('click', () => {
        this.duplicateTemplate(tpl);
      });

      const exportDinovttBtn = btnGroup.createEl('button', {
        cls: 'mod-cta',
        text: 'Exportar .dinovtt',
        title: 'Exportar paquete comprimido .dinovtt para compartir o subir a la tienda',
      });
      exportDinovttBtn.addEventListener('click', () => {
        new ExportSheetPackageModal(this.app, this.plugin, tpl).open();
      });

      const exportJsonBtn = btnGroup.createEl('button', { text: 'JSON', title: 'Copiar JSON al portapapeles' });
      exportJsonBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(JSON.stringify(tpl, null, 2));
        new Notice(`Plantilla "${tpl.name}" copiada al portapapeles.`);
      });

      const delBtn = btnGroup.createEl('button', { cls: 'mod-warning', text: 'Eliminar' });
      delBtn.addEventListener('click', () => {
        if (confirm(`¿Eliminar plantilla "${tpl.name}"?`)) {
          this.deleteTemplate(tpl.id);
        }
      });
    }
  }

  private createNewTemplate(): void {
    const newTpl: SheetTemplate = {
      id: genId(),
      name: 'Nueva Plantilla',
      width: 800,
      height: 1000,
      widgets: [],
    };

    new TemplateEditorModal(this.app, this.plugin, newTpl, () => {
      this.render();
    }).open();
  }

  private duplicateTemplate(tpl: SheetTemplate): void {
    const s = this.plugin.settings as DinoSettings;
    const cloned: SheetTemplate = JSON.parse(JSON.stringify(tpl));
    cloned.id = genId();
    cloned.name = `${tpl.name} (copia)`;

    if (!s.sheetTemplates) s.sheetTemplates = [];
    s.sheetTemplates.push(cloned);
    this.plugin.saveSettings().then(() => {
      this.render();
      new Notice(`Plantilla duplicada como "${cloned.name}".`);
    });
  }

  private deleteTemplate(id: string): void {
    const s = this.plugin.settings as DinoSettings;
    if (!s.sheetTemplates) return;
    s.sheetTemplates = s.sheetTemplates.filter((t) => t.id !== id);
    this.plugin.saveSettings().then(() => {
      this.render();
      new Notice('Plantilla eliminada.');
    });
  }

  private importTemplateJson(): void {
    const modal = new Modal(this.app);
    modal.titleEl.setText('Pegar JSON de plantilla');

    modal.contentEl.createEl('p', {
      text: 'Pegá el código JSON exportado de una plantilla de hoja de personaje.',
      cls: 'dte-field-hint',
    });

    const textarea = modal.contentEl.createEl('textarea', {
      cls: 'dte-textarea',
      attr: {
        rows: '12',
        placeholder: '{\n  "name": "...",\n  "widgets": [...]\n}',
      },
    });
    textarea.style.width = '100%';
    textarea.style.fontFamily = 'monospace';
    textarea.style.fontSize = '12px';
    textarea.style.boxSizing = 'border-box';
    textarea.style.resize = 'vertical';

    const btnRow = modal.contentEl.createDiv({ cls: 'dte-modal-btn-row' });
    btnRow.style.display = 'flex';
    btnRow.style.justifyContent = 'flex-end';
    btnRow.style.gap = '8px';
    btnRow.style.marginTop = '16px';

    const cancelBtn = btnRow.createEl('button', { text: 'Cancelar' });
    cancelBtn.addEventListener('click', () => modal.close());

    const importBtn = btnRow.createEl('button', { cls: 'mod-cta', text: 'Importar' });
    importBtn.addEventListener('click', async () => {
      const input = textarea.value.trim();
      if (!input) {
        new Notice('Por favor ingresá el JSON de la plantilla.');
        return;
      }
      try {
        const parsed = JSON.parse(input) as SheetTemplate;
        if (!parsed.name || !Array.isArray(parsed.widgets)) {
          new Notice('El formato JSON no es una plantilla válida (requiere "name" y "widgets").');
          return;
        }
        parsed.id = genId();
        const s = this.plugin.settings as DinoSettings;
        if (!s.sheetTemplates) s.sheetTemplates = [];
        s.sheetTemplates.push(parsed);
        await this.plugin.saveSettings();
        modal.close();
        this.render();
        new Notice(`Plantilla "${parsed.name}" importada.`);
      } catch {
        new Notice('Error al parsear el JSON. Verificá que la sintaxis sea correcta.');
      }
    });

    modal.open();
  }

  private pickAndImportFile(): void {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.dinovtt,.zip,.json';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      try {
        const buffer = await file.arrayBuffer();
        const imported = await importSheetFromBuffer(this.app, this.plugin, buffer);
        new Notice(`¡Plantilla "${imported.name}" importada con éxito!`, 4000);
        this.render();
      } catch (err) {
        console.error('[DTE] Error importing sheet:', err);
        new Notice(`Error al importar: ${String(err)}`, 5000);
      } finally {
        fileInput.remove();
      }
    });

    document.body.appendChild(fileInput);
    fileInput.click();
  }

  public createSampleTemplate(): void {
    const sampleTpl: SheetTemplate = {
      id: genId(),
      name: 'Ficha de Aventurero',
      width: 760,
      height: 860,
      widgets: [
        {
          id: genId(),
          type: 'frame',
          x: 20,
          y: 20,
          w: 720,
          h: 820,
          z: 1,
          style: {
            title: 'Ficha de Personaje',
            border: true,
            borderWidth: 2,
            borderRadius: 8,
            backgroundColor: 'var(--background-secondary)',
          },
        },
        {
          id: genId(),
          type: 'image',
          x: 40,
          y: 50,
          w: 120,
          h: 120,
          z: 2,
          bind: 'image',
          shape: 'circle',
          fit: 'cover',
        },
        {
          id: genId(),
          type: 'text',
          x: 180,
          y: 50,
          w: 260,
          h: 40,
          z: 2,
          bind: 'nombre',
          placeholder: 'Nombre del personaje',
          style: { title: 'Nombre' },
        },
        {
          id: genId(),
          type: 'text',
          x: 460,
          y: 50,
          w: 260,
          h: 40,
          z: 2,
          bind: 'clase',
          placeholder: 'Clase o Profesión',
          style: { title: 'Clase' },
        },
        {
          id: genId(),
          type: 'counter',
          x: 40,
          y: 190,
          w: 200,
          h: 80,
          z: 2,
          bind: 'vida',
          min: 0,
          max: '@vidaMax',
          step: 1,
          display: 'both',
          style: { title: 'Puntos de Vida' },
        },
        {
          id: genId(),
          type: 'counter',
          x: 260,
          y: 190,
          w: 160,
          h: 70,
          z: 2,
          bind: 'fuerza',
          min: 1,
          max: 30,
          step: 1,
          display: 'number',
          style: { title: 'Fuerza' },
          action: { formula: '1d20 + floor((@fuerza-10)/2)', reason: 'Prueba de Fuerza', render: true },
        },
        {
          id: genId(),
          type: 'calculated',
          x: 440,
          y: 200,
          w: 120,
          h: 60,
          z: 2,
          formula: 'floor((@fuerza - 10) / 2)',
          style: { title: 'Mod. Fue' },
        },
        {
          id: genId(),
          type: 'button',
          x: 580,
          y: 200,
          w: 140,
          h: 44,
          z: 2,
          style: { title: '⚔️ Ataque' },
          action: { formula: '1d20 + @fuerza', reason: 'Ataque cuerpo a cuerpo', render: true },
        },
        {
          id: genId(),
          type: 'list',
          x: 40,
          y: 300,
          w: 320,
          h: 240,
          z: 2,
          bind: 'inventario',
          style: { title: 'Inventario' },
        },
        {
          id: genId(),
          type: 'grid',
          x: 380,
          y: 300,
          w: 340,
          h: 240,
          z: 2,
          bind: 'armas',
          style: { title: 'Armas y Ataques' },
          columns: [
            { key: 'nombre', label: 'Arma', type: 'text' },
            { key: 'ataque', label: 'Bono', type: 'text' },
            { key: 'dano', label: 'Daño', type: 'text' },
          ],
        },
        {
          id: genId(),
          type: 'text',
          x: 40,
          y: 560,
          w: 680,
          h: 260,
          z: 2,
          lines: 8,
          bind: '# Biografía',
          placeholder: 'Escribe aquí la historia o biografía...',
          style: { title: 'Notas y Biografía' },
        },
      ],
    };

    const s = this.plugin.settings as DinoSettings;
    if (!s.sheetTemplates) s.sheetTemplates = [];
    s.sheetTemplates.push(sampleTpl);
    this.plugin.saveSettings().then(() => {
      this.render();
      new Notice('Plantilla de ejemplo "Ficha de Aventurero" creada con éxito.');
    });
  }
}
