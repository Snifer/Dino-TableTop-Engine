import { App, Modal, Notice, Setting } from 'obsidian';
import { OracleDeck } from './types';
import { matchImagesInFolder } from './deckImporter';
import { OracleCardEditModal } from './OracleCardEditModal';

export class OracleDeckModal extends Modal {
  private deck: OracleDeck;
  private onSave: (deck: OracleDeck) => void;
  private cardFilter = '';

  constructor(app: App, deck: OracleDeck, onSave: (deck: OracleDeck) => void) {
    super(app);
    this.deck = JSON.parse(JSON.stringify(deck)) as OracleDeck;
    this.onSave = onSave;
  }

  onOpen(): void {
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-oracle-deck-modal');

    contentEl.createEl('h2', { text: `Configurar Mazo: ${this.deck.name}` });

    // Deck general settings
    new Setting(contentEl)
      .setName('Nombre del Mazo')
      .addText((text) =>
        text.setValue(this.deck.name).onChange((val) => {
          this.deck.name = val;
        })
      );

    new Setting(contentEl)
      .setName('Modo de Orientación')
      .setDesc('Normal (siempre al derecho) o Arriba/Abajo (permite cartas invertidas)')
      .addDropdown((dd) => {
        dd.addOption('upDown', 'Arriba / Abajo (50% invertida)')
          .addOption('normal', 'Solo normal (sin inversión)')
          .setValue(this.deck.orientationMode)
          .onChange((val) => {
            this.deck.orientationMode = val as 'normal' | 'upDown';
          });
      });

    new Setting(contentEl)
      .setName('Probabilidad de carta invertida (0.0 a 1.0)')
      .setDesc('0.5 = 50% de probabilidad')
      .addText((text) =>
        text.setValue(String(this.deck.reversedChance ?? 0.5)).onChange((val) => {
          const num = parseFloat(val);
          if (!isNaN(num) && num >= 0 && num <= 1) {
            this.deck.reversedChance = num;
          }
        })
      );

    new Setting(contentEl)
      .setName('Imagen de Reverso (Reverso del mazo)')
      .setDesc('Ruta en la bóveda, ej. Attachments/reverso.jpg')
      .addText((text) =>
        text.setValue(this.deck.backImagePath || '').onChange((val) => {
          this.deck.backImagePath = val.trim() ? val.trim() : null;
        })
      );

    // Image matching section
    const imgSec = contentEl.createDiv({ cls: 'dte-oracle-section' });
    imgSec.createEl('h3', { text: 'Emparejamiento Masivo de Imágenes' });
    let folderInputVal = '';

    new Setting(imgSec)
      .setName('Carpeta en la Bóveda')
      .setDesc('Ruta relativa donde residen las imágenes (ej. Attachments/Hierofante)')
      .addText((text) => {
        text.setPlaceholder('ej. Attachments/Hierofante').onChange((val) => {
          folderInputVal = val;
        });
      })
      .addButton((btn) => {
        btn
          .setButtonText('Emparejar')
          .setCta()
          .onClick(() => {
            if (!folderInputVal.trim()) {
              new Notice('Ingresá una ruta de carpeta en la bóveda.');
              return;
            }
            try {
              const res = matchImagesInFolder(this.app, folderInputVal, this.deck.cards);
              new Notice(
                `Emparejadas ${res.matchedCount} / ${res.totalCount} imágenes.` +
                  (res.missing.length > 0 ? ` (Faltantes: ${res.missing.length})` : '')
              );
              this.render();
            } catch (err: any) {
              new Notice(`Error: ${err.message || err}`);
            }
          });
      });

    // Cards list
    const cardsHeader = contentEl.createDiv({ cls: 'dte-oracle-cards-header' });
    cardsHeader.createEl('h3', { text: `Cartas del Mazo (${this.deck.cards.length})` });

    const filterRow = cardsHeader.createDiv({ cls: 'dte-oracle-filter-row' });
    const searchInput = filterRow.createEl('input', {
      type: 'text',
      cls: 'dte-oracle-search',
      placeholder: 'Filtrar cartas por nombre o categoría...',
      value: this.cardFilter,
    });
    searchInput.addEventListener('input', (e) => {
      this.cardFilter = (e.target as HTMLInputElement).value.toLowerCase();
      this.renderCardList(cardsContainer);
    });

    const cardsContainer = contentEl.createDiv({ cls: 'dte-oracle-cards-list' });
    this.renderCardList(cardsContainer);

    // Save and cancel buttons
    const btnContainer = contentEl.createDiv({ cls: 'dte-modal-buttons' });
    const saveBtn = btnContainer.createEl('button', { text: 'Guardar Mazo', cls: 'mod-cta' });
    saveBtn.addEventListener('click', () => {
      this.onSave(this.deck);
      this.close();
    });

    const cancelBtn = btnContainer.createEl('button', { text: 'Cancelar' });
    cancelBtn.addEventListener('click', () => this.close());
  }

  private renderCardList(container: HTMLElement): void {
    container.empty();
    const filter = this.cardFilter.toLowerCase();
    const filtered = this.deck.cards.filter(
      (c) => c.name.toLowerCase().includes(filter) || c.category.toLowerCase().includes(filter)
    );

    if (filtered.length === 0) {
      container.createDiv({ cls: 'dte-oracle-empty', text: 'No se encontraron cartas.' });
      return;
    }

    for (const card of filtered) {
      const row = container.createDiv({ cls: 'dte-oracle-card-row' });

      const infoCol = row.createDiv({ cls: 'dte-oracle-card-col-info' });
      const titleLine = infoCol.createDiv({ cls: 'dte-oracle-card-title' });
      titleLine.createSpan({ text: card.name, cls: 'dte-oracle-card-name' });
      titleLine.createSpan({ text: ` [${card.category}]`, cls: 'dte-oracle-card-cat' });

      if (card.isFigure) {
        titleLine.createSpan({ text: ' (Figura)', cls: 'dte-oracle-badge-figure' });
      } else if (card.rank !== null) {
        titleLine.createSpan({ text: ` (Rango ${card.rank})`, cls: 'dte-oracle-badge-rank' });
      }

      const metaLine = infoCol.createDiv({ cls: 'dte-oracle-card-meta' });
      metaLine.createSpan({ text: card.meaning || 'Sin palabras clave' });

      const statusCol = row.createDiv({ cls: 'dte-oracle-card-col-status' });
      if (card.imagePath) {
        statusCol.createSpan({ text: '✓ Arte listo', cls: 'dte-oracle-tag-ok' });
      } else if (card.imageFile) {
        statusCol.createSpan({ text: `Sin archivo: ${card.imageFile}`, cls: 'dte-oracle-tag-missing' });
      } else {
        statusCol.createSpan({ text: 'Solo texto', cls: 'dte-oracle-tag-text' });
      }

      const editBtn = row.createEl('button', { text: 'Editar', cls: 'dte-btn small' });
      editBtn.addEventListener('click', () => {
        new OracleCardEditModal(this.app, card, (updated) => {
          const idx = this.deck.cards.findIndex((c) => c.id === card.id);
          if (idx !== -1) {
            this.deck.cards[idx] = updated;
            this.render();
          }
        }).open();
      });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
