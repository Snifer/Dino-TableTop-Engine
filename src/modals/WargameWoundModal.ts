import { App, Modal, Setting } from 'obsidian';
import { WargameModel, WargameUnitOnTable } from '../types';
import { clamp } from '../utils';
import { t } from '../i18n';

export class WargameWoundModal extends Modal {
  model: WargameModel;
  unit: WargameUnitOnTable;
  onSave: () => void;

  constructor(
    app: App,
    model: WargameModel,
    unit: WargameUnitOnTable,
    onSave: () => void
  ) {
    super(app);
    this.model = model;
    this.unit = unit;
    this.onSave = onSave;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-damage-modal');

    contentEl.createEl('h2', {
      text: t('wargame.woundsTitle', { unitName: this.unit.name }),
    });

    const statusEl = contentEl.createDiv({ cls: 'dte-damage-current-hp' });
    statusEl.setText(`${this.model.woundsCurrent} / ${this.model.woundsMax} ${t('wargame.woundsLabel')}`);

    let delta = 1;
    const deltaSetting = new Setting(contentEl)
      .setName(t('common.amount'))
      .addText((tx) => {
        tx.inputEl.type = 'number';
        tx.setValue('1');
        tx.onChange((v) => {
          delta = Math.max(1, parseInt(v) || 1);
        });
      });

    const btnRow = contentEl.createDiv({ cls: 'dte-damage-btns-row' });

    // Subtract wound (damage)
    const woundBtn = btnRow.createEl('button', {
      cls: 'dte-btn mod-warning',
      text: `🩸 -${delta} ${t('wargame.woundAction')}`,
    });
    woundBtn.addEventListener('click', () => {
      this.model.woundsCurrent = clamp(this.model.woundsCurrent - delta, 0, this.model.woundsMax);
      this.onSave();
      this.close();
    });

    // Heal / Restore wound
    const healBtn = btnRow.createEl('button', {
      cls: 'dte-btn mod-cta',
      text: `✨ +${delta} ${t('wargame.healAction')}`,
    });
    healBtn.addEventListener('click', () => {
      this.model.woundsCurrent = clamp(this.model.woundsCurrent + delta, 0, this.model.woundsMax);
      this.onSave();
      this.close();
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
