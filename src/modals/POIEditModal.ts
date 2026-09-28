import { App, Modal, Setting } from 'obsidian';
import { POIData, IMAGE_EXTS } from '../types';
import { t } from '../i18n';
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
    contentEl.createEl('h2', { text: this.onDelete ? t('poi.editTitle') : t('poi.newTitle') });

    new Setting(contentEl)
      .setName(t('common.name'))
      .addText((text) => text.setValue(this.poi.name || '').onChange((v) => (this.poi.name = v)));

    new Setting(contentEl)
      .setName(t('common.markerColor'))
      .addColorPicker((c) =>
        c.setValue(this.poi.color || '#4c8bf5').onChange((v) => (this.poi.color = v))
      );

    new Setting(contentEl)
      .setName(t('common.size'))
      .addSlider((s) =>
        s
          .setLimits(16, 100, 2)
          .setValue(this.poi.size || 36)
          .setDynamicTooltip()
          .onChange((v) => (this.poi.size = v))
      );

    new Setting(contentEl)
      .setName(t('common.image'))
      .setDesc(this.poi.imagePath ? this.poi.imagePath : t('common.noImageDesc'))
      .addButton((b) =>
        b.setButtonText(t('common.selectImage')).onClick(() => {
          new FileSuggestModal(this.app, IMAGE_EXTS, (file) => {
            this.poi.imagePath = file.path;
            this.onOpen();
          }).open();
        })
      )
      .addExtraButton((b) =>
        b
          .setIcon('x')
          .setTooltip(t('common.removeImage'))
          .onClick(() => {
            if (!confirm(t('common.removeImageConfirm'))) return;
            this.poi.imagePath = null;
            this.onOpen();
          })
      );

    const poiIconSetting = new Setting(contentEl)
      .setName(t('common.iconField'))
      .setDesc(
        this.poi.icon
          ? t('common.poiIconDescAssigned', { icon: this.poi.icon })
          : t('common.poiIconDescEmpty'),
      )
      .addText((text) =>
        text
          .setPlaceholder('ra-campfire')
          .setValue(this.poi.icon || '')
          .onChange((v) => {
            this.poi.icon = v.trim() || null;
          })
      )
      .addButton((b) =>
        b
          .setButtonText(t('common.iconCatalog'))
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
          .setTooltip(t('common.removeIcon'))
          .onClick(() => {
            this.poi.icon = null;
            this.onOpen();
          })
      );
    }

    new Setting(contentEl)
      .setName(t('common.linkedNote'))
      .setDesc(
        this.poi.linkedNote
          ? t('common.linkedNotePoiDescAssigned', { path: this.poi.linkedNote })
          : t('common.linkedNotePoiDescEmpty'),
      )
      .addButton((b) =>
        b.setButtonText(t('common.selectNote')).onClick(() => {
          new FileSuggestModal(this.app, null, (file) => {
            this.poi.linkedNote = file.path;
            this.onOpen();
          }).open();
        })
      )
      .addExtraButton((b) =>
        b
          .setIcon('x')
          .setTooltip(t('common.removeLink'))
          .onClick(() => {
            this.poi.linkedNote = null;
            this.onOpen();
          })
      );

    const btnRow = new Setting(contentEl);
    btnRow.addButton((b) =>
      b
        .setButtonText(t('common.save'))
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
          .setButtonText(t('poi.deleteBtn'))
          .setWarning()
          .onClick(() => {
            if (!confirm(t('poi.deleteConfirm', { name: this.poi.name || t('common.unnamed') }))) return;
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
