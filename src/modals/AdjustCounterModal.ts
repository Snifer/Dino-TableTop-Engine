import { App, Modal, Setting } from 'obsidian';
import { CounterData } from '../types';
import { t } from '../i18n';

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
    new Setting(contentEl).setName(t('common.amount')).addText((text) => {
      text.inputEl.type = 'number';
      text.setValue('1');
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
        .setButtonText(t('counters.subtractBtn'))
        .setWarning()
        .onClick(() => {
          this.close();
          this.onApply(-Math.abs(amount));
        })
    );
    btnRow.addButton((b) =>
      b.setButtonText(t('counters.addValueBtn')).onClick(() => {
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
