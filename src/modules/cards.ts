import { Modal, setIcon } from 'obsidian';
import { EngineModule } from './types';
import { t } from '../i18n';

export class CardsModal extends Modal {
  view: any;

  constructor(app: any, view: any) {
    super(app);
    this.view = view;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: `🃏 ${t('modules.cardsName')}` });

    contentEl.createDiv({
      cls: 'dte-hint',
      text: t('modules.cardsHint'),
    });

    const box = contentEl.createDiv({ cls: 'dte-empty' });
    box.createEl('p', { text: t('modules.cardsPlaceholder') });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export const CardsModule: EngineModule = {
  id: 'cards',
  nameKey: 'modules.cardsName',
  descKey: 'modules.cardsDesc',
  icon: 'layers',
  defaultEnabled: false,
  renderToolbarButton(container: HTMLElement, view: any): void {
    const btn = container.createEl('button', {
      cls: 'dte-btn',
      text: t('modules.cardsShort'),
    });
    const icon = btn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(icon, 'layers');
    btn.prepend(icon);
    btn.addEventListener('click', () => {
      new CardsModal(view.app, view).open();
    });
  },
};
