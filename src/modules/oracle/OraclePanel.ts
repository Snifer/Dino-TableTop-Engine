import { App, Notice, TFile, setIcon } from 'obsidian';
import { DinoPlugin, DinoSettings } from '../../types';
import { OracleDeck, OracleCard, OracleReadingEntry, InterpretationRule } from './types';
import { evaluateRule, EvaluationResult } from './ruleEngine';
import { createHierofanteDeck } from './deckImporter';
import { OracleAboutModal } from './AboutModal';
import { OracleDeckModal } from './OracleDeckModal';
import { genId } from '../../utils';

export class OraclePanel {
  private app: App;
  private plugin: DinoPlugin;
  private container: HTMLElement;
  public el: HTMLElement;
  minimized = false;

  // Active state
  private activeTab: 'draw' | 'history' = 'draw';
  private drawPile: OracleCard[] = [];
  private currentCard: OracleCard | null = null;
  private currentReversed = false;
  private currentResult: EvaluationResult | null = null;

  // Mode state
  private activeRuleId: string | null = null;
  private currentQuestion = '';
  private isConfigOpen = false;

  constructor(app: App, plugin: DinoPlugin, container: HTMLElement) {
    this.app = app;
    this.plugin = plugin;
    this.container = container;

    this.el = this.container.createDiv({ cls: 'dte-oracle-panel dte-floating-panel' });
    this.ensureSettings();
    this.initDeck();
    this.setupPosition();
    this.build();
  }

  private ensureSettings(): void {
    const s = this.plugin.settings as DinoSettings;
    if (!s.oracleDecks || !Array.isArray(s.oracleDecks) || s.oracleDecks.length === 0) {
      // Auto-bootstrap Hierofante as the primary oracle deck template
      s.oracleDecks = [createHierofanteDeck('Hierofante')];
    } else {
      for (const d of s.oracleDecks) {
        if (d.name === 'Hierofante del Bastión') {
          d.name = 'Hierofante';
        }
      }
      const active = s.oracleDecks.find((d) => d.id === s.activeOracleDeckId) || s.oracleDecks[0];
      if (active && active.name === 'Hierofante del Bastión') {
        active.name = 'Hierofante';
      }
      if (!active.cards || active.cards.length === 0) {
        active.cards = createHierofanteDeck().cards;
      }
    }
    if (!s.activeOracleDeckId) {
      s.activeOracleDeckId = s.oracleDecks[0].id;
    }
    if (s.oracleResetQuestionOnDraw === undefined) {
      s.oracleResetQuestionOnDraw = true;
    }
    if (!s.oraclePanelPosition) {
      s.oraclePanelPosition = { x: 120, y: 120 };
    }
  }

  private getActiveDeck(): OracleDeck {
    const s = this.plugin.settings as DinoSettings;
    const found = s.oracleDecks.find((d) => d.id === s.activeOracleDeckId);
    return found || s.oracleDecks[0];
  }

  private initDeck(): void {
    this.shuffleDeck(false);
  }

  private shuffleDeck(showNotice = true): void {
    const deck = this.getActiveDeck();
    // Copy and shuffle
    const copy = [...deck.cards];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    this.drawPile = copy;
    this.currentCard = null;
    this.currentResult = null;
    this.activeRuleId = null;
    this.isConfigOpen = false;

    if (showNotice) {
      new Notice(`Mazo barajado: ${this.drawPile.length} cartas disponibles.`, 3000);
      this.build();
    }
  }

  private setupPosition(): void {
    const s = this.plugin.settings as DinoSettings;
    const pos = s.oraclePanelPosition || { x: 120, y: 120 };
    this.el.setCssStyles({
      position: 'absolute',
      left: `${pos.x}px`,
      top: `${pos.y}px`,
    });
  }

