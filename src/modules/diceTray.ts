import { App, MarkdownRenderer, Menu, setIcon } from 'obsidian';
import { EngineModule } from './types';
import { t, TranslationKey } from '../i18n';
import { DinoSettings, DiceTrayExpression } from '../types';
import { genId } from '../utils';
import { NamePromptModal } from '../modals/NamePromptModal';

/** Helper to find the active Dice Roller plugin instance */
export function getDiceRollerPlugin(app: App): any {
  const p = (window as any).DiceRoller
    || (app as any).plugins?.getPlugin?.('obsidian-dice-roller')
    || (app as any).plugins?.plugins?.['obsidian-dice-roller'];
  return p && p._loaded !== false ? p : null;
}

/** Check if obsidian-dice-roller plugin is installed and active */
export function isDiceRollerAvailable(app: App): boolean {
  return !!getDiceRollerPlugin(app);
}

/** Parse and calculate fallback rolls if plugin doesn't produce DOM */
function evaluateDiceFallback(formula: string): { total: number; rolls: number[] } | null {
  try {
    const match = formula.replace(/\s+/g, '').match(/^(\d*)d(\d+)([\+\-]\d+)?$/i);
    if (!match) return null;
    const count = parseInt(match[1] || '1', 10);
    const sides = parseInt(match[2], 10);
    const mod = match[3] ? parseInt(match[3], 10) : 0;
    const rolls: number[] = [];
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const r = Math.floor(Math.random() * sides) + 1;
      rolls.push(r);
      sum += r;
    }
    return { total: sum + mod, rolls };
  } catch {
    return null;
  }
}

/** Render a dice expression using Dice Roller live API or markdown renderer */
export async function renderDiceExpression(
  app: App,
  container: HTMLElement,
  expression: string,
  sourcePath: string = '',
  component?: any
): Promise<void> {
  container.empty();
  const cleanedExpr = expression.trim();
  if (!cleanedExpr) return;

  // Strip |render or |norender from formula for programmatic API
  const cleanFormula = cleanedExpr.replace(/\|render/gi, '').replace(/\|norender/gi, '').trim();

  const plugin = getDiceRollerPlugin(app);

  // Method 1: Try Dice Roller's getRoller API directly
  if (plugin) {
    const getRollerFn = plugin.getRoller || plugin.api?.getRoller;
    if (typeof getRollerFn === 'function') {
      try {
        const roller = await getRollerFn.call(plugin.api || plugin, cleanFormula, sourcePath);
        if (roller) {
          const res = typeof roller.roll === 'function' ? await roller.roll() : null;
          const el = roller.containerEl || roller.el;
          if (el instanceof HTMLElement) {
            container.appendChild(el);
            return;
          } else if (res !== null && res !== undefined) {
            const resEl = container.createDiv({ cls: 'dte-dice-fallback-res' });
            resEl.createSpan({ text: `🎲 ${cleanFormula}: `, cls: 'dte-dice-res-label' });
            resEl.createSpan({ text: `${res}`, cls: 'dte-dice-res-num' });
            return;
          }
        }
      } catch (err) {
        console.warn('[Dino Tabletop] Dice Roller getRoller error:', err);
      }
    }
  }

  // Method 2: Try MarkdownRenderer with `dice: <expr>|render`
  try {
    const markdown = `\`dice: ${cleanFormula}|render\``;
    const comp = component || (app as any).plugins?.getPlugin?.('dino-tabletop-engine') || null;
    if ((MarkdownRenderer as any).render) {
      await (MarkdownRenderer as any).render(app, markdown, container, sourcePath, comp);
    } else {
      await MarkdownRenderer.renderMarkdown(markdown, container, sourcePath, comp);
    }
    if (container.children.length > 0 && container.textContent?.trim()) {
      return;
    }
  } catch (err) {
    console.warn('[Dino Tabletop] MarkdownRenderer dice error:', err);
  }

  // Method 3: Fallback calculation display
  const fallback = evaluateDiceFallback(cleanFormula);
  if (fallback) {
    const resEl = container.createDiv({ cls: 'dte-dice-fallback-res' });
    resEl.createSpan({ text: `🎲 ${cleanFormula} → `, cls: 'dte-dice-res-label' });
    if (fallback.rolls.length > 1) {
      resEl.createSpan({ text: `[${fallback.rolls.join(', ')}] = `, cls: 'dte-dice-res-details' });
    }
    resEl.createSpan({ text: `${fallback.total}`, cls: 'dte-dice-res-num' });
  } else {
    container.createSpan({ text: `🎲 ${cleanFormula}`, cls: 'dte-dice-res-label' });
  }
}

