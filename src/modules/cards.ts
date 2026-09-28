import { App, Modal, Notice, Setting, TFile, setIcon } from 'obsidian';
import { EngineModule } from './types';
import { t, TranslationKey } from '../i18n';
import {
  CardDefinition,
  CardOnTable,
  CardRotationMode,
  DeckData,
  DinoSettings,
  MapData,
} from '../types';
import { genId } from '../utils';
import { FileSuggestModal } from '../modals/FileSuggestModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a stable instanceId for a card copy: `cardId-N` */
export function cardInstanceId(cardId: string, copyIndex: number): string {
  return `${cardId}-${copyIndex}`;
}

/** Expand a DeckData into all instanceIds it should ever have */
export function allInstanceIds(deck: DeckData): string[] {
  const ids: string[] = [];
  for (const card of deck.cards) {
    for (let i = 0; i < (card.copies || 1); i++) {
      ids.push(cardInstanceId(card.id, i));
    }
  }
  return ids;
}

/** Pick a rotation angle based on the deck's mode */
export function pickRotation(deck: DeckData): number {
  switch (deck.rotationMode) {
    case 'updown':
      return Math.random() < 0.5 ? 0 : 180;
    case 'foursides': {
      const opts = [0, 90, 180, 270];
      return opts[Math.floor(Math.random() * opts.length)];
    }
    case 'custom': {
      if (!deck.customAngles || deck.customAngles.length === 0) return 0;
      return deck.customAngles[Math.floor(Math.random() * deck.customAngles.length)];
    }
    default:
      return 0;
  }
}

/** Shuffle an array in place (Fisher-Yates) */
function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Find a CardDefinition by instanceId in a deck */
export function findCardByInstanceId(
  deck: DeckData,
  instanceId: string,
): CardDefinition | undefined {
  for (const card of deck.cards) {
    for (let i = 0; i < (card.copies || 1); i++) {
      if (cardInstanceId(card.id, i) === instanceId) return card;
    }
  }
  return undefined;
}

/** Resolve the back image for an instance (card override then deck fallback) */
export function resolveBackImage(deck: DeckData, card: CardDefinition | undefined): string | null {
  return card?.backImage ?? deck.backImage ?? null;
}

// ─── Cards Floating Panel ─────────────────────────────────────────────────────

export class CardsPanel {
  app: App;
  plugin: any;
  el: HTMLElement;
  private minimized = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private isDragging = false;
  private onRenderCards: () => void;

  constructor(app: App, plugin: any, panelsLayer: HTMLElement, onRenderCards: () => void) {
    this.app = app;
    this.plugin = plugin;
    this.onRenderCards = onRenderCards;

    this.el = panelsLayer.createDiv({ cls: 'dte-panel dte-cards-panel' });
    this.el.style.right = '16px';
    this.el.style.top = '60px';
    this.el.style.left = 'auto';
    this.el.style.pointerEvents = 'auto';

    this.build();
  }

  private get settings(): DinoSettings {
    return this.plugin.settings as DinoSettings;
  }

  private getCurrentMap(): MapData | null {
    const s = this.settings;
    const camp = s.currentCampaignId ? s.campaigns[s.currentCampaignId] : null;
    if (!camp) return null;
    return camp.currentMapId ? camp.maps[camp.currentMapId] ?? null : null;
  }

  private async save(): Promise<void> {
    await this.plugin.saveSettings();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  build(): void {
    this.el.empty();
    this.buildHeader();
    if (!this.minimized) {
      this.buildBody();
    }
  }

  private buildHeader(): void {
    const header = this.el.createDiv({ cls: 'dte-panel-header dte-cards-header' });

    // Drag
    header.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      this.isDragging = true;
      const rect = this.el.getBoundingClientRect();
      this.dragOffsetX = e.clientX - rect.left;
      this.dragOffsetY = e.clientY - rect.top;
      header.style.cursor = 'grabbing';
      e.preventDefault();
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      this.el.style.left = `${e.clientX - this.dragOffsetX}px`;
      this.el.style.top = `${e.clientY - this.dragOffsetY}px`;
      this.el.style.right = 'auto';
    });
    window.addEventListener('pointerup', () => {
      this.isDragging = false;
      header.style.cursor = 'grab';
    });

