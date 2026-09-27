import { App, FuzzySuggestModal } from 'obsidian';
import { RPG_AWESOME_ICONS } from '../types';

export class IconSuggestModal extends FuzzySuggestModal<string> {
  onChoose: (icon: string) => void;
  icons: string[];

  constructor(app: App, onChoose: (icon: string) => void, customIcons?: string[]) {
    super(app);
    this.onChoose = onChoose;
    this.icons = customIcons && customIcons.length ? customIcons : RPG_AWESOME_ICONS;
    this.setPlaceholder('Buscar ícono (ej. ra-sword, ra-dragon, ra-campfire)...');
  }

  getItems(): string[] {
    return this.icons;
  }

  getItemText(item: string): string {
    return item;
  }

  renderSuggestion(item: { item: string }, el: HTMLElement): void {
    el.empty();
    const row = el.createDiv({ cls: 'dte-icon-suggest-item' });
    const iconEl = row.createEl('i', { cls: `ra ${item.item}` });
    iconEl.style.fontSize = '18px';
    iconEl.style.width = '24px';
    iconEl.style.textAlign = 'center';
    row.createSpan({ text: item.item });
  }

  onChooseItem(item: string): void {
    this.onChoose(item);
  }
}