export class DiceTrayPanel {
  app: App;
  plugin: any;
  container: HTMLElement;
  el: HTMLElement;
  minimized: boolean = false;
  lastExpression: string = '';
  lastLabel: string = '';
  resultContainer: HTMLElement | null = null;
  resultWrapper: HTMLElement | null = null;
  expressionInput: HTMLInputElement | null = null;

  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;

  constructor(app: App, plugin: any, container: HTMLElement) {
    this.app = app;
    this.plugin = plugin;
    this.container = container;
    this.el = container.createDiv({ cls: 'dte-dice-tray-panel' });
    this.ensureSettings();
    this.setupPosition();
    this.build();
  }

  private ensureSettings(): void {
    const s = this.plugin.settings as DinoSettings;
    if (!s.diceTray) {
      s.diceTray = {
        savedExpressions: [],
        panelPosition: { x: 80, y: 200 },
      };
    }
    if (!Array.isArray(s.diceTray.savedExpressions)) {
      s.diceTray.savedExpressions = [];
    }
    if (!s.diceTray.panelPosition) {
      s.diceTray.panelPosition = { x: 80, y: 200 };
    }
  }

  private setupPosition(): void {
    const s = this.plugin.settings as DinoSettings;
    const pos = s.diceTray?.panelPosition || { x: 80, y: 200 };
    this.el.style.position = 'absolute';
    this.el.style.left = `${pos.x}px`;
    this.el.style.top = `${pos.y}px`;
  }

