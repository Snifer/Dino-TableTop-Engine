import { App, Modal, Setting, TFile } from 'obsidian';
import { InventoryItem, IMAGE_EXTS, IMAGE_KEYS, WEIGHT_KEYS } from '../types';
import { genId, readFrontmatterImagePath, readFrontmatterWeight } from '../utils';
import { t } from '../i18n';
import { FileSuggestModal } from './FileSuggestModal';

export class ItemEditModal extends Modal {
  item: InventoryItem;
  onSave: (item: InventoryItem) => void;
  onDelete: ((id: string) => void) | null;

  constructor(
    app: App,
    item: InventoryItem | null,
    onSave: (item: InventoryItem) => void,
    onDelete: ((id: string) => void) | null
  ) {
    super(app);
    this.item = item
      ? { ...item }
      : {
          id: genId(),
          label: '',
          value: 1,
          max: null,
          weight: null,
          imagePath: null,
          note: null,
          pinned: false,
        };
    this.onSave = onSave;
    this.onDelete = onDelete;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', {
      text: this.onDelete ? t('inventory.editItemTitle') : t('inventory.newItemTitle'),
    });

    // ── Label / Name ──
    new Setting(contentEl)
      .setName(t('common.name'))
      .addText((text) =>
        text
          .setPlaceholder(t('inventory.itemLabelPlaceholder'))
          .setValue(this.item.label || '')
          .onChange((v) => (this.item.label = v))
      );

    // ── Value & Max ──
    new Setting(contentEl)
      .setName(t('inventory.itemQuantity'))
      .setDesc(t('inventory.itemQuantityDesc'))
      .addText((text) =>
        text
          .setPlaceholder('1')
          .setValue(String(this.item.value))
          .onChange((v) => {
            const num = parseInt(v, 10);
            this.item.value = isNaN(num) ? 0 : num;
          })
      );

    new Setting(contentEl)
      .setName(t('inventory.itemMax'))
      .setDesc(t('inventory.itemMaxDesc'))
      .addText((text) =>
        text
          .setPlaceholder('—')
          .setValue(this.item.max !== null && this.item.max !== undefined ? String(this.item.max) : '')
          .onChange((v) => {
            const val = v.trim();
            if (!val) {
              this.item.max = null;
            } else {
              const num = parseInt(val, 10);
              this.item.max = isNaN(num) ? null : num;
            }
          })
      );

    // ── Weight ──
    new Setting(contentEl)
      .setName(t('inventory.itemWeight'))
      .setDesc(t('inventory.itemWeightDesc'))
      .addText((text) =>
        text
          .setPlaceholder('—')
          .setValue(this.item.weight !== null && this.item.weight !== undefined ? String(this.item.weight) : '')
          .onChange((v) => {
            const val = v.trim();
            if (!val) {
              this.item.weight = null;
            } else {
              const num = parseFloat(val);
              this.item.weight = isNaN(num) ? null : num;
            }
          })
      );

    // ── Linked Note ──
    const noteDesc = this.item.note
      ? t('common.linkedNotePoiDescAssigned', { path: this.item.note })
      : t('inventory.linkedNoteItemDescEmpty');

    new Setting(contentEl)
      .setName(t('common.linkedNote'))
      .setDesc(noteDesc)
      .addButton((b) =>
        b.setButtonText(t('common.selectNote')).onClick(() => {
          new FileSuggestModal(this.app, ['md'], (file: TFile) => {
            this.item.note = file.path;
            if (!this.item.label || this.item.label === t('inventory.newItem')) {
              this.item.label = file.basename;
            }
            // Auto-fill weight & image if frontmatter has them
            const autoWeight = readFrontmatterWeight(this.app, file.path, WEIGHT_KEYS);
            if (autoWeight !== null && this.item.weight === null) {
              this.item.weight = autoWeight;
            }
            const autoImg = readFrontmatterImagePath(this.app, file.path, IMAGE_KEYS);
            if (autoImg && !this.item.imagePath) {
              this.item.imagePath = autoImg;
            }
            this.onOpen();
          }).open();
        })
      )
      .addExtraButton((b) =>
        b
          .setIcon('x')
          .setTooltip(t('common.removeLink'))
          .onClick(() => {
            this.item.note = null;
            this.onOpen();
          })
      );

    // ── Image ──
    new Setting(contentEl)
      .setName(t('common.image'))
      .setDesc(this.item.imagePath ? this.item.imagePath : t('common.noImageDesc'))
      .addButton((b) =>
        b.setButtonText(t('common.selectImage')).onClick(() => {
          new FileSuggestModal(this.app, IMAGE_EXTS, (file: TFile) => {
            this.item.imagePath = file.path;
            this.onOpen();
          }).open();
        })
      )
      .addExtraButton((b) =>
        b
          .setIcon('x')
          .setTooltip(t('common.removeImage'))
          .onClick(() => {
            this.item.imagePath = null;
            this.onOpen();
          })
      );

    // ── Pinned (Map Badge) ──
    new Setting(contentEl)
      .setName(t('inventory.pinnedName'))
      .setDesc(t('inventory.pinnedDesc'))
      .addToggle((toggle) =>
        toggle.setValue(!!this.item.pinned).onChange((v) => (this.item.pinned = v))
      );

    // ── Action Buttons ──
    const btnRow = contentEl.createDiv({ cls: 'dte-modal-btn-row' });

    if (this.onDelete) {
      const delBtn = btnRow.createEl('button', {
        cls: 'dte-btn mod-warning',
        text: t('common.delete'),
      });
      delBtn.addEventListener('click', () => {
        if (!confirm(t('inventory.deleteItemConfirm', { name: this.item.label || t('common.unnamed') }))) return;
        if (this.onDelete) {
          this.onDelete(this.item.id);
          this.close();
        }
      });
    }

    const cancelBtn = btnRow.createEl('button', { cls: 'dte-btn', text: t('common.cancel') });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = btnRow.createEl('button', { cls: 'dte-btn mod-cta', text: t('common.save') });
    saveBtn.addEventListener('click', () => {
      this.item.label = this.item.label.trim() || t('inventory.unnamedItem');
      this.onSave(this.item);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