    const title = header.createDiv({ cls: 'dte-panel-title' });
    title.createSpan({ cls: 'dte-cards-icon', text: '🃏' });
    title.createSpan({ text: ' Mazos' });

    const actions = header.createDiv({ cls: 'dte-panel-actions' });

    // Minimize
    const minBtn = actions.createEl('button', {
      cls: 'dte-panel-btn',
      title: this.minimized ? 'Expandir' : 'Minimizar',
      text: this.minimized ? '▼' : '▲',
    });
    minBtn.addEventListener('click', () => {
      this.minimized = !this.minimized;
      this.build();
    });

    // Manage decks
    const manageBtn = actions.createEl('button', {
      cls: 'dte-panel-btn',
      title: 'Gestionar mazos',
    });
    setIcon(manageBtn, 'settings');
    manageBtn.addEventListener('click', () => {
      new DeckManagerModal(this.app, this.plugin, () => this.build()).open();
    });
  }

  private buildBody(): void {
    const body = this.el.createDiv({ cls: 'dte-cards-body' });
    const decks = Object.values(this.settings.decks);
    const map = this.getCurrentMap();

    if (decks.length === 0) {
      body.createEl('p', {
        cls: 'dte-cards-empty',
        text: 'No hay mazos. Crea uno con ⚙️.',
      });
      return;
    }

    for (const deck of decks) {
      this.buildDeckRow(body, deck, map);
    }
  }

  private buildDeckRow(container: HTMLElement, deck: DeckData, map: MapData | null): void {
    const row = container.createDiv({ cls: 'dte-cards-deck-row' });

    const info = row.createDiv({ cls: 'dte-cards-deck-info' });
    info.createEl('span', { cls: 'dte-cards-deck-name', text: deck.name });
    info.createEl('span', {
      cls: 'dte-cards-deck-count',
      text: `${deck.drawPile.length} en mazo · ${deck.discardPile.length} descartadas`,
    });

    const btns = row.createDiv({ cls: 'dte-cards-deck-btns' });

    // Draw top card and place on map
    const drawBtn = btns.createEl('button', {
      cls: 'dte-cards-btn dte-cards-btn-draw',
      text: 'Robar',
      title: 'Robar la carta superior y colocarla en el mapa',
    });
    drawBtn.disabled = deck.drawPile.length === 0 || !map;
    drawBtn.addEventListener('click', async () => {
      if (!map || deck.drawPile.length === 0) return;
      const instanceId = deck.drawPile.shift()!;
      const cardDef = findCardByInstanceId(deck, instanceId);
      if (!map.cardsOnTable) map.cardsOnTable = [];
      const maxZ = map.cardsOnTable.reduce((m, c) => Math.max(m, c.z), 0);
      const newCard: CardOnTable = {
        instanceId,
        deckId: deck.id,
        cardId: cardDef?.id ?? '',
        x: 50,
        y: 50,
        rotation: pickRotation(deck),
        faceUp: true,
        z: maxZ + 1,
      };
      map.cardsOnTable.push(newCard);
      await this.save();
      this.build();
      this.onRenderCards();
    });

    // Shuffle draw pile
    const shuffleBtn = btns.createEl('button', {
      cls: 'dte-cards-btn',
      title: 'Barajar el mazo',
    });
    setIcon(shuffleBtn, 'shuffle');
    shuffleBtn.disabled = deck.drawPile.length === 0;
    shuffleBtn.addEventListener('click', async () => {
      shuffle(deck.drawPile);
      await this.save();
      this.build();
    });

    // Reset: collect all cards back to draw pile
    const resetBtn = btns.createEl('button', {
      cls: 'dte-cards-btn',
      title: 'Recoger y barajar todo el mazo',
      text: '↺',
    });
    resetBtn.addEventListener('click', async () => {
      const onTable = map?.cardsOnTable ?? [];
      const tableFromDeck = onTable
        .filter((c) => c.deckId === deck.id)
        .map((c) => c.instanceId);

      deck.drawPile = [...deck.drawPile, ...deck.discardPile, ...tableFromDeck];
      deck.discardPile = [];
      if (map?.cardsOnTable) {
        map.cardsOnTable = map.cardsOnTable.filter((c) => c.deckId !== deck.id);
      }
      shuffle(deck.drawPile);
      await this.save();
      this.build();
      this.onRenderCards();
    });

    // Restore last discard to draw pile
    if (deck.discardPile.length > 0) {
      const discardBtn = btns.createEl('button', {
        cls: 'dte-cards-btn',
        title: 'Restaurar última carta del descarte al mazo',
        text: '♻️',
      });
      discardBtn.addEventListener('click', async () => {
        const id = deck.discardPile.pop();
        if (id) deck.drawPile.unshift(id);
        await this.save();
        this.build();
      });
    }
  }

  destroy(): void {
    this.el.remove();
  }
}

