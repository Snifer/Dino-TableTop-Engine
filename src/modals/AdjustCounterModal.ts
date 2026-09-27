import { App, Modal, Setting } from 'obsidian';
import { CounterData } from '../types';

export class AdjustCounterModal extends Modal {
  counter: CounterData;
  onApply: (delta: number) => void;

  constructor(app: App, counter: CounterData, onApply: (delta: number) => void) {
    super(app);
    this.counter = counter;
    this.onApply = onApply;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    const maxTxt = this.counter.max !== null && this.counter.max !== undefined ? `/${this.counter.max}` : '';
    contentEl.createEl('h3', { text: `${this.counter.label}: ${this.counter.value}${maxTxt}` });

    let amount = 1;
    new Setting(contentEl).setName('Cantidad').addText((t) => {
      t.inputEl.type = 'number';
      t.setValue('1');
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
        .setButtonText('Restar')
        .setWarning()
        .onClick(() => {
          this.close();
          this.onApply(-Math.abs(amount));
        })
    );
    btnRow.addButton((b) =>
      b.setButtonText('Sumar').onClick(() => {
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
