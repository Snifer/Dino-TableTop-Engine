import { App, Modal } from 'obsidian';
import { RPG_ICON_PACKS, RPG_AWESOME_ICONS } from '../types';
import { t, TranslationKey } from '../i18n';

export class IconSuggestModal extends Modal {
  private onChoose: (icon: string) => void;
  private activePack: string | null = null;
  private searchQuery = '';
  private gridEl: HTMLElement;
  private packPillsEl: HTMLElement;
  private searchEl: HTMLInputElement;

  constructor(app: App, onChoose: (icon: string) => void) {
    super(app);
    this.onChoose = onChoose;
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass('dte-icon-picker-modal');
    contentEl.empty();

    // Header
    contentEl.createEl('h3', { text: t('icons.pickerTitle'), cls: 'dte-icon-picker-title' });

    // Search bar
    const searchWrap = contentEl.createDiv({ cls: 'dte-icon-search-wrap' });
    this.searchEl = searchWrap.createEl('input', {
      type: 'text',
      cls: 'dte-icon-search-input dte-input-clean',
      placeholder: t('suggest.searchIcon'),
    });
    this.searchEl.addEventListener('input', () => {
      this.searchQuery = this.searchEl.value.toLowerCase().trim();
      this.renderGrid();
    });

    // Category pills
    this.packPillsEl = contentEl.createDiv({ cls: 'dte-icon-pack-pills' });
    this.renderPackPills();

    // Icon grid
    this.gridEl = contentEl.createDiv({ cls: 'dte-icon-grid' });
    this.renderGrid();

    // Focus search
    setTimeout(() => this.searchEl.focus(), 50);
  }

  private renderPackPills(): void {
    this.packPillsEl.empty();

    // "All" pill
    const allPill = this.packPillsEl.createEl('button', { cls: 'dte-icon-pack-pill' });
    allPill.setText(`📋 ${t('icons.packAll')}`);
    if (this.activePack === null) allPill.addClass('is-active');
    allPill.addEventListener('click', () => {
      this.activePack = null;
      this.renderPackPills();
      this.renderGrid();
    });

    // Category pills
    for (const [key, pack] of Object.entries(RPG_ICON_PACKS)) {
      const pill = this.packPillsEl.createEl('button', { cls: 'dte-icon-pack-pill' });
      pill.setText(`${pack.emoji} ${t(pack.label as TranslationKey)}`);
      if (this.activePack === key) pill.addClass('is-active');
      pill.addEventListener('click', () => {
        this.activePack = key;
        this.renderPackPills();
        this.renderGrid();
      });
    }
  }

  private getFilteredIcons(): string[] {
    let icons: string[];
    if (this.activePack && RPG_ICON_PACKS[this.activePack]) {
      icons = RPG_ICON_PACKS[this.activePack].icons;
    } else {
      icons = RPG_AWESOME_ICONS;
    }

    if (this.searchQuery) {
      icons = icons.filter(i => i.includes(this.searchQuery));
    }

    return icons;
  }

  private renderGrid(): void {
    this.gridEl.empty();
    const icons = this.getFilteredIcons();

    if (icons.length === 0) {
      this.gridEl.createDiv({
        cls: 'dte-icon-grid-empty',
        text: t('icons.noResults'),
      });
      return;
    }

    // Show count
    const countEl = this.gridEl.createDiv({ cls: 'dte-icon-grid-count' });
    countEl.setText(`${icons.length} ${icons.length === 1 ? 'icon' : 'icons'}`);

    const gridContainer = this.gridEl.createDiv({ cls: 'dte-icon-grid-container' });

    for (const icon of icons) {
      const cell = gridContainer.createDiv({ cls: 'dte-icon-grid-cell' });
      cell.setAttribute('title', icon);

      const iconEl = cell.createEl('i', { cls: `ra ${icon}` });
      iconEl.style.fontSize = '22px';

      const label = cell.createDiv({ cls: 'dte-icon-grid-label' });
      label.setText(icon.replace('ra-', ''));

      cell.addEventListener('click', () => {
        this.onChoose(icon);
        this.close();
      });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
