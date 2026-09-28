import { App, Modal, Notice, Setting, setIcon, TFile } from 'obsidian';
import { EngineModule } from './types';
import { t } from '../i18n';
import { CombatantData, CombatData, ConditionData, MapData, TokenData } from '../types';
import { clamp, genId, getIconClass } from '../utils';
import { DamageModal } from '../modals/DamageModal';

export const PRESET_CONDITIONS: Array<{ name: string; icon: string; color: string; defaultRounds: number | null }> = [
  { name: 'Envenenado', icon: '🧪', color: '#10b981', defaultRounds: 3 },
  { name: 'En llamas', icon: '🔥', color: '#ef4444', defaultRounds: 3 },
  { name: 'Escudo', icon: '🛡️', color: '#3b82f6', defaultRounds: 1 },
  { name: 'Aturdido', icon: '⚡', color: '#f59e0b', defaultRounds: 1 },
  { name: 'Cegado', icon: '👁️', color: '#6b7280', defaultRounds: 2 },
  { name: 'Dormido', icon: '💤', color: '#8b5cf6', defaultRounds: null },
  { name: 'Inmovilizado', icon: '🕸️', color: '#92400e', defaultRounds: 2 },
  { name: 'Bendición', icon: '✨', color: '#eab308', defaultRounds: 10 },
  { name: 'Maldición', icon: '💀', color: '#7c3aed', defaultRounds: null },
  { name: 'Marcado', icon: '🎯', color: '#ec4899', defaultRounds: 5 },
  { name: 'Invisible', icon: '👻', color: '#06b6d4', defaultRounds: 10 },
  { name: 'Sangrado', icon: '🩸', color: '#b91c1c', defaultRounds: 3 },
];

export class AddConditionModal extends Modal {
  onAdd: (cond: ConditionData) => void;