  private setupDrag(handleEl: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, select, input, .dte-oracle-tab-btn')) {
        return;
      }
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.el.getBoundingClientRect();
      const parentRect = this.container.getBoundingClientRect();
      origLeft = rect.left - parentRect.left;
      origTop = rect.top - parentRect.top;

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newX = Math.max(0, origLeft + dx);
      const newY = Math.max(0, origTop + dy);
      this.el.style.left = `${newX}px`;
      this.el.style.top = `${newY}px`;
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const s = this.plugin.settings as DinoSettings;
      s.oraclePanelPosition = {
        x: parseInt(this.el.style.left || '120', 10),
        y: parseInt(this.el.style.top || '120', 10),
      };
      this.plugin.saveSettings();
    };

    handleEl.addEventListener('mousedown', onMouseDown);
  }

  private getCampaignHistory(): OracleReadingEntry[] {
    const s = this.plugin.settings as DinoSettings;
    const campId = s.currentCampaignId;
    if (campId && s.campaigns && s.campaigns[campId]) {
      const camp = s.campaigns[campId];
      if (!camp.oracleHistory) {
        camp.oracleHistory = [];
      }
      return camp.oracleHistory;
    }

    // Fallback in settings if no active campaign
    if (!(s as any)._orphanOracleHistory) {
      (s as any)._orphanOracleHistory = [];
    }
    return (s as any)._orphanOracleHistory;
  }

  private async saveHistoryEntry(entry: OracleReadingEntry): Promise<void> {
    const list = this.getCampaignHistory();
    list.push(entry);
    await this.plugin.saveSettings();
  }

  private async clearHistory(): Promise<void> {
    const list = this.getCampaignHistory();
    list.length = 0;
    await this.plugin.saveSettings();
    new Notice('Historial de lecturas limpiado.', 3000);
    this.build();
  }

  public open(): void {
    this.el.show();
    this.build();
  }

  public close(): void {
    this.el.hide();
  }

  public destroy(): void {
    this.el.remove();
  }

  public build(): void {
    this.ensureSettings();
    this.el.empty();
    this.el.classList.toggle('is-minimized', this.minimized);

    const deck = this.getActiveDeck();

    // ── Header ──
    const header = this.el.createDiv({ cls: 'dte-oracle-header' });
    const titleGroup = header.createDiv({ cls: 'dte-oracle-title-group' });

    const iconSpan = titleGroup.createSpan({ cls: 'dte-oracle-header-icon' });
    setIcon(iconSpan, 'sparkles');
    titleGroup.createSpan({ text: deck.name, cls: 'dte-oracle-title' });

    const btnGroup = header.createDiv({ cls: 'dte-oracle-header-actions' });

    // Deck configuration modal button
    const deckConfigBtn = btnGroup.createEl('button', {
      cls: 'clickable-icon dte-btn-icon',
      attr: { 'aria-label': 'Configurar Mazo' },
    });
    setIcon(deckConfigBtn, 'settings');
    deckConfigBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      new OracleDeckModal(this.app, deck, async (updatedDeck) => {
        const s = this.plugin.settings as DinoSettings;
        const idx = s.oracleDecks.findIndex((d) => d.id === updatedDeck.id);
        if (idx !== -1) {
          s.oracleDecks[idx] = updatedDeck;
        } else {
          s.oracleDecks.push(updatedDeck);
        }
        await this.plugin.saveSettings();
        this.shuffleDeck(false);
        this.build();
      }).open();
    });

    // About project button
    const aboutBtn = btnGroup.createEl('button', {
      cls: 'clickable-icon dte-btn-icon',
      attr: { 'aria-label': 'Acerca de' },
    });
    setIcon(aboutBtn, 'info');
    aboutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      new OracleAboutModal(this.app).open();
    });

    // Minimize button
    const minBtn = btnGroup.createEl('button', {
      cls: 'clickable-icon dte-btn-icon',
      attr: { 'aria-label': this.minimized ? 'Expandir' : 'Minimizar' },
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
      attr: { 'aria-label': 'Cerrar' },
    });
    setIcon(closeBtn, 'x');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    this.setupDrag(header);

    if (this.minimized) {
      return;
    }

    // ── Navigation Tabs ──
    const tabsRow = this.el.createDiv({ cls: 'dte-oracle-tabs' });

    const tabDraw = tabsRow.createEl('button', {
      text: 'Lectura',
      cls: `dte-oracle-tab-btn ${this.activeTab === 'draw' ? 'is-active' : ''}`,
    });
    tabDraw.addEventListener('click', () => {
      this.activeTab = 'draw';
      this.build();
    });

    const historyCount = this.getCampaignHistory().length;
    const tabHistory = tabsRow.createEl('button', {
      text: `Historial (${historyCount})`,
      cls: `dte-oracle-tab-btn ${this.activeTab === 'history' ? 'is-active' : ''}`,
    });
    tabHistory.addEventListener('click', () => {
      this.activeTab = 'history';
      this.build();
    });

    // ── Body ──
    const body = this.el.createDiv({ cls: 'dte-oracle-body' });

    if (this.activeTab === 'draw') {
      this.renderDrawTab(body, deck);
    } else {
      this.renderHistoryTab(body, deck);
    }
  }

  // ─── TAB: LECTURA ─────────────────────────────────────────────
  private renderDrawTab(container: HTMLElement, deck: OracleDeck): void {
    // Remaining cards counter
    const counterRow = container.createDiv({ cls: 'dte-oracle-counter-row' });
    counterRow.createSpan({
      text: `${this.drawPile.length} cartas restantes`,
      cls: 'dte-oracle-cards-badge',
    });

    // Card frame
    const cardContainer = container.createDiv({ cls: 'dte-oracle-card-frame' });

    if (!this.currentCard) {
      // Show card back
      this.renderCardBack(cardContainer, deck);
    } else {
      // Show drawn card (unobscured full illustration)
      this.renderDrawnCard(cardContainer, this.currentCard, this.currentReversed);
      // Show card details and reading outcome directly below the card
      this.renderCardDetailsBox(container, this.currentCard, this.currentReversed, this.currentResult);
    }

    // Main action controls
    const mainControls = container.createDiv({ cls: 'dte-oracle-main-controls' });

    const drawBtn = mainControls.createEl('button', {
      cls: 'dte-btn mod-cta dte-oracle-draw-btn',
    });
    const drawIcon = drawBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(drawIcon, 'hand');
    drawBtn.createSpan({ text: 'Sacar Carta' });

    if (this.drawPile.length === 0) {
      drawBtn.disabled = true;
      drawBtn.addClass('is-disabled');
    }

    drawBtn.addEventListener('click', () => this.drawCard());

    const shuffleBtn = mainControls.createEl('button', {
      cls: 'dte-btn dte-oracle-shuffle-btn',
    });
    const shufIcon = shuffleBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(shufIcon, 'shuffle');
    shuffleBtn.createSpan({ text: 'Barajar Mazo' });
    shuffleBtn.addEventListener('click', () => this.shuffleDeck(true));

    // Dynamic interpretation mode buttons
    const modesRow = container.createDiv({ cls: 'dte-oracle-modes-row' });

    for (const rule of deck.rules) {
      const isThisActive = this.activeRuleId === rule.id;
      const modeBtn = modesRow.createEl('button', {
        cls: `dte-btn dte-oracle-mode-btn ${isThisActive ? 'is-active' : ''}`,
      });
      const icon = modeBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
      setIcon(icon, rule.style === 'answer' ? 'help-circle' : 'dice');
      modeBtn.createSpan({ text: rule.label });

      modeBtn.addEventListener('click', () => {
        if (this.activeRuleId === rule.id) {
          // Toggle off
          this.activeRuleId = null;
          this.isConfigOpen = false;
          new Notice(`Modo ${rule.label} desactivado`, 3000);
        } else {
          // Toggle on (exclusive)
          this.activeRuleId = rule.id;
          new Notice(`Modo ${rule.label} activado`, 3000);
          this.isConfigOpen = rule.askQuestion || rule.vars.length > 0;
        }
        this.build();
      });
    }

    // Configuration popover for active rule
    if (this.isConfigOpen && this.activeRuleId) {
      const activeRule = deck.rules.find((r) => r.id === this.activeRuleId);
      if (activeRule) {
        this.renderRuleConfigBox(container, deck, activeRule);
      }
    }
  }

  private renderCardBack(container: HTMLElement, deck: OracleDeck): void {
    const cardEl = container.createDiv({ cls: 'dte-oracle-card dte-oracle-card-back' });

    let resolvedBack: string | null = null;
    if (deck.backImagePath) {
      const file = this.app.vault.getAbstractFileByPath(deck.backImagePath);
      if (file && file instanceof TFile) {
        resolvedBack = this.app.vault.getResourcePath(file);
      }
    }

    if (resolvedBack) {
      cardEl.createEl('img', {
        cls: 'dte-oracle-card-img',
        attr: { src: resolvedBack, alt: 'Reverso del Mazo' },
      });
    } else {
      const fallbackBack = cardEl.createDiv({ cls: 'dte-oracle-back-pattern' });
      fallbackBack.createDiv({ cls: 'dte-oracle-back-ornament', text: '✦ HIEROFANTE ✦' });
      fallbackBack.createDiv({ cls: 'dte-oracle-back-sub', text: deck.name });
    }
  }

  private renderDrawnCard(
    container: HTMLElement,
    card: OracleCard,
    reversed: boolean
  ): void {
    const cardEl = container.createDiv({
      cls: `dte-oracle-card ${reversed ? 'dte-oracle-card-reversed' : ''}`,
    });

    let resolvedImg: string | null = null;
    if (card.imagePath) {
      const file = this.app.vault.getAbstractFileByPath(card.imagePath);
      if (file && file instanceof TFile) {
        resolvedImg = this.app.vault.getResourcePath(file);
      }
    }

    if (resolvedImg) {
      cardEl.createEl('img', {
        cls: 'dte-oracle-card-img',
        attr: { src: resolvedImg, alt: card.name },
      });
    } else {
      // Text fallback card
      const textCard = cardEl.createDiv({ cls: 'dte-oracle-card-text-fallback' });
      textCard.createDiv({ cls: 'dte-oracle-text-cat', text: card.category.toUpperCase() });
      textCard.createEl('h3', { cls: 'dte-oracle-text-name', text: card.name });
      if (card.isFigure) {
        textCard.createDiv({ cls: 'dte-oracle-badge-figure', text: 'Figura' });
      } else if (card.rank !== null) {
        textCard.createDiv({ cls: 'dte-oracle-badge-rank', text: `Rango ${card.rank}` });
      }
      textCard.createDiv({ cls: 'dte-oracle-text-meaning', text: card.meaning });
    }
  }

  private renderCardDetailsBox(
    container: HTMLElement,
    card: OracleCard,
    reversed: boolean,
    result: EvaluationResult | null
  ): void {
    const box = container.createDiv({ cls: 'dte-oracle-card-details-box' });

    const titleH = box.createEl('h3', { cls: 'dte-oracle-card-title-h' });
    titleH.createSpan({ text: card.name, cls: 'dte-oracle-cname' });
    titleH.createSpan({ text: ` · ${card.category}`, cls: 'dte-oracle-ccat' });

    const orientP = box.createEl('p', { cls: 'dte-oracle-corientation' });
    orientP.createSpan({
      text: `Orientación: ${reversed ? 'Invertida' : 'Normal'}`,
      cls: reversed ? 'is-reversed' : 'is-normal',
    });

    if (card.meaning) {
      box.createEl('p', {
        cls: 'dte-oracle-cmeaning',
        text: `Significado: ${card.meaning}`,
      });
    }

    // Active reading outcome
    if (result) {
      if (result.answer) {
        const ansBox = box.createDiv({ cls: 'dte-oracle-reading-result is-answer' });
        ansBox.createEl('h4', { text: `Respuesta: ${result.answer}` });
        if (result.detail) {
          ansBox.createEl('p', { text: result.detail });
        }
      } else if (result.eventType) {
        const evBox = box.createDiv({ cls: 'dte-oracle-reading-result is-event' });
        evBox.createEl('h4', { text: `Evento: ${result.eventType}` });
        if (result.eventDescription) {
          evBox.createEl('p', { text: result.eventDescription });
        }
      }
    }
  }

  private renderRuleConfigBox(
    container: HTMLElement,
    deck: OracleDeck,
    rule: InterpretationRule
  ): void {
    const box = container.createDiv({ cls: 'dte-oracle-config-box' });
    box.createEl('h4', { text: `Configuración: ${rule.label}` });

    for (const v of rule.vars) {
      const formGroup = box.createDiv({ cls: 'dte-oracle-form-group' });
      formGroup.createEl('label', { text: `${v.label}:` });
      const currentVal = deck.varValues[v.key] ?? v.default;
      const input = formGroup.createEl('input', {
        type: 'number',
        cls: 'dte-oracle-num-input',
        value: String(currentVal),
        attr: { min: String(v.min), max: String(v.max) },
      });

      input.addEventListener('change', () => {
        const parsed = parseInt(input.value, 10);
        if (isNaN(parsed) || parsed < v.min || parsed > v.max) {
          new Notice(`La ${v.label} debe ser un número entre ${v.min} y ${v.max}`, 3000);
          input.value = String(currentVal);
        } else {
          deck.varValues[v.key] = parsed;
          this.plugin.saveSettings();
          new Notice(`Configuración guardada: Dificultad ${parsed}`, 3000);
        }
      });
    }

    if (rule.askQuestion) {
      const qGroup = box.createDiv({ cls: 'dte-oracle-form-group' });
      qGroup.createEl('label', { text: 'Pregunta (opcional):' });
      const qInput = qGroup.createEl('input', {
        type: 'text',
        cls: 'dte-oracle-text-input',
        placeholder: 'Ej: ¿Lograré mi objetivo?',
        value: this.currentQuestion,
      });
      qInput.addEventListener('input', (e) => {
        this.currentQuestion = (e.target as HTMLInputElement).value;
      });
    }

    const applyBtn = box.createEl('button', {
      text: 'Aplicar y Cerrar',
      cls: 'dte-btn small mod-cta',
    });
    applyBtn.addEventListener('click', () => {
      this.isConfigOpen = false;
      this.build();
    });
  }

  private async drawCard(): Promise<void> {
    if (this.drawPile.length === 0) {
      new Notice('El mazo está vacío. Barajá para continuar.', 3000);
      return;
    }

    const deck = this.getActiveDeck();
    const randIdx = Math.floor(Math.random() * this.drawPile.length);
    const card = this.drawPile.splice(randIdx, 1)[0];

    let reversed = false;
    if (deck.orientationMode === 'upDown') {
      const chance = deck.reversedChance ?? 0.5;
      reversed = Math.random() < chance;
    }

    this.currentCard = card;
    this.currentReversed = reversed;

    let evalResult: EvaluationResult | null = null;

    const now = new Date();
    const dateStr = now.toLocaleString();
    const entry: OracleReadingEntry = {
      id: genId(),
      deckId: deck.id,
      ruleId: null,
      date: dateStr,
      timestamp: now.getTime(),
      card: card.name,
      type: card.category,
      meaning: card.meaning,
      orientation: reversed ? 'Invertida' : 'Normal',
    };

    if (this.activeRuleId) {
      const activeRule = deck.rules.find((r) => r.id === this.activeRuleId);
      if (activeRule) {
        entry.ruleId = activeRule.id;
        evalResult = evaluateRule(activeRule, card, reversed, deck.varValues);

        if (evalResult.answer) {
          entry.question = this.currentQuestion || undefined;
          entry.answer = evalResult.answer;
          entry.detail = evalResult.detail;
        }

        if (evalResult.eventType) {
          entry.eventType = evalResult.eventType;
          entry.eventDescription = evalResult.eventDescription;
        }

        // Deactivate active rule after single use, exactly as original app
        this.activeRuleId = null;
        this.isConfigOpen = false;

        const s = this.plugin.settings as DinoSettings;
        if (s.oracleResetQuestionOnDraw) {
          this.currentQuestion = '';
        }
      }
    }

    await this.saveHistoryEntry(entry);

    this.currentResult = evalResult;

    if (this.drawPile.length === 0) {
      new Notice('Has sacado la última carta del mazo. Barajá para reiniciar.', 3000);
    }

    this.build();
  }

  // ─── TAB: HISTORIAL ───────────────────────────────────────────
  private renderHistoryTab(container: HTMLElement, deck: OracleDeck): void {
    const history = this.getCampaignHistory();

    const topBar = container.createDiv({ cls: 'dte-oracle-hist-top' });
    topBar.createEl('h3', { text: 'Historial de Lecturas' });

    const btnGroup = topBar.createDiv({ cls: 'dte-oracle-hist-actions' });

    // Clean button
    const clearBtn = btnGroup.createEl('button', {
      cls: 'dte-btn small dte-btn-danger',
      attr: { 'aria-label': 'Limpiar Registro' },
      text: 'Limpiar',
    });
    const trashIcon = clearBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(trashIcon, 'trash');
    clearBtn.prepend(trashIcon);
    clearBtn.addEventListener('click', () => {
      if (history.length === 0) {
        new Notice('El historial ya está vacío.', 3000);
        return;
      }
      if (confirm('¿Estás seguro de que deseas limpiar el registro?')) {
        this.clearHistory();
      }
    });

    // Export button
    const exportBtn = btnGroup.createEl('button', {
      cls: 'dte-btn small',
      attr: { 'aria-label': 'Exportar' },
      text: 'Exportar',
    });
    const expIcon = exportBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(expIcon, 'download');
    exportBtn.prepend(expIcon);
    exportBtn.addEventListener('click', () => this.exportHistory());

    // Import button
    const importBtn = btnGroup.createEl('button', {
      cls: 'dte-btn small',
      attr: { 'aria-label': 'Importar' },
      text: 'Importar',
    });
    const impIcon = importBtn.createSpan({ cls: 'dte-btn-icon-prefix' });
    setIcon(impIcon, 'upload');
    importBtn.prepend(impIcon);

    const importInput = topBar.createEl('input', {
      type: 'file',
      attr: { accept: '.json' },
      cls: 'dte-hidden',
    });
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (ev) => this.importHistory(ev));

    // History list container
    const listContainer = container.createDiv({ cls: 'dte-oracle-hist-list' });

    if (history.length === 0) {
      listContainer.createDiv({
        cls: 'dte-oracle-empty',
        text: 'Aún no se han sacado cartas.',
      });
      return;
    }

    // Newest first
    const reversedHistory = [...history].reverse();

    for (const entry of reversedHistory) {
      const cardEntry = listContainer.createDiv({ cls: 'dte-oracle-hist-entry' });

      cardEntry.createDiv({ cls: 'dte-oracle-entry-date', text: entry.date });
      cardEntry.createDiv({
        cls: 'dte-oracle-entry-card',
        text: `${entry.card} (${entry.type})`,
      });
      cardEntry.createDiv({
        cls: 'dte-oracle-entry-orientation',
        text: `Orientación: ${entry.orientation}`,
      });
      cardEntry.createDiv({
        cls: 'dte-oracle-entry-meaning',
        text: `Significado: ${entry.meaning}`,
      });

      if (entry.question) {
        cardEntry.createDiv({
          cls: 'dte-oracle-entry-question',
          text: `Pregunta: ${entry.question}`,
        });
      }

      if (entry.answer) {
        cardEntry.createDiv({
          cls: 'dte-oracle-entry-answer',
          text: `Respuesta: ${entry.answer}${entry.detail ? ' — ' + entry.detail : ''}`,
        });
      }

      if (entry.eventType) {
        cardEntry.createDiv({
          cls: 'dte-oracle-entry-event-type',
          text: `Tipo de evento: ${entry.eventType}`,
        });
      }

      if (entry.eventDescription) {
        cardEntry.createDiv({
          cls: 'dte-oracle-entry-event-desc',
          text: `Descripción: ${entry.eventDescription}`,
        });
      }
    }
  }

  private exportHistory(): void {
    const history = this.getCampaignHistory();
    if (history.length === 0) {
      new Notice('No hay lecturas para exportar', 3000);
      return;
    }

    const dataStr = JSON.stringify(history, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'hierofante.json';
    a.click();
    URL.revokeObjectURL(url);
    new Notice('Lecturas exportadas correctamente', 3000);
  }

  private async importHistory(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);

      if (!Array.isArray(parsed)) {
        new Notice('El archivo importado no es válido', 3000);
        return;
      }

      const items = parsed as OracleReadingEntry[];
      const isValid = items.every(
        (item) => item && item.date && item.card && item.type && item.orientation
      );

      if (!isValid) {
        new Notice('El archivo importado no tiene el formato correcto', 3000);
        return;
      }

      const shouldAppend = confirm(
        '¿Deseás añadir estas lecturas al historial existente? (Aceptar = Añadir, Cancelar = Reemplazar)'
      );

      const targetList = this.getCampaignHistory();
      if (shouldAppend) {
        for (const item of items) {
          if (!item.id) item.id = genId();
          targetList.push(item);
        }
      } else {
        targetList.length = 0;
        for (const item of items) {
          if (!item.id) item.id = genId();
          targetList.push(item);
        }
      }

      await this.plugin.saveSettings();
      new Notice('Registro importado correctamente', 3000);
      this.build();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      new Notice(`Error al importar el archivo: ${msg}`, 3000);
    } finally {
      input.value = '';
    }
  }
}