// ─── Deck Manager Modal ───────────────────────────────────────────────────────

export class DeckManagerModal extends Modal {
  plugin: any;
  onClose_cb: () => void;
  private selectedDeckId: string | null = null;

  constructor(app: App, plugin: any, onClose_cb: () => void) {
    super(app);
    this.plugin = plugin;
    this.onClose_cb = onClose_cb;
  }

  get settings(): DinoSettings {
    return this.plugin.settings as DinoSettings;
  }

  onOpen(): void {
    this.modalEl.addClass('dte-deck-manager-modal');
    this.render();
  }

  onClose(): void {
    this.onClose_cb();
  }

  private async save(): Promise<void> {
    await this.plugin.saveSettings();
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: '🃏 Gestión de Mazos' });

    const layout = contentEl.createDiv({ cls: 'dte-deck-manager-layout' });
    const sidebar = layout.createDiv({ cls: 'dte-deck-manager-sidebar' });
    const main = layout.createDiv({ cls: 'dte-deck-manager-main' });

    // Deck list
    const decks = Object.values(this.settings.decks);
    if (decks.length === 0) {
      sidebar.createEl('p', { cls: 'dte-deck-manager-empty', text: 'Sin mazos aun.' });
    }
    for (const deck of decks) {
      const item = sidebar.createDiv({
        cls: `dte-deck-manager-item${deck.id === this.selectedDeckId ? ' is-active' : ''}`,
      });
      item.createEl('span', { cls: 'dte-deck-manager-item-name', text: deck.name });
      item.createEl('span', {
        cls: 'dte-deck-manager-item-count',
        text: `${deck.cards.length} cartas`,
      });
      item.addEventListener('click', () => {
        this.selectedDeckId = deck.id;
        this.render();
      });
    }

    // New deck button
    const newBtn = sidebar.createEl('button', {
      cls: 'dte-deck-manager-new-btn',
      text: '+ Nuevo mazo',
    });
    newBtn.addEventListener('click', async () => {
      const id = genId();
      this.settings.decks[id] = {
        id,
        name: 'Mazo sin nombre',
        backImage: null,
        rotationMode: 'normal',
        customAngles: [],
        cards: [],
        drawPile: [],
        discardPile: [],
      };
      this.selectedDeckId = id;
      await this.save();
    });

    // Deck editor
    if (this.selectedDeckId && this.settings.decks[this.selectedDeckId]) {
      this.buildDeckEditor(main, this.settings.decks[this.selectedDeckId]);
    } else {
      main.createEl('p', {
        cls: 'dte-deck-manager-hint',
        text: 'Selecciona o crea un mazo para editarlo.',
      });
    }
  }

  private buildDeckEditor(container: HTMLElement, deck: DeckData): void {
    container.createEl('h3', { cls: 'dte-deck-editor-title', text: `Editando: ${deck.name}` });

    // Name
    new Setting(container).setName('Nombre del mazo').addText((txt) => {
      txt.setValue(deck.name).onChange(async (v) => {
        deck.name = v || 'Mazo sin nombre';
        await this.plugin.saveSettings();
        const nameEl = this.contentEl.querySelector(
          '.dte-deck-manager-item.is-active .dte-deck-manager-item-name',
        );
        if (nameEl) nameEl.textContent = deck.name;
        container.querySelector('.dte-deck-editor-title')!.textContent = `Editando: ${deck.name}`;
      });
    });

    // Back image
    new Setting(container)
      .setName('Imagen del dorso (mazo)')
      .setDesc(deck.backImage ?? 'No asignada')
      .addButton((btn) => {
        btn.setButtonText('Elegir').onClick(() => {
          new FileSuggestModal(this.app, ['png', 'jpg', 'jpeg', 'webp'], (file: TFile) => {
            deck.backImage = file.path;
            this.save();
          }).open();
        });
      })
      .addButton((btn) => {
        btn.setButtonText('Quitar').onClick(async () => {
          deck.backImage = null;
          await this.save();
        });
      });

    // Rotation mode
    new Setting(container)
      .setName('Modo de rotacion al robar')
      .addDropdown((dd) => {
        const modes: Record<CardRotationMode, string> = {
          normal: 'Normal (0 deg)',
          updown: 'Arriba/abajo (0 o 180 deg)',
          foursides: 'Cuatro lados (0, 90, 180, 270 deg)',
          custom: 'Personalizado',
        };
        for (const [k, v] of Object.entries(modes)) dd.addOption(k, v);
        dd.setValue(deck.rotationMode).onChange(async (v) => {
          deck.rotationMode = v as CardRotationMode;
          await this.save();
        });
      });

    // Custom angles only if mode is custom
    if (deck.rotationMode === 'custom') {
      new Setting(container)
        .setName('Angulos permitidos')
        .setDesc('Ingresa angulos separados por comas (ej. 0,90,270)')
        .addText((txt) => {
          txt.setValue(deck.customAngles.join(', ')).onChange(async (v) => {
            deck.customAngles = v
              .split(',')
              .map((s) => parseInt(s.trim(), 10))
              .filter((n) => !isNaN(n));
            await this.plugin.saveSettings();
          });
        });
    }

    // Delete deck
    new Setting(container).addButton((btn) => {
      btn
        .setButtonText('Eliminar mazo')
        .setWarning()
        .onClick(async () => {
          delete this.settings.decks[deck.id];
          this.selectedDeckId = null;
          await this.save();
        });
    });

    // ── Card list ────────────────────────────────────────────────────────────

    container.createEl('h4', { text: 'Cartas del mazo' });
    const cardList = container.createDiv({ cls: 'dte-deck-card-list' });

    if (deck.cards.length === 0) {
      cardList.createEl('p', { cls: 'dte-deck-card-empty', text: 'Sin cartas aun.' });
    }

    for (const card of deck.cards) {
      this.buildCardRow(cardList, deck, card);
    }

    const addCardBtn = container.createEl('button', {
      cls: 'dte-deck-add-card-btn',
      text: '+ Anadir carta',
    });
    addCardBtn.addEventListener('click', async () => {
      const newCard: CardDefinition = {
        id: genId(),
        name: 'Carta nueva',
        frontImage: null,
        backImage: null,
        copies: 1,
        linkedNote: null,
      };
      deck.cards.push(newCard);
      deck.drawPile.push(cardInstanceId(newCard.id, 0));
      await this.save();
    });

    // Rebuild / shuffle entire deck from definitions
    const rebuildBtn = container.createEl('button', {
      cls: 'dte-deck-rebuild-btn',
      text: 'Reconstruir mazo (barajar todo)',
    });
    rebuildBtn.addEventListener('click', async () => {
      deck.drawPile = allInstanceIds(deck);
      deck.discardPile = [];
      shuffle(deck.drawPile);
      new Notice(`Mazo "${deck.name}" reconstruido y barajado.`);
      await this.save();
    });
  }

  private buildCardRow(container: HTMLElement, deck: DeckData, card: CardDefinition): void {
    const row = container.createDiv({ cls: 'dte-deck-card-row' });

    // Front image preview
    const preview = row.createDiv({ cls: 'dte-deck-card-preview' });
    if (card.frontImage) {
      const af = this.app.vault.getAbstractFileByPath(card.frontImage);
      if (af instanceof TFile) {
        const src = this.app.vault.getResourcePath(af);
        preview.createEl('img', { cls: 'dte-deck-card-img', attr: { src } });
      } else {
        preview.createSpan({ cls: 'dte-deck-card-no-img', text: '🃏' });
      }
    } else {
      preview.createSpan({ cls: 'dte-deck-card-no-img', text: '🃏' });
    }

    const details = row.createDiv({ cls: 'dte-deck-card-details' });

    // Name input
    const nameInput = details.createEl('input', {
      cls: 'dte-deck-card-name-input',
      type: 'text',
      value: card.name,
      placeholder: 'Nombre de la carta',
    });
    nameInput.addEventListener('change', async () => {
      card.name = nameInput.value || 'Carta';
      await this.plugin.saveSettings();
    });

    // Copies
    const copiesWrap = details.createDiv({ cls: 'dte-deck-card-copies-wrap' });
    copiesWrap.createEl('span', { text: 'Copias: ' });
    const copiesInput = copiesWrap.createEl('input', {
      cls: 'dte-deck-card-copies-input',
      type: 'number',
      value: String(card.copies),
      attr: { min: '1', max: '20' },
    });
    copiesInput.addEventListener('change', async () => {
      card.copies = Math.max(1, parseInt(copiesInput.value, 10) || 1);
      await this.plugin.saveSettings();
    });

    // Actions
    const actions = row.createDiv({ cls: 'dte-deck-card-actions' });

    const frontBtn = actions.createEl('button', {
      cls: 'dte-deck-card-btn',
      title: 'Imagen del frente',
      text: 'Frente',
    });
    frontBtn.addEventListener('click', () => {
      new FileSuggestModal(this.app, ['png', 'jpg', 'jpeg', 'webp'], async (file: TFile) => {
        card.frontImage = file.path;
        await this.save();
      }).open();
    });

    const backBtn = actions.createEl('button', {
      cls: 'dte-deck-card-btn',
      title: 'Imagen del dorso (override de mazo)',
      text: 'Dorso',
    });
    backBtn.addEventListener('click', () => {
      new FileSuggestModal(this.app, ['png', 'jpg', 'jpeg', 'webp'], async (file: TFile) => {
        card.backImage = file.path;
        await this.save();
      }).open();
    });

    const delBtn = actions.createEl('button', {
      cls: 'dte-deck-card-btn dte-deck-card-btn-del',
      title: 'Eliminar carta',
      text: 'Eliminar',
    });
    delBtn.addEventListener('click', async () => {
      const idx = deck.cards.indexOf(card);
      if (idx !== -1) deck.cards.splice(idx, 1);
      const toRemove = new Set(
        Array.from({ length: card.copies }, (_, i) => cardInstanceId(card.id, i)),
      );
      deck.drawPile = deck.drawPile.filter((id) => !toRemove.has(id));
      deck.discardPile = deck.discardPile.filter((id) => !toRemove.has(id));
      await this.save();
    });
  }
}

// ─── Toolbar button helper ─────────────────────────────────────────────────────

export function renderCardsToolbarButton(container: HTMLElement, view: any): void {
  const btn = container.createEl('button', {
    cls: 'dte-btn',
    title: 'Cartas y Mazos',
  });
  const icon = btn.createSpan({ cls: 'dte-btn-icon-prefix' });
  setIcon(icon, 'layers');
  btn.prepend(icon);
  btn.createSpan({ text: t('modules.cardsShort') });
  btn.addEventListener('click', () => {
    if (!view.cardsPanel) return;
    view.cardsPanel.minimized = false;
    view.cardsPanel.build();
  });
}

// ─── Module registration ───────────────────────────────────────────────────────

export const CardsModule: EngineModule = {
  id: 'cards',
  nameKey: 'modules.cardsName' as TranslationKey,
  descKey: 'modules.cardsDesc' as TranslationKey,
  icon: 'layers',
  defaultEnabled: false,
  renderToolbarButton: renderCardsToolbarButton,
};
