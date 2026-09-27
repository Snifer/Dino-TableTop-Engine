import { App, FuzzySuggestModal, TFile } from 'obsidian';

export class FileSuggestModal extends FuzzySuggestModal<TFile> {
  extensions: string[] | null;
  onChooseCb: (file: TFile) => void;

  constructor(app: App, extensions: string[] | null, onChoose: (file: TFile) => void) {
    super(app);
    this.extensions = extensions;
    this.onChooseCb = onChoose;
    this.setPlaceholder(extensions ? `Elige un archivo (${extensions.join(', ')})...` : 'Elige una nota...');
  }

  getItems(): TFile[] {
    const files = this.app.vault.getFiles();
    if (!this.extensions) return files.filter((f) => f.extension === 'md');
    return files.filter((f) => this.extensions!.includes(f.extension.toLowerCase()));
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile): void {
    this.onChooseCb(item);
  }
}
