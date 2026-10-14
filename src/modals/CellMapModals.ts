import { App, Modal, Setting } from 'obsidian';
import { CellMapData } from '../types';
import { initDefaultCellMapData } from '../modules/cellBoardTools';
import { t } from '../i18n';

export class NewCellMapModal extends Modal {
  private onSubmit: (name: string, cellMapData: CellMapData, gridUnit: string, gridRealSize: number) => void;
  private name: string = 'Nueva Pizarra de Celdas';
  private cellSizePx: number = 48;
  private gridUnit: string = 'm';
  private gridRealSize: number = 1.5;

  constructor(
    app: App,
    onSubmit: (name: string, cellMapData: CellMapData, gridUnit: string, gridRealSize: number) => void
  ) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Crear Pizarra de Celdas (Lienzo Infinito)' });

    new Setting(contentEl)
      .setName('Nombre del Mapa')
      .setDesc('Identificador de la pizarra o mazmorra.')
      .addText((text) =>
        text
          .setValue(this.name)
          .onChange((value) => {
            this.name = value;
          })
      );

    new Setting(contentEl)
      .setName('Tamaño de Celda en Pantalla (px)')
      .setDesc('Píxeles que ocupa cada celda de cuadrícula (por defecto 48px).')
      .addSlider((slider) =>
        slider
          .setLimits(24, 96, 4)
          .setValue(this.cellSizePx)
          .setDynamicTooltip()
          .onChange((val) => {
            this.cellSizePx = val;
          })
      );

    new Setting(contentEl)
      .setName('Unidad de Medida')
      .setDesc('Unidad para la escala del mapa (ej. m, ft, casillas).')
      .addText((text) =>
        text
          .setValue(this.gridUnit)
          .onChange((value) => {
            this.gridUnit = value;
          })
      );

    new Setting(contentEl)
      .setName('Tamaño Real por Celda')
      .setDesc('Distancia en el juego por cada casilla (ej. 1.5 para D&D/Pathfinder en metros, o 5 para pies).')
      .addText((text) =>
        text
          .setValue(String(this.gridRealSize))
          .onChange((val) => {
            const num = parseFloat(val);
            if (!isNaN(num) && num > 0) this.gridRealSize = num;
          })
      );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText('Crear Pizarra')
        .setCta()
        .onClick(() => {
          if (!this.name.trim()) return;
          const cellMap = initDefaultCellMapData();
          cellMap.cellSizePx = this.cellSizePx;
          this.close();
          this.onSubmit(this.name.trim(), cellMap, this.gridUnit, this.gridRealSize);
        })
    );
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
