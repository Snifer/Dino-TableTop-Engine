import { App, Modal, Setting } from 'obsidian';
import { OracleCard } from './types';

export class OracleCardEditModal extends Modal {
  private card: OracleCard;
  private onSave: (updated: OracleCard) => void;

  constructor(app: App, card: OracleCard, onSave: (updated: OracleCard) => void) {
    super(app);
    this.card = JSON.parse(JSON.stringify(card));
    this.onSave = onSave;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-oracle-card-edit-modal');

    contentEl.createEl('h2', { text: `Editar Carta: ${this.card.name}` });

    new Setting(contentEl)
      .setName('Nombre')
      .addText((text) =>
        text.setValue(this.card.name).onChange((val) => {
          this.card.name = val;
        })
      );

    new Setting(contentEl)
      .setName('Categoría / Palo')
      .setDesc('Ej. Arcano Mayor, Copa, Pentáculo, Espada, Basto')
      .addText((text) =>
        text.setValue(this.card.category).onChange((val) => {
          this.card.category = val;
        })
      );

    new Setting(contentEl)
      .setName('¿Es Figura?')
      .setDesc('Paje, Caballero, Reina, Rey')
      .addToggle((toggle) =>
        toggle.setValue(this.card.isFigure).onChange((val) => {
          this.card.isFigure = val;
          if (val) this.card.rank = null;
        })
      );

    new Setting(contentEl)
      .setName('Rango numérico (1–10)')
      .setDesc('Dejar vacío o 0 si no aplica (ej. figuras o arcanos)')
      .addText((text) =>
        text.setValue(this.card.rank !== null ? String(this.card.rank) : '').onChange((val) => {
          const num = parseInt(val, 10);
          this.card.rank = !isNaN(num) && num > 0 ? num : null;
        })
      );

    new Setting(contentEl)
      .setName('Significado / Palabras clave')
      .addTextArea((area) =>
        area.setValue(this.card.meaning).onChange((val) => {
          this.card.meaning = val;
        })
      );

    new Setting(contentEl)
      .setName('Nombre de archivo original (imageFile)')
      .setDesc('Nombre con el que se empareja en masa (ej. Cups01.jpg)')
      .addText((text) =>
        text.setValue(this.card.imageFile).onChange((val) => {
          this.card.imageFile = val;
        })
      );

    new Setting(contentEl)
      .setName('Ruta de imagen en la bóveda (imagePath)')
      .setDesc('Ruta relativa en el Vault si ya está asignada')
      .addText((text) =>
        text.setValue(this.card.imagePath || '').onChange((val) => {
          this.card.imagePath = val.trim() ? val.trim() : null;
        })
      );

    const btnContainer = contentEl.createDiv({ cls: 'dte-modal-buttons' });
    const saveBtn = btnContainer.createEl('button', { text: 'Guardar', cls: 'mod-cta' });
    saveBtn.addEventListener('click', () => {
      this.onSave(this.card);
      this.close();
    });

    const cancelBtn = btnContainer.createEl('button', { text: 'Cancelar' });
    cancelBtn.addEventListener('click', () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