  public build(): void {
    this.ensureSettings();
    this.el.empty();
    this.el.classList.toggle('is-minimized', this.minimized);

    // ── Header ──
    const header = this.el.createDiv({ cls: 'dte-dice-tray-header' });
    const titleGroup = header.createDiv({ cls: 'dte-dice-tray-title-group' });
    
    const iconSpan = titleGroup.createSpan({ cls: 'dte-dice-tray-header-icon' });
    setIcon(iconSpan, 'dice-6');
    titleGroup.createSpan({ text: t('diceTray.panelTitle'), cls: 'dte-dice-tray-title' });

    const btnGroup = header.createDiv({ cls: 'dte-dice-tray-header-actions' });
    
    // Minimize button
    const minBtn = btnGroup.createEl('button', {
      cls: 'clickable-icon dte-btn-icon',
      attr: { 'aria-label': this.minimized ? t('modules.combatExpand') : t('modules.combatMinimize') },
    });
    setIcon(minBtn, this.minimized ? 'chevron-down' : 'minus');
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimized = !this.minimized;
      this.build();
    });

    // Close button
    const closeBtn = btnGroup.createEl('button', {
      cls: 'clickable-icon dte-btn-icon',
      attr: { 'aria-label': t('common.close') },
    });
    setIcon(closeBtn, 'x');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.el.style.display = 'none';
    });

    this.setupDrag(header);

    if (this.minimized) {
      return;
    }

    // ── Body ──
    const body = this.el.createDiv({ cls: 'dte-dice-tray-body' });

    const available = isDiceRollerAvailable(this.app);
    if (!available) {
      const warnBox = body.createDiv({ cls: 'dte-dice-warning' });
      const warnTitle = warnBox.createDiv({ cls: 'dte-dice-warning-title' });
      const warnIcon = warnTitle.createSpan({ cls: 'dte-dice-warning-icon' });
      setIcon(warnIcon, 'alert-triangle');
      warnTitle.createSpan({ text: t('diceTray.noDiceRoller') });
      warnBox.createDiv({ cls: 'dte-dice-warning-desc', text: t('diceTray.noDiceRollerDesc') });
      return;
    }

    // ── Section 1: Quick Dice ──
    const quickSection = body.createDiv({ cls: 'dte-dice-section' });
    quickSection.createDiv({ cls: 'dte-dice-section-label', text: t('diceTray.quickDice') });
    const quickRow = quickSection.createDiv({ cls: 'dte-dice-quick-row' });

    const standardDice = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
    for (const die of standardDice) {
      const dieBtn = quickRow.createEl('button', {
        cls: 'dte-dice-btn',
        text: die,
        attr: { 'aria-label': `1${die} (Double click for count)` },
      });
      
      let clickTimeout: any = null;
      dieBtn.addEventListener('click', () => {
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
          return;
        }
        clickTimeout = setTimeout(() => {
          clickTimeout = null;
          this.rollExpression(`1${die}`, die);
        }, 220);
      });

      dieBtn.addEventListener('dblclick', () => {
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
        }
        new NamePromptModal(
          this.app,
          `${t('common.amount')} (${die})`,
          '1, 2, 3...',
          (amountStr) => {
            const count = parseInt(amountStr.trim(), 10);
            if (!isNaN(count) && count > 0) {
              this.rollExpression(`${count}${die}`, `${count}${die}`);
            }
          }
        ).open();
      });
    }

    // ── Section 2: Custom Expression ──
    const customSection = body.createDiv({ cls: 'dte-dice-section' });
    customSection.createDiv({ cls: 'dte-dice-section-label', text: t('diceTray.customExpression') });
    
    const inputRow = customSection.createDiv({ cls: 'dte-dice-input-row' });
    const exprInput = inputRow.createEl('input', {
      type: 'text',
      cls: 'dte-dice-input',
      attr: { placeholder: t('diceTray.expressionPlaceholder') },
    });
    this.expressionInput = exprInput;

    const rollBtn = inputRow.createEl('button', {
      cls: 'dte-btn dte-btn-primary dte-dice-roll-btn',
      text: t('diceTray.rollBtn'),
    });
    const rollIcon = rollBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(rollIcon, 'dice-5');
    rollBtn.prepend(rollIcon);

    const triggerCustomRoll = () => {
      const val = exprInput.value.trim();
      if (!val) return;
      this.rollExpression(val);
    };

    exprInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        triggerCustomRoll();
      }
    });
    rollBtn.addEventListener('click', () => triggerCustomRoll());

    const saveBtn = customSection.createEl('button', {
      cls: 'dte-dice-save-btn',
      text: t('diceTray.saveBtn'),
    });
    const saveIcon = saveBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(saveIcon, 'plus');
    saveBtn.prepend(saveIcon);

    saveBtn.addEventListener('click', () => {
      const val = exprInput.value.trim();
      if (!val) {
        exprInput.focus();
        return;
      }
      new NamePromptModal(
        this.app,
        t('diceTray.saveLabelPrompt'),
        'e.g. Ataque con espada',
        (label) => {
          if (!label) label = val;
          const s = this.plugin.settings as DinoSettings;
          if (!s.diceTray) this.ensureSettings();
          s.diceTray!.savedExpressions.push({
            id: genId(),
            label: label.trim(),
            expression: val,
          });
          this.plugin.saveSettings();
          this.build();
        }
      ).open();
    });

    // ── Section 3: Saved Expressions ──
    const savedSection = body.createDiv({ cls: 'dte-dice-section' });
    savedSection.createDiv({ cls: 'dte-dice-section-label', text: t('diceTray.savedExpressions') });

    const s = this.plugin.settings as DinoSettings;
    const savedList = s.diceTray?.savedExpressions || [];

    if (savedList.length === 0) {
      savedSection.createDiv({ cls: 'dte-dice-empty-saved', text: t('diceTray.noSavedExpressions') });
    } else {
      const chipsContainer = savedSection.createDiv({ cls: 'dte-dice-chips-container' });
      for (const item of savedList) {
        const chip = chipsContainer.createDiv({ cls: 'dte-dice-saved-chip' });
        const chipIcon = chip.createSpan({ cls: 'dte-dice-chip-icon' });
        setIcon(chipIcon, 'sparkles');
        
        chip.createSpan({ text: `${item.label}: `, cls: 'dte-dice-chip-label' });
        chip.createSpan({ text: item.expression, cls: 'dte-dice-chip-expr' });

        // Left click to roll
        chip.addEventListener('click', () => {
          this.rollExpression(item.expression, item.label);
        });

        // Right click menu
        chip.addEventListener('contextmenu', (ev: MouseEvent) => {
          ev.preventDefault();
          const menu = new Menu();

          menu.addItem((i) =>
            i
              .setTitle(t('diceTray.rollBtn'))
              .setIcon('dice-5')
              .onClick(() => this.rollExpression(item.expression, item.label))
          );

          menu.addItem((i) =>
            i
              .setTitle(t('diceTray.editLabel'))
              .setIcon('edit')
              .onClick(() => {
                new NamePromptModal(
                  this.app,
                  t('diceTray.editLabel'),
                  item.label,
                  (newLabel) => {
                    if (newLabel.trim()) {
                      item.label = newLabel.trim();
                      this.plugin.saveSettings();
                      this.build();
                    }
                  }
                ).open();
              })
          );

          menu.addItem((i) =>
            i
              .setTitle(t('diceTray.editExpression'))
              .setIcon('code')
              .onClick(() => {
                new NamePromptModal(
                  this.app,
                  t('diceTray.editExpression'),
                  item.expression,
                  (newExpr) => {
                    if (newExpr.trim()) {
                      item.expression = newExpr.trim();
                      this.plugin.saveSettings();
                      this.build();
                    }
                  }
                ).open();
              })
          );

          menu.addSeparator();

          menu.addItem((i) =>
            i
              .setTitle(t('diceTray.deleteExpression'))
              .setIcon('trash')
              .onClick(() => {
                if (confirm(t('diceTray.deleteConfirm', { name: item.label }))) {
                  const idx = s.diceTray!.savedExpressions.findIndex((x) => x.id === item.id);
                  if (idx !== -1) {
                    s.diceTray!.savedExpressions.splice(idx, 1);
                    this.plugin.saveSettings();
                    this.build();
                  }
                }
              })
          );

          menu.showAtMouseEvent(ev);
        });
      }
    }

    // ── Section 4: Result Area ──
    const resultSection = body.createDiv({ cls: 'dte-dice-section dte-dice-result-section' });
    const resultHeader = resultSection.createDiv({ cls: 'dte-dice-result-header' });
    resultHeader.createDiv({ cls: 'dte-dice-section-label', text: t('diceTray.lastResult') });

    const repeatBtn = resultHeader.createEl('button', {
      cls: 'dte-dice-repeat-btn',
      title: t('diceTray.repeatBtn'),
    });
    const repIcon = repeatBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(repIcon, 'rotate-cw');
    repeatBtn.prepend(repIcon);
    repeatBtn.createSpan({ text: t('diceTray.repeatBtn') });
    repeatBtn.addEventListener('click', () => {
      if (this.lastExpression) {
        this.rollExpression(this.lastExpression, this.lastLabel);
      }
    });

    const resultBox = resultSection.createDiv({ cls: 'dte-dice-result-box' });
    this.resultWrapper = resultBox;

    const infoLabel = resultBox.createDiv({ cls: 'dte-dice-result-expr-info' });
    infoLabel.setText(this.lastExpression ? (this.lastLabel ? `${this.lastLabel} (${this.lastExpression})` : this.lastExpression) : '—');

    this.resultContainer = resultBox.createDiv({ cls: 'dte-dice-result-mount' });
    if (this.lastExpression) {
      renderDiceExpression(this.app, this.resultContainer, this.lastExpression, '', this.plugin);
    }
  }

  public async rollExpression(expression: string, label: string = ''): Promise<void> {
    this.lastExpression = expression.trim();
    this.lastLabel = label.trim();

    if (this.minimized) {
      this.minimized = false;
      this.build();
      return;
    }

    if (!this.resultWrapper || !this.resultContainer) {
      this.build();
      return;
    }

    const infoLabel = this.resultWrapper.querySelector('.dte-dice-result-expr-info');
    if (infoLabel) {
      infoLabel.setText(this.lastLabel ? `${this.lastLabel} (${this.lastExpression})` : this.lastExpression);
    }

    await renderDiceExpression(this.app, this.resultContainer, this.lastExpression, '', this.plugin);
  }

  public open(): void {
    this.el.style.display = 'flex';
    this.minimized = false;
    this.build();
  }

  public show(): void {
    this.el.style.display = 'flex';
  }

  private setupDrag(header: HTMLElement): void {
    header.addEventListener('mousedown', (ev: MouseEvent) => {
      if ((ev.target as HTMLElement).closest('.dte-btn-icon')) return;

      this.isDragging = true;
      this.dragStartX = ev.clientX;
      this.dragStartY = ev.clientY;
      const rect = this.el.getBoundingClientRect();
      this.dragOffsetX = ev.clientX - rect.left;
      this.dragOffsetY = ev.clientY - rect.top;

      const onMouseMove = (moveEv: MouseEvent) => {
        if (!this.isDragging) return;
        const parent = this.container.getBoundingClientRect();
        const x = Math.max(0, Math.min(moveEv.clientX - parent.left - this.dragOffsetX, parent.width - 150));
        const y = Math.max(0, Math.min(moveEv.clientY - parent.top - this.dragOffsetY, parent.height - 50));
        this.el.style.left = `${x}px`;
        this.el.style.top = `${y}px`;
        this.el.style.right = 'auto';
        this.el.style.bottom = 'auto';
      };

      const onMouseUp = () => {
        if (this.isDragging) {
          this.isDragging = false;
          const s = this.plugin.settings as DinoSettings;
          if (s.diceTray) {
            s.diceTray.panelPosition = {
              x: parseInt(this.el.style.left || '80', 10),
              y: parseInt(this.el.style.top || '200', 10),
            };
            this.plugin.saveSettings();
          }
        }
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  public destroy(): void {
    this.el.remove();
  }
}

// ── Toolbar button ──
export function renderDiceTrayToolbarButton(container: HTMLElement, view: any): void {
  const btn = container.createEl('button', {
    cls: 'dte-btn',
    title: t('diceTray.panelTitle'),
  });
  const icon = btn.createSpan({ cls: 'dte-btn-icon-prefix' });
  setIcon(icon, 'dice-6');
  btn.prepend(icon);
  btn.createSpan({ text: t('modules.diceTrayShort') });
  btn.addEventListener('click', () => {
    if (!view.diceTrayPanel) {
      view.diceTrayPanel = new DiceTrayPanel(view.app, view.plugin, view.panelsLayer);
    }
    view.diceTrayPanel.open();
  });
}

// ── Module registration ──
export const DiceTrayModule: EngineModule = {
  id: 'dice-tray',
  nameKey: 'modules.diceTrayName' as TranslationKey,
  descKey: 'modules.diceTrayDesc' as TranslationKey,
  icon: 'dice-6',
  defaultEnabled: false,
  renderToolbarButton: renderDiceTrayToolbarButton,
};
