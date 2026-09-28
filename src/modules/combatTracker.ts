import { Modal, Notice, setIcon } from 'obsidian';
import { EngineModule } from './types';
import { t } from '../i18n';
import { TokenData } from '../types';

export class CombatTrackerModal extends Modal {
  view: any;
  currentTurnIndex: number;
  round: number;

  constructor(app: any, view: any) {
    super(app);
    this.view = view;
    this.currentTurnIndex = 0;
    this.round = 1;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: `⚔️ ${t('modules.combatTrackerName')}` });

    const map = this.view.getCurrentMap();
    if (!map) {
      contentEl.createDiv({ cls: 'dte-empty', text: t('header.emptyMaps') });
      return;
    }

    const tokens: TokenData[] = map.tokens || [];
    if (!tokens.length) {
      contentEl.createDiv({ cls: 'dte-empty', text: t('modules.combatTrackerNoTokens') });
      return;
    }

    // Top control bar (Round, Next Turn, Roll All)
    const headerRow = contentEl.createDiv({ cls: 'dte-combat-header' });
    const roundLabel = headerRow.createSpan({ cls: 'dte-combat-round', text: `${t('modules.combatRound')} ${this.round}` });

    const btnGroup = headerRow.createDiv({ cls: 'dte-toolbar-group' });

    const nextTurnBtn = btnGroup.createEl('button', { cls: 'mod-cta dte-btn', text: t('modules.combatNextTurn') });
    nextTurnBtn.addEventListener('click', () => {
      this.currentTurnIndex++;
      if (this.currentTurnIndex >= tokens.length) {
        this.currentTurnIndex = 0;
        this.round++;
        roundLabel.setText(`${t('modules.combatRound')} ${this.round}`);
      }
      this.renderList(listEl, tokens);
    });

    const resetBtn = btnGroup.createEl('button', { cls: 'dte-btn', text: t('modules.combatReset') });
    resetBtn.addEventListener('click', () => {
      this.currentTurnIndex = 0;
      this.round = 1;
      this.renderList(listEl, tokens);
    });

    const listEl = contentEl.createDiv({ cls: 'dte-combat-list' });
    this.renderList(listEl, tokens);
  }

  renderList(container: HTMLElement, tokens: TokenData[]): void {
    container.empty();
    tokens.forEach((tok, idx) => {
      const isCurrent = idx === this.currentTurnIndex;
      const row = container.createDiv({ cls: `dte-combat-row ${isCurrent ? 'dte-combat-active' : ''}` });

      const indicator = row.createDiv({ cls: 'dte-combat-indicator', text: isCurrent ? '▶' : `${idx + 1}` });

      const nameEl = row.createDiv({ cls: 'dte-combat-name', text: tok.name || t('common.unnamed') });

      const hpEl = row.createDiv({ cls: 'dte-combat-hp', text: `${tok.hp ?? 0}/${tok.maxHp ?? 0} HP` });

      const actions = row.createDiv({ cls: 'dte-combat-actions' });
      const dmgBtn = actions.createEl('button', { cls: 'dte-btn-icon', text: '-1' });
      dmgBtn.addEventListener('click', () => {
        const map = this.view.getCurrentMap();
        if (map) this.view.applyTokenDelta(map, tok, -1);
        hpEl.setText(`${tok.hp ?? 0}/${tok.maxHp ?? 0} HP`);
      });

      const healBtn = actions.createEl('button', { cls: 'dte-btn-icon', text: '+1' });
      healBtn.addEventListener('click', () => {
        const map = this.view.getCurrentMap();
        if (map) this.view.applyTokenDelta(map, tok, 1);
        hpEl.setText(`${tok.hp ?? 0}/${tok.maxHp ?? 0} HP`);
      });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export const CombatTrackerModule: EngineModule = {
  id: 'combat-tracker',
  nameKey: 'modules.combatTrackerName',
  descKey: 'modules.combatTrackerDesc',
  icon: 'swords',
  defaultEnabled: false,
  renderToolbarButton(container: HTMLElement, view: any): void {
    const btn = container.createEl('button', {
      cls: 'dte-btn',
      text: t('modules.combatTrackerShort'),
    });
    const icon = btn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(icon, 'swords');
    btn.prepend(icon);
    btn.addEventListener('click', () => {
      new CombatTrackerModal(view.app, view).open();
    });
  },
};
