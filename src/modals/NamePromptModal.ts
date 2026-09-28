import { App, Modal, Setting } from 'obsidian';
import { t } from '../i18n';

export class NamePromptModal extends Modal {
  title_: string;
  placeholder: string;
  onSubmit: (value: string) => void;

  constructor(app: App, title: string, placeholder: string, onSubmit: (value: string) => void) {
    super(app);
    this.title_ = title;
    this.placeholder = placeholder;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: this.title_ });
    let value = '';
    new Setting(contentEl).addText((text) => {
      text.setPlaceholder(this.placeholder);
      text.onChange((v) => (value = v));
      text.inputEl.focus();
      text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          this.close();
          this.onSubmit(value);
        }
      });
    });
    new Setting(contentEl).addButton((b) =>
      b
        .setButtonText(t('common.confirm'))
        .setCta()
        .onClick(() => {
          this.close();
          this.onSubmit(value);
        })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
