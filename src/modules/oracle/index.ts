import { setIcon } from 'obsidian';
import { EngineModule } from '../types';
import { t } from '../../i18n';
import { IDinoTabletopView } from '../../types';
import { OraclePanel } from './OraclePanel';

export * from './types';
export * from './ruleEngine';
export * from './deckImporter';
export * from './OraclePanel';
export * from './OracleDeckModal';
export * from './AboutModal';

// ── Toolbar button renderer ──
export function renderOracleToolbarButton(container: HTMLElement, view: IDinoTabletopView): void {
  const btn = container.createEl('button', {
    cls: 'dte-btn',
    title: t('oracle.panelTitle'),
  });
  const icon = btn.createSpan({ cls: 'dte-btn-icon-prefix' });
  setIcon(icon, 'sparkles');
  btn.prepend(icon);
  btn.createSpan({ text: t('modules.oracleShort') });

  btn.addEventListener('click', () => {
    if (!view.oraclePanel) {
      view.oraclePanel = new OraclePanel(view.app, view.plugin, view.panelsLayer);
    }
    (view.oraclePanel as OraclePanel).open();
  });
}

// ── Module registration ──
export const OracleModule: EngineModule = {
  id: 'oracle',
  nameKey: 'modules.oracleName',
  descKey: 'modules.oracleDesc',
  icon: 'sparkles',
  defaultEnabled: false,
  renderToolbarButton: renderOracleToolbarButton,
};
