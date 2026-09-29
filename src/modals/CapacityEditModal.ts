import { App, Modal, Setting } from 'obsidian';
import { InventoryCapacity } from '../types';
import { t } from '../i18n';

export class CapacityEditModal extends Modal {
  capacity: InventoryCapacity;
  onSave: (capacity: InventoryCapacity) => void;

  constructor(app: App, capacity: InventoryCapacity, onSave: (capacity: InventoryCapacity) => void) {
    super(app);
    this.capacity = { ...capacity };
    this.onSave = onSave;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: t('inventory.capacityTitle') });

    new Setting(contentEl)
      .setName(t('inventory.capacityMode'))
      .setDesc(t('inventory.capacityModeDesc'))
      .addDropdown((drop) =>
        drop
          .addOption('none', t('inventory.capacityModeNone'))
          .addOption('weight', t('inventory.capacityModeWeight'))
          .addOption('slots', t('inventory.capacityModeSlots'))
          .setValue(this.capacity.mode || 'none')
          .onChange((v: any) => {
            this.capacity.mode = v;
            this.onOpen();
          })
      );

    if (this.capacity.mode !== 'none') {
      new Setting(contentEl)
        .setName(t('inventory.capacityValue'))
        .setDesc(t('inventory.capacityValueDesc'))
        .addText((text) =>
          text
            .setPlaceholder('40')
            .setValue(String(this.capacity.value || 0))
            .onChange((v) => {
              const num = parseFloat(v);
              this.capacity.value = isNaN(num) ? 0 : num;
            })
        );

      new Setting(contentEl)
        .setName(t('inventory.capacityLabel'))
        .setDesc(t('inventory.capacityLabelDesc'))
        .addText((text) =>
          text
            .setPlaceholder(this.capacity.mode === 'weight' ? 'kg, lbs' : 'slots, espacios')
            .setValue(this.capacity.label || '')
            .onChange((v) => (this.capacity.label = v))
        );
    }

    const btnRow = contentEl.createDiv({ cls: 'dte-modal-btn-row' });
    const cancelBtn = btnRow.createEl('button', { cls: 'dte-btn', text: t('common.cancel') });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = btnRow.createEl('button', { cls: 'dte-btn mod-cta', text: t('common.save') });
    saveBtn.addEventListener('click', () => {
      this.onSave(this.capacity);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
