import { App, Modal, Setting } from 'obsidian';
import { TokenData } from '../types';

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
      text: `${this.token.name || 'Token'} — ${this.token.hp ?? 0}/${this.token.maxHp ?? 0} HP`,
    });

    let amount = 0;
    new Setting(contentEl).setName('Cantidad').addText((t) => {
      t.inputEl.type = 'number';
      t.setPlaceholder('0');
      t.inputEl.focus();
      t.onChange((v) => (amount = Number(v) || 0));
      t.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          this.close();
          this.onApply(-Math.abs(amount));
        }
      });
    });

    const btnRow = new Setting(contentEl);
    btnRow.addButton((b) =>
      b
        .setButtonText('Aplicar daño')
        .setWarning()
        .onClick(() => {
          this.close();
          this.onApply(-Math.abs(amount));
        })
    );
    btnRow.addButton((b) =>
      b.setButtonText('Curar').onClick(() => {
        this.close();
        this.onApply(Math.abs(amount));
      })
    );
    btnRow.addButton((b) => b.setButtonText('Cancelar').onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
