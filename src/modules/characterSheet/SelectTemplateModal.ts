import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import { DinoPlugin, DinoSettings } from '../../types';
import { SheetTemplate } from './types';
import { TemplateManagerModal } from './TemplateManagerModal';

export class SelectTemplateModal extends Modal {
  private plugin: DinoPlugin;
  private file: TFile;
  private onSelect: (template: SheetTemplate) => void;

  constructor(app: App, plugin: DinoPlugin, file: TFile, onSelect: (template: SheetTemplate) => void) {
    super(app);
    this.plugin = plugin;
    this.file = file;
    this.onSelect = onSelect;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-select-template-modal');

    const s = this.plugin.settings as DinoSettings;
    const templates = s.sheetTemplates || [];
    const propKey = s.characterSheets?.property || 'dte-sheet';
    const cache = this.app.metadataCache.getFileCache(this.file);
    const currentTpl = cache?.frontmatter?.[propKey];
    const isChange = Boolean(currentTpl);

    contentEl.createEl('h2', {
      text: isChange
        ? `Cambiar Plantilla de "${this.file.basename}"`
        : `Asignar Plantilla a "${this.file.basename}"`,
    });
    contentEl.createEl('p', {
      text: isChange
        ? `Plantilla actual: "${currentTpl}". Seleccioná el diseño que se aplicará a esta nota:`
        : 'Esta nota aún no tiene una plantilla de hoja asignada. Selecciona una plantilla para vincularla.',
    });

    if (templates.length === 0) {
      contentEl.createEl('p', {
        text: 'No tienes ninguna plantilla creada todavía. Crea una primero o genera una plantilla de ejemplo.',
        cls: 'dte-desc-muted',
      });

      const btnRow = contentEl.createDiv({ cls: 'dte-modal-btn-row' });
      btnRow.style.marginTop = '16px';
      const sampleBtn = btnRow.createEl('button', { cls: 'mod-cta', text: 'Crear plantilla de ejemplo' });
      sampleBtn.addEventListener('click', () => {
        const mgr = new TemplateManagerModal(this.app, this.plugin);
        mgr.createSampleTemplate();
        this.close();
      });
      return;
    }

    // Default to currently assigned template if it exists, otherwise first template
    let selectedId = templates[0].id;
    if (isChange) {
      const existingMatch = templates.find((t) => t.name === currentTpl || t.id === currentTpl);
      if (existingMatch) {
        selectedId = existingMatch.id;
      }
    }

    new Setting(contentEl)
      .setName('Plantilla de hoja')
      .setDesc('Selecciona el diseño que se aplicará')
      .addDropdown((dd) => {
        templates.forEach((tpl) => {
          dd.addOption(tpl.id, tpl.name);
        });
        dd.setValue(selectedId);
        dd.onChange((val) => {
          selectedId = val;
        });
      });

    const actionRow = contentEl.createDiv({ cls: 'dte-modal-btn-row' });
    actionRow.style.display = 'flex';
    actionRow.style.justifyContent = 'space-between';
    actionRow.style.gap = '8px';
    actionRow.style.marginTop = '20px';

    const leftBox = actionRow.createDiv();
    if (isChange) {
      const removeBtn = leftBox.createEl('button', {
        cls: 'mod-warning',
        text: 'Retirar Hoja',
      });
      removeBtn.addEventListener('click', async () => {
        try {
          await this.app.fileManager.processFrontMatter(this.file, (fm) => {
            delete fm[propKey];
          });
          new Notice(`Hoja de personaje retirada de "${this.file.basename}".`);
          this.close();
        } catch (err) {
          console.error('[CharacterSheet] Error removing frontmatter:', err);
          new Notice('Error al retirar la hoja.');
        }
      });
    }

    const rightBox = actionRow.createDiv({ cls: 'dte-btn-group' });
    rightBox.style.display = 'flex';
    rightBox.style.gap = '8px';

    const cancelBtn = rightBox.createEl('button', { text: 'Cancelar' });
    cancelBtn.addEventListener('click', () => this.close());

    const confirmBtn = rightBox.createEl('button', {
      cls: 'mod-cta',
      text: isChange ? 'Cambiar Plantilla' : 'Asignar y Abrir',
    });
    confirmBtn.addEventListener('click', async () => {
      const chosen = templates.find((t) => t.id === selectedId);
      if (chosen) {
        // Write dte-sheet property to frontmatter
        try {
          await this.app.fileManager.processFrontMatter(this.file, (fm) => {
            fm[propKey] = chosen.name;
          });
          new Notice(`Plantilla "${chosen.name}" asignada a ${this.file.basename}.`);
          this.close();
          this.onSelect(chosen);
        } catch (err) {
          console.error('[CharacterSheet] Error writing frontmatter:', err);
          new Notice('Error al escribir la propiedad en la nota.');
        }
      }
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
