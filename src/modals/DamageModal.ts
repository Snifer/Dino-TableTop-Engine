import { App, Modal, Setting } from 'obsidian';
import { TokenData } from '../types';
import { t } from '../i18n';

export class DamageModal extends Modal {
  token: TokenData;
  onApply: (delta: number) => void;

  constructor(app: App, token: TokenData, onApply: (delta: number) => void) {
    super(app);
    this.token = token;
    this.onApply = onApply;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h3', {
      text: `${this.token.name || t('common.unnamed')} — ${this.token.hp ?? 0}/${this.token.maxHp ?? 0} HP`,
    });

    let amount = 0;
    new Setting(contentEl).setName(t('common.amount')).addText((text) => {
      text.inputEl.type = 'number';
      text.setPlaceholder('0');
      text.inputEl.focus();
      text.onChange((v) => (amount = Number(v) || 0));
      text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          this.close();
          this.onApply(-Math.abs(amount));
        }
      });
    });

    const btnRow = new Setting(contentEl);
    btnRow.addButton((b) =>
      b
        .setButtonText(t('token.applyDamageBtn'))
        .setWarning()
        .onClick(() => {
          this.close();
          this.onApply(-Math.abs(amount));
        })
    );
    btnRow.addButton((b) =>
      b.setButtonText(t('token.applyHealBtn')).onClick(() => {
        this.close();
        this.onApply(Math.abs(amount));
      })
    );
    btnRow.addButton((b) => b.setButtonText(t('common.cancel')).onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