  constructor(app: App, onAdd: (cond: ConditionData) => void) {
    super(app);
    this.onAdd = onAdd;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: t('modules.combatConditionTitle') });

    // Grid de condiciones predefinidas
    const grid = contentEl.createDiv({ cls: 'dte-combat-preset-grid' });
    for (const preset of PRESET_CONDITIONS) {
      const pBtn = grid.createEl('button', { cls: 'dte-combat-preset-btn' });
      pBtn.style.setProperty('--preset-color', preset.color);
      pBtn.createSpan({ cls: 'dte-combat-preset-icon', text: preset.icon });
      pBtn.createSpan({ cls: 'dte-combat-preset-name', text: preset.name });
      if (preset.defaultRounds !== null) {
        pBtn.createSpan({ cls: 'dte-combat-preset-duration', text: `${preset.defaultRounds}r` });
      }
      pBtn.addEventListener('click', () => {
        this.close();
        this.onAdd({
          id: genId(),
          name: preset.name,
          icon: preset.icon,
          roundsRemaining: preset.defaultRounds,
          color: preset.color,
        });
      });
    }

    // Condición personalizada
    contentEl.createEl('h3', { text: t('modules.combatConditionCustom') });

    let customName = '';
    let customIcon = '✨';
    let customRounds: number | null = 3;

    new Setting(contentEl).setName(t('modules.combatConditionName')).addText((text) => {
      text.setPlaceholder('ej. Ralentizado');
      text.onChange((v) => (customName = v));
    });

    new Setting(contentEl).setName(t('modules.combatConditionIcon')).addText((text) => {
      text.setValue(customIcon);
      text.onChange((v) => (customIcon = v || '✨'));
    });

    new Setting(contentEl).setName(t('modules.combatConditionDuration')).addText((text) => {
      text.inputEl.type = 'number';
      text.setPlaceholder(t('modules.combatIndefinite'));
      text.setValue('3');
      text.onChange((v) => {
        const val = v.trim();
        customRounds = val === '' ? null : Math.max(1, Number(val));
      });
    });

    const addCustomRow = new Setting(contentEl);
    addCustomRow.addButton((b) =>
      b
        .setButtonText(t('common.save'))
        .setCta()
        .onClick(() => {
          if (!customName.trim()) {
            new Notice('Ingresa un nombre para el efecto');
            return;
          }
          this.close();
          this.onAdd({
            id: genId(),
            name: customName.trim(),
            icon: customIcon.trim() || '✨',
            roundsRemaining: customRounds,
            color: '#8b5cf6',
          });
        })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class AdjustConditionModal extends Modal {
  cond: ConditionData;
  combatantName: string;
  onUpdate: (updated: ConditionData | null) => void;

  constructor(app: App, cond: ConditionData, combatantName: string, onUpdate: (updated: ConditionData | null) => void) {
    super(app);
    this.cond = cond;
    this.combatantName = combatantName;
    this.onUpdate = onUpdate;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: `${this.cond.icon || '✨'} ${this.cond.name}` });
    contentEl.createDiv({
      cls: 'dte-hint',
      text: `${this.combatantName} — ${
        this.cond.roundsRemaining !== null
          ? t('modules.combatRoundsLeft', { rounds: this.cond.roundsRemaining })
          : t('modules.combatIndefinite')
      }`,
    });

    const actions = contentEl.createDiv({ cls: 'dte-combat-cond-adjust-actions' });

    // -1 Ronda
    const minusBtn = actions.createEl('button', {
      cls: 'dte-btn',
      text: '-1 ronda',
    });
    minusBtn.disabled = this.cond.roundsRemaining === null || this.cond.roundsRemaining <= 1;
    minusBtn.addEventListener('click', () => {
      if (this.cond.roundsRemaining !== null && this.cond.roundsRemaining > 1) {
        this.cond.roundsRemaining--;
        this.close();
        this.onUpdate(this.cond);
      }
    });

    // +1 Ronda
    const plusBtn = actions.createEl('button', {
      cls: 'dte-btn',
      text: '+1 ronda',
    });
    plusBtn.addEventListener('click', () => {
      this.cond.roundsRemaining = (this.cond.roundsRemaining ?? 0) + 1;
      this.close();
      this.onUpdate(this.cond);
    });

    // Alternar Indefinido / Fijo
    const toggleInfBtn = actions.createEl('button', {
      cls: 'dte-btn',
      text: this.cond.roundsRemaining === null ? 'Fijar 3 rondas' : 'Hacer indefinido (∞)',
    });
    toggleInfBtn.addEventListener('click', () => {
      if (this.cond.roundsRemaining === null) {
        this.cond.roundsRemaining = 3;
      } else {
        this.cond.roundsRemaining = null;
      }
      this.close();
      this.onUpdate(this.cond);
    });

    // Eliminar efecto
    const deleteBtn = contentEl.createEl('button', {
      cls: 'dte-btn dte-combat-cond-delete-btn',
      text: `✕ ${t('modules.combatRemoveCondition')}`,
    });
    deleteBtn.style.marginTop = '16px';
    deleteBtn.style.width = '100%';
    deleteBtn.addEventListener('click', () => {
      this.close();
      this.onUpdate(null);
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class AddTokensToCombatModal extends Modal {
  view: any;
  map: MapData;
  onAdded: () => void;

  constructor(app: App, view: any, map: MapData, onAdded: () => void) {
    super(app);
    this.view = view;
    this.map = map;
    this.onAdded = onAdded;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: t('modules.combatSelectTokensTitle') });
    contentEl.createDiv({ cls: 'dte-hint', text: t('modules.combatSelectTokensDesc') });

    const combat = this.map.combat || { active: true, round: 1, turnIndex: 0, combatants: [] };
    const existingTokenIds = new Set(combat.combatants.map((c) => c.tokenId).filter(Boolean));
    const availableTokens = (this.map.tokens || []).filter((tok) => !existingTokenIds.has(tok.id));

    if (!availableTokens.length) {
      contentEl.createDiv({ cls: 'dte-empty', text: t('modules.combatNoAvailableTokens') });
      return;
    }

    const selections: Record<string, { selected: boolean; initiative: number | null }> = {};
    for (const tok of availableTokens) {
      selections[tok.id] = { selected: true, initiative: null };
    }

    const listEl = contentEl.createDiv({ cls: 'dte-combat-select-list' });

    for (const tok of availableTokens) {
      const row = listEl.createDiv({ cls: 'dte-combat-select-row' });

      const check = row.createEl('input', { type: 'checkbox' });
      check.checked = true;
      check.addEventListener('change', () => {
        selections[tok.id].selected = check.checked;
      });

      const thumb = row.createDiv({ cls: 'dte-combat-thumb' });
      thumb.style.background = tok.color || '#4c8bf5';
      if (tok.imagePath) {
        const file = this.app.vault.getAbstractFileByPath(tok.imagePath);
        if (file) {
          thumb.style.backgroundImage = `url("${this.app.vault.getResourcePath(file as TFile)}")`;
          thumb.style.backgroundSize = 'cover';
          thumb.style.backgroundPosition = 'center';
        }
      } else if (tok.icon && this.view.plugin.settings.enableCustomFont) {
        const iconCls = getIconClass(tok.icon, this.view.plugin.settings.customFontPrefix);
        const iconEl = thumb.createEl('i', { cls: iconCls });
        iconEl.style.fontSize = '14px';
      } else {
        thumb.setText((tok.name || '?').slice(0, 2).toUpperCase());
      }

      row.createSpan({ cls: 'dte-combat-select-name', text: tok.name || t('common.unnamed') });

      const initInput = row.createEl('input', {
        type: 'number',
        cls: 'dte-combat-select-init',
        placeholder: 'Init',
      });
      initInput.addEventListener('input', () => {
        const val = initInput.value.trim();
        selections[tok.id].initiative = val === '' ? null : Number(val);
      });
    }

    const addBtn = contentEl.createEl('button', {
      cls: 'mod-cta dte-btn',
      text: t('modules.combatAddSelected', { count: availableTokens.length }),
    });
    addBtn.style.marginTop = '12px';
    addBtn.addEventListener('click', () => {
      for (const tok of availableTokens) {
        const state = selections[tok.id];
        if (state && state.selected) {
          combat.combatants.push({
            id: genId(),
            tokenId: tok.id,
            name: tok.name || t('common.unnamed'),
            initiative: state.initiative,
            hp: tok.hp ?? 10,
            maxHp: tok.maxHp ?? 10,
            color: tok.color || '#4c8bf5',
            imagePath: tok.imagePath || null,
            icon: tok.icon || null,
            conditions: tok.conditions ? [...tok.conditions] : [],
          });
        }
      }

      // Auto-sort descending by initiative
      combat.combatants.sort((a, b) => {
        if (a.initiative === null && b.initiative === null) return 0;
        if (a.initiative === null) return 1;
        if (b.initiative === null) return -1;
        return b.initiative - a.initiative;
      });

      this.map.combat = combat;
      this.view.plugin.saveSettings();
      this.view.render();
      this.close();
      this.onAdded();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class ManualCombatantModal extends Modal {
  onSave: (combatant: CombatantData) => void;

  constructor(app: App, onSave: (combatant: CombatantData) => void) {
    super(app);
    this.onSave = onSave;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: t('modules.combatManualTitle') });
    contentEl.createDiv({ cls: 'dte-hint', text: t('modules.combatManualDesc') });

    let name = '';
    let initiative: number | null = null;
    let hp = 10;
    let maxHp = 10;
    let color = '#d97706';

    new Setting(contentEl).setName(t('common.name')).addText((text) => text.onChange((v) => (name = v)));

    new Setting(contentEl).setName('Iniciativa').addText((text) => {
      text.inputEl.type = 'number';
      text.onChange((v) => {
        const val = v.trim();
        initiative = val === '' ? null : Number(val);
      });
    });

    new Setting(contentEl).setName(t('common.currentHp')).addText((text) => {
      text.inputEl.type = 'number';
      text.setValue('10');
      text.onChange((v) => (hp = Number(v) || 0));
    });

    new Setting(contentEl).setName(t('common.maxHp')).addText((text) => {
      text.inputEl.type = 'number';
      text.setValue('10');
      text.onChange((v) => (maxHp = Number(v) || 0));
    });

    new Setting(contentEl).setName(t('common.color')).addColorPicker((cp) => {
      cp.setValue(color).onChange((v) => (color = v));
    });

    const btnRow = new Setting(contentEl);
    btnRow.addButton((b) =>
      b
        .setButtonText(t('common.save'))
        .setCta()
        .onClick(() => {
          this.close();
          this.onSave({
            id: genId(),
            tokenId: null,
            name: name || t('common.unnamed'),
            initiative,
            hp,
            maxHp,
            color,
            imagePath: null,
            icon: null,
            conditions: [],
          });
        })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class CombatTrackerPanel {
  view: any;
  el: HTMLElement;
  isMinimized: boolean;

  constructor(view: any) {
    this.view = view;
    this.isMinimized = false;
    this.init();
  }

  init(): void {
    if (!this.view.panelsLayer) {
      this.view.containerEl.style.position = 'relative';
      this.view.panelsLayer = this.view.containerEl.createDiv({ cls: 'dte-panels-layer' });
    }

    this.el = this.view.panelsLayer.createDiv({ cls: 'dte-combat-panel' });
    this.el.style.right = '24px';
    this.el.style.top = '24px';
    this.el.style.left = 'auto';

    this.render();
  }

  getCombat(): CombatData {
    const map = this.view.getCurrentMap();
    if (!map) return { active: true, round: 1, turnIndex: 0, combatants: [] };
    if (!map.combat) {
      map.combat = { active: true, round: 1, turnIndex: 0, combatants: [] };
    }
    return map.combat;
  }

  toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
    this.render();
  }

  render(): void {
    this.el.empty();
    const combat = this.getCombat();
    const map = this.view.getCurrentMap();

    // ==========================================
    // HEADER
    // ==========================================
    const header = this.el.createDiv({ cls: 'dte-combat-panel-header' });

    const titleBox = header.createDiv({ cls: 'dte-combat-panel-title' });
    titleBox.createSpan({ cls: 'dte-combat-badge', text: '⚔️' });
    titleBox.createSpan({ text: t('modules.combatTrackerShort') });
    titleBox.createSpan({
      cls: 'dte-combat-round-badge',
      text: t('modules.combatRound', { round: combat.round }),
    });

    const headerBtns = header.createDiv({ cls: 'dte-combat-panel-header-btns' });

    const minBtn = headerBtns.createEl('button', {
      cls: 'dte-note-panel-toggle',
      attr: { 'aria-label': this.isMinimized ? t('modules.combatExpand') : t('modules.combatMinimize') },
      text: this.isMinimized ? '➕' : '➖',
    });
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isMinimized = !this.isMinimized;
      this.render();
    });

    const closeBtn = headerBtns.createEl('button', {
      cls: 'dte-note-panel-close',
      text: '✕',
    });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (combat.combatants.length > 0) {
        if (!confirm(t('modules.combatCloseConfirm'))) return;
      }
      this.destroy();
    });

    this.attachHeaderDragging(header, minBtn, closeBtn);

    if (this.isMinimized) {
      this.el.addClass('dte-combat-minimized');
      return;
    }
    this.el.removeClass('dte-combat-minimized');

    // ==========================================
    // CONTROLS (Prev / Next Turn)
    // ==========================================
    const controlsRow = this.el.createDiv({ cls: 'dte-combat-controls-row' });

    const prevBtn = controlsRow.createEl('button', { cls: 'dte-btn', text: t('modules.combatPrevTurn') });
    prevBtn.disabled = combat.combatants.length <= 1;
    prevBtn.addEventListener('click', () => {
      if (combat.combatants.length === 0) return;
      combat.turnIndex--;
      if (combat.turnIndex < 0) {
        combat.turnIndex = combat.combatants.length - 1;
        if (combat.round > 1) combat.round--;
      }
      this.saveAndRefresh();
    });

    const nextBtn = controlsRow.createEl('button', {
      cls: 'mod-cta dte-btn dte-combat-next-btn',
      text: t('modules.combatNextTurn'),
    });
    nextBtn.disabled = combat.combatants.length === 0;
    nextBtn.addEventListener('click', () => {
      if (combat.combatants.length === 0) return;
      const prevIdx = combat.turnIndex;
      const prevCombatant = combat.combatants[prevIdx];

      // Decrementar duración de condiciones del combatiente cuyo turno finaliza
      if (prevCombatant && prevCombatant.conditions && prevCombatant.conditions.length > 0) {
        const remaining: ConditionData[] = [];
        for (const cond of prevCombatant.conditions) {
          if (cond.roundsRemaining !== null) {
            cond.roundsRemaining--;
            if (cond.roundsRemaining <= 0) {
              new Notice(t('modules.combatConditionExpired', { condition: cond.name, combatant: prevCombatant.name }));
              continue;
            }
          }
          remaining.push(cond);
        }
        prevCombatant.conditions = remaining;
        if (prevCombatant.tokenId && map) {
          const mapTok = map.tokens.find((tok) => tok.id === prevCombatant.tokenId);
          if (mapTok) {
            mapTok.conditions = [...remaining];
          }
        }
      }

      combat.turnIndex++;
      if (combat.turnIndex >= combat.combatants.length) {
        combat.turnIndex = 0;
        combat.round++;
      }
      this.saveAndRefresh();
    });

    // ==========================================
    // COMBATANTS LIST
    // ==========================================
    const listWrap = this.el.createDiv({ cls: 'dte-combat-list-wrap' });

    if (!combat.combatants.length) {
      listWrap.createDiv({ cls: 'dte-empty', text: t('modules.combatTrackerNoTokens') });
    } else {
      combat.combatants.forEach((c, idx) => {
        const isCurrent = idx === combat.turnIndex;
        const row = listWrap.createDiv({ cls: `dte-combat-item-row ${isCurrent ? 'dte-combat-row-active' : ''}` });

        // Turn indicator
        row.createDiv({ cls: 'dte-combat-turn-ind', text: isCurrent ? '▶' : '' });

        // Initiative badge
        const initBadge = row.createDiv({
          cls: 'dte-combat-init-badge',
          text: c.initiative !== null ? String(c.initiative) : '—',
          attr: { 'aria-label': t('modules.combatInitiativePrompt', { name: c.name }) },
        });
        initBadge.addEventListener('click', (e) => {
          e.stopPropagation();
          const currentVal = c.initiative !== null ? String(c.initiative) : '';
          const newVal = prompt(t('modules.combatInitiativePrompt', { name: c.name }), currentVal);
          if (newVal !== null) {
            const num = newVal.trim() === '' ? null : Number(newVal);
            c.initiative = num;
            // Re-sort descending
            combat.combatants.sort((a, b) => {
              if (a.initiative === null && b.initiative === null) return 0;
              if (a.initiative === null) return 1;
              if (b.initiative === null) return -1;
              return b.initiative - a.initiative;
            });
            this.saveAndRefresh();
          }
        });

        // Thumbnail
        const thumb = row.createDiv({ cls: 'dte-combat-thumb' });
        thumb.style.background = c.color || '#4c8bf5';
        if (c.imagePath) {
          const file = this.view.app.vault.getAbstractFileByPath(c.imagePath);
          if (file) {
            thumb.style.backgroundImage = `url("${this.view.app.vault.getResourcePath(file as TFile)}")`;
            thumb.style.backgroundSize = 'cover';
            thumb.style.backgroundPosition = 'center';
          }
        } else if (c.icon && this.view.plugin.settings.enableCustomFont) {
          const iconCls = getIconClass(c.icon, this.view.plugin.settings.customFontPrefix);
          const iconEl = thumb.createEl('i', { cls: iconCls });
          iconEl.style.fontSize = '14px';
        } else {
          thumb.setText((c.name || '?').slice(0, 2).toUpperCase());
        }

        // Info (Name + Mini HP Bar + Conditions Row)
        const info = row.createDiv({ cls: 'dte-combat-item-info' });
        info.createDiv({ cls: 'dte-combat-item-name', text: c.name });

        const maxHp = c.maxHp || 1;
        const ratio = clamp(c.hp / maxHp, 0, 1);
        const hpBarOuter = info.createDiv({ cls: 'dte-combat-hpbar-outer' });
        const hpBarInner = hpBarOuter.createDiv({ cls: 'dte-combat-hpbar-inner' });
        hpBarInner.style.width = ratio * 100 + '%';
        hpBarInner.style.background = ratio > 0.66 ? '#4caf50' : ratio > 0.33 ? '#ffc107' : '#f44336';

        // Row de condiciones y efectos de estado
        const condsRow = info.createDiv({ cls: 'dte-combat-conditions-row' });
        c.conditions = c.conditions || [];
        for (let cIdx = 0; cIdx < c.conditions.length; cIdx++) {
          const cond = c.conditions[cIdx];
          const durText = cond.roundsRemaining !== null ? `${cond.roundsRemaining}r` : '∞';
          const condBadge = condsRow.createSpan({
            cls: 'dte-combat-condition-badge',
            text: `${cond.icon || '✨'} ${cond.name} (${durText})`,
            attr: { 'aria-label': `${cond.name} (${durText}) - Click para ajustar` },
          });
          if (cond.color) {
            condBadge.style.borderColor = cond.color;
          }
          condBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            new AdjustConditionModal(this.view.app, cond, c.name, (updated) => {
              if (updated === null) {
                c.conditions?.splice(cIdx, 1);
              }
              // Sincronizar con el token en el mapa si está vinculado
              if (c.tokenId && map) {
                const mapTok = map.tokens.find((tok) => tok.id === c.tokenId);
                if (mapTok) {
                  mapTok.conditions = [...(c.conditions || [])];
                }
              }
              this.saveAndRefresh();
            }).open();
          });
        }

        // Botón añadir condición rápida
        const addCondBtn = condsRow.createEl('button', {
          cls: 'dte-combat-add-cond-btn',
          text: '+✨',
          attr: { 'aria-label': t('modules.combatAddCondition') },
        });
        addCondBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          new AddConditionModal(this.view.app, (newCond) => {
            c.conditions = c.conditions || [];
            c.conditions.push(newCond);
            // Sincronizar con el token en el mapa si está vinculado
            if (c.tokenId && map) {
              const mapTok = map.tokens.find((tok) => tok.id === c.tokenId);
              if (mapTok) {
                mapTok.conditions = [...c.conditions];
              }
            }
            this.saveAndRefresh();
          }).open();
        });

        // HP Badge / Click to open DamageModal
        const hpText = row.createDiv({ cls: 'dte-combat-hp-text', text: `${c.hp}/${c.maxHp}` });
        hpText.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetToken: TokenData = {
            id: c.tokenId || c.id,
            name: c.name,
            hp: c.hp,
            maxHp: c.maxHp,
            color: c.color,
            size: 44,
            x: 50,
            y: 50,
            imagePath: c.imagePath,
            linkedNote: null,
            counters: [],
            conditions: c.conditions || [],
          };
          new DamageModal(this.view.app, targetToken, (delta) => {
            c.hp = clamp(c.hp + delta, 0, c.maxHp);
            // Sincronizar con el token en el mapa si está vinculado
            if (c.tokenId && map) {
              const mapTok = map.tokens.find((t) => t.id === c.tokenId);
              if (mapTok) {
                this.view.applyTokenDelta(map, mapTok, delta);
              }
            }
            this.saveAndRefresh();
          }).open();
        });

        // Quick leave combat button
        const leaveBtn = row.createEl('button', {
          cls: 'clickable-icon dte-btn-icon dte-combat-leave-btn',
          attr: { 'aria-label': t('modules.combatLeaveCombat') },
        });
        setIcon(leaveBtn, 'x');
        leaveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          combat.combatants.splice(idx, 1);
          if (combat.turnIndex >= combat.combatants.length) {
            combat.turnIndex = Math.max(0, combat.combatants.length - 1);
          }
          this.saveAndRefresh();
        });
      });
    }

    // ==========================================
    // FOOTER ACTIONS
    // ==========================================
    const footer = this.el.createDiv({ cls: 'dte-combat-footer' });

    const addFromMapBtn = footer.createEl('button', {
      cls: 'dte-btn dte-combat-action-btn',
      text: t('modules.combatAddTokensFromMap'),
    });
    addFromMapBtn.disabled = !map || !map.tokens.length;
    addFromMapBtn.addEventListener('click', () => {
      if (!map) return;
      new AddTokensToCombatModal(this.view.app, this.view, map, () => this.render()).open();
    });

    const addManualBtn = footer.createEl('button', {
      cls: 'dte-btn dte-combat-action-btn',
      text: t('modules.combatAddManual'),
    });
    addManualBtn.addEventListener('click', () => {
      new ManualCombatantModal(this.view.app, (saved) => {
        combat.combatants.push(saved);
        combat.combatants.sort((a, b) => {
          if (a.initiative === null && b.initiative === null) return 0;
          if (a.initiative === null) return 1;
          if (b.initiative === null) return -1;
          return b.initiative - a.initiative;
        });
        this.saveAndRefresh();
      }).open();
    });

    if (combat.combatants.length > 0) {
      const endBtn = footer.createEl('button', {
        cls: 'dte-btn dte-combat-end-btn',
        text: t('modules.combatEndCombat'),
      });
      endBtn.addEventListener('click', () => {
        if (!confirm(t('modules.combatEndConfirm'))) return;
        combat.combatants = [];
        combat.round = 1;
        combat.turnIndex = 0;
        this.saveAndRefresh();
      });
    }
  }

  saveAndRefresh(): void {
    this.view.plugin.saveSettings();
    this.render();
    this.view.render();
  }

  attachHeaderDragging(header: HTMLElement, minBtn: HTMLElement, closeBtn: HTMLElement): void {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.target === minBtn || e.target === closeBtn || (e.target as HTMLElement).closest('button')) {
        return;
      }
      dragging = true;
      const rect = this.el.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      header.setPointerCapture(e.pointerId);
      this.el.addClass('dte-note-panel-dragging');
    });

    header.addEventListener('pointermove', (e: PointerEvent) => {
      if (!dragging) return;
      const layerRect = this.view.panelsLayer.getBoundingClientRect();
      let x = e.clientX - layerRect.left - offsetX;
      let y = e.clientY - layerRect.top - offsetY;
      x = clamp(x, 0, Math.max(0, layerRect.width - this.el.offsetWidth));
      y = clamp(y, 0, Math.max(0, layerRect.height - this.el.offsetHeight));
      this.el.style.left = x + 'px';
      this.el.style.top = y + 'px';
      this.el.style.right = 'auto';
    });

    const endDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try {
        header.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* noop */
      }
      this.el.removeClass('dte-note-panel-dragging');
    };

    header.addEventListener('pointerup', endDrag);
    header.addEventListener('pointercancel', endDrag);
  }

  destroy(): void {
    this.el.remove();
    this.view.combatPanel = null;
    this.view.render();
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
      view.toggleCombatTracker();
    });
  },
};
