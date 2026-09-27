import { App, Modal, Setting } from 'obsidian';
import { POIData, IMAGE_EXTS, IMAGE_KEYS } from '../types';
import { readFrontmatterImagePath } from '../utils';
import { FileSuggestModal } from './FileSuggestModal';
import { IconSuggestModal } from './IconSuggestModal';

export class POIEditModal extends Modal {
  poi: POIData;
  onSave: (poi: POIData) => void;
  onDelete: ((poi: POIData) => void) | null;

  constructor(app: App, poi: POIData, onSave: (poi: POIData) => void, onDelete: ((poi: POIData) => void) | null) {
    super(app);
    this.poi = poi;
    this.onSave = onSave;
    this.onDelete = onDelete;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: this.onDelete ? 'Editar punto de interés' : 'Nuevo punto de interés' });

    new Setting(contentEl)
      .setName('Nombre')
      .addText((t) => t.setValue(this.poi.name || '').onChange((v) => (this.poi.name = v)));

    new Setting(contentEl)
      .setName('Color del marcador')
      .addColorPicker((c) =>
        c.setValue(this.poi.color || '#4c8bf5').onChange((v) => (this.poi.color = v))
      );

    new Setting(contentEl)
      .setName('Tamaño (px)')
      .addSlider((s) =>
        s
          .setLimits(16, 100, 2)
          .setValue(this.poi.size || 36)
          .setDynamicTooltip()
          .onChange((v) => (this.poi.size = v))
      );

    new Setting(contentEl)
      .setName('Imagen')
      .setDesc(this.poi.imagePath ? this.poi.imagePath : 'Ninguna.')
      .addButton((b) =>
        b.setButtonText('Elegir imagen').onClick(() => {
          new FileSuggestModal(this.app, IMAGE_EXTS, (file) => {
            this.poi.imagePath = file.path;
            this.onOpen();
          }).open();
        })
      )
      .addExtraButton((b) =>
        b
          .setIcon('x')
          .setTooltip('Quitar imagen')
          .onClick(() => {
            if (!confirm('¿Quitar la imagen asignada a este punto de interés?')) return;
            this.poi.imagePath = null;
            this.onOpen();
          })
      );

    const poiIconSetting = new Setting(contentEl)
      .setName('Ícono (Custom Font / RPG-Awesome)')
      .setDesc(
        this.poi.icon
          ? `Ícono asignado: "${this.poi.icon}". Se muestra en el marcador si no hay imagen.`
          : 'Opcional. Se muestra si no hay imagen asignada (ej. ra-campfire, ra-castle-emblem, ra-skull).',
      )
      .addText((t) =>
        t
          .setPlaceholder('ej. ra-campfire')
          .setValue(this.poi.icon || '')
          .onChange((v) => {
            this.poi.icon = v.trim() || null;
          })
      )
      .addButton((b) =>
        b
          .setButtonText('Catálogo')
          .setIcon('search')
          .onClick(() => {
            new IconSuggestModal(this.app, (chosen) => {
              this.poi.icon = chosen;
              this.onOpen();
            }).open();
          })
      );

    if (this.poi.icon) {
      poiIconSetting.addExtraButton((b) =>
        b
          .setIcon('x')
          .setTooltip('Quitar ícono')
          .onClick(() => {
            this.poi.icon = null;
            this.onOpen();
          })
      );
    }

    new Setting(contentEl)
      .setName('Nota vinculada')
      .setDesc(
        this.poi.linkedNote
          ? this.poi.linkedNote
          : 'Ninguna. Al vincular una nota, el punto de interés se puede abrir como panel flotante editable.',
      )
      .addButton((b) =>
        b.setButtonText('Elegir nota').onClick(() => {
          new FileSuggestModal(this.app, null, (file) => {
            this.poi.linkedNote = file.path;
            if (!this.poi.name) this.poi.name = file.basename;
            const img = readFrontmatterImagePath(this.app, file.path, IMAGE_KEYS);
            if (img) this.poi.imagePath = img;
            this.onOpen();
          }).open();
        })
      )
      .addExtraButton((b) =>
        b
          .setIcon('x')
          .setTooltip('Quitar vínculo')
          .onClick(() => {
            this.poi.linkedNote = null;
            this.onOpen();
          })
      );

    const btnRow = new Setting(contentEl);
    btnRow.addButton((b) =>
      b
        .setButtonText('Guardar')
        .setCta()
        .onClick(() => {
          this.close();
          this.onSave(this.poi);
        })
    );
    if (this.onDelete) {
      const onDelete = this.onDelete;
      btnRow.addButton((b) =>
        b
          .setButtonText('Eliminar')
          .setWarning()
          .onClick(() => {
            if (!confirm(`¿Eliminar el punto de interés "${this.poi.name || 'sin nombre'}"? Esta acción no se puede deshacer.`)) return;
            this.close();
            onDelete(this.poi);
          })
      );
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
