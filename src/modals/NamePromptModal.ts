import { App, Modal, Setting } from 'obsidian';

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
    new Setting(contentEl).addText((t) => {
      t.setPlaceholder(this.placeholder);
      t.onChange((v) => (value = v));
      t.inputEl.focus();
      t.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          this.close();
          this.onSubmit(value);
        }
      });
    });
    new Setting(contentEl).addButton((b) =>
      b
        .setButtonText('Crear')
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
