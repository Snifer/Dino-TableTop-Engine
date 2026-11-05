import { setIcon } from 'obsidian';
import { EngineModule } from '../types';
import { t } from '../../i18n';
import { IDinoTabletopView } from '../../types';
import { RandomTablesPanel } from './RandomTablesPanel';

export * from './types';
export * from './tableParser';
export * from './tableIndexer';
export * from './tableRoller';
export * from './RandomTablesPanel';

// ── Toolbar button renderer ──
export function renderRandomTablesToolbarButton(container: HTMLElement, view: IDinoTabletopView): void {
  const btn = container.createEl('button', {
    cls: 'dte-btn',
    title: t('tables.panelTitle'),
  });
  const icon = btn.createSpan({ cls: 'dte-btn-icon-prefix' });
  setIcon(icon, 'dice-6');
  btn.prepend(icon);
  btn.createSpan({ text: t('modules.randomTablesShort') });

  btn.addEventListener('click', () => {
    if (!view.randomTablesPanel) {
      view.randomTablesPanel = new RandomTablesPanel(view.app, view.plugin, view.panelsLayer || view.containerEl);
    }
    (view.randomTablesPanel as RandomTablesPanel).open();
  });
}

// ── Module registration ──
export const RandomTablesModule: EngineModule = {
  id: 'random-tables',
  nameKey: 'modules.randomTablesName',
  descKey: 'modules.randomTablesDesc',
  icon: 'dice-6',
  defaultEnabled: false,
  renderToolbarButton: renderRandomTablesToolbarButton,
};
