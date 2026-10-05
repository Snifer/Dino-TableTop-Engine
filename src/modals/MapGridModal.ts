import { App, Modal, Setting } from 'obsidian';
import { MapData, MapGridConfig, GridType, GridSizeMode, GridHexOrientation } from '../types';
import { getDefaultGridConfig } from '../grid';
import { t } from '../i18n';

export class MapGridModal extends Modal {
  map: MapData;
  gridConfig: MapGridConfig;
  onSave: (config: MapGridConfig) => void;

  constructor(app: App, map: MapData, onSave: (config: MapGridConfig) => void) {
    super(app);
    this.map = map;
    this.gridConfig = {
      ...getDefaultGridConfig(),
      ...(map.grid || {}),
    };
    this.onSave = onSave;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('dte-grid-modal');

    contentEl.createEl('h2', { text: t('grid.modalTitle') });
    contentEl.createEl('p', {
      cls: 'dte-hint',
      text: t('grid.modalDesc', { mapName: this.map.name }),
    });

    // 1. Activar / Desactivar Grilla
    new Setting(contentEl)
      .setName(t('grid.enableGrid'))
      .setDesc(t('grid.enableGridDesc'))
      .addToggle((toggle) =>
        toggle.setValue(this.gridConfig.enabled).onChange((v) => {
          this.gridConfig.enabled = v;
          this.onOpen();
        })
      );

    if (this.gridConfig.enabled) {
      // 2. Tipo de Grilla (Cuadrada / Hexagonal)
      new Setting(contentEl)
        .setName(t('grid.type'))
        .setDesc(t('grid.typeDesc'))
        .addDropdown((dd) =>
          dd
            .addOption('square', t('grid.typeSquare'))
            .addOption('hex', t('grid.typeHex'))
            .setValue(this.gridConfig.type)
            .onChange((v) => {
              this.gridConfig.type = v as GridType;
              this.onOpen();
            })
        );

      // 3. Orientación Hexagonal (si es tipo hex)
      if (this.gridConfig.type === 'hex') {
        new Setting(contentEl)
          .setName(t('grid.hexOrientation'))
          .setDesc(t('grid.hexOrientationDesc'))
          .addDropdown((dd) =>
            dd
              .addOption('pointy', t('grid.hexPointy'))
              .addOption('flat', t('grid.hexFlat'))
              .setValue(this.gridConfig.hexOrientation || 'pointy')
              .onChange((v) => {
                this.gridConfig.hexOrientation = v as GridHexOrientation;
              })
          );
      }

      // 4. Modo de Definición (Por tamaño px o por número de columnas)
      new Setting(contentEl)
        .setName(t('grid.sizeMode'))
        .setDesc(t('grid.sizeModeDesc'))
        .addDropdown((dd) =>
          dd
            .addOption('cellSize', t('grid.modeCellSize'))
            .addOption('count', t('grid.modeCount'))
            .setValue(this.gridConfig.mode)
            .onChange((v) => {
              this.gridConfig.mode = v as GridSizeMode;
              this.onOpen();
            })
        );

      // 5. Parámetros de tamaño según el modo
      if (this.gridConfig.mode === 'cellSize') {
        new Setting(contentEl)
          .setName(t('grid.cellSize'))
          .setDesc(t('grid.cellSizeDesc'))
          .addSlider((slider) =>
            slider
              .setLimits(15, 200, 5)
              .setValue(this.gridConfig.cellSize || 50)
              .setDynamicTooltip()
              .onChange((v) => {
                this.gridConfig.cellSize = v;
              })
          );
      } else {
        new Setting(contentEl)
          .setName(t('grid.columns'))
          .setDesc(t('grid.columnsDesc'))
          .addSlider((slider) =>
            slider
              .setLimits(4, 100, 2)
              .setValue(this.gridConfig.columns || 20)
              .setDynamicTooltip()
              .onChange((v) => {
                this.gridConfig.columns = v;
              })
          );
      }

      // 6. Snap to Grid (Alineación de tokens)
      new Setting(contentEl)
        .setName(t('grid.snapTokens'))
        .setDesc(t('grid.snapTokensDesc'))
        .addToggle((toggle) =>
          toggle.setValue(this.gridConfig.snapTokens).onChange((v) => {
            this.gridConfig.snapTokens = v;
          })
        );

      // 7. Color de línea
      new Setting(contentEl)
        .setName(t('grid.color'))
        .setDesc(t('grid.colorDesc'))
        .addColorPicker((color) =>
          color.setValue(this.gridConfig.color || '#ffffff').onChange((v) => {
            this.gridConfig.color = v;
          })
        );

      // 8. Opacidad
      new Setting(contentEl)
        .setName(t('grid.opacity'))
        .setDesc(t('grid.opacityDesc'))
        .addSlider((slider) =>
          slider
            .setLimits(10, 100, 5)
            .setValue(Math.round((this.gridConfig.opacity ?? 0.35) * 100))
            .setDynamicTooltip()
            .onChange((v) => {
              this.gridConfig.opacity = v / 100;
            })
        );

      // 9. Grosor de línea
      new Setting(contentEl)
        .setName(t('grid.thickness'))
        .setDesc(t('grid.thicknessDesc'))
        .addSlider((slider) =>
          slider
            .setLimits(1, 5, 1)
            .setValue(this.gridConfig.thickness || 1)
            .setDynamicTooltip()
            .onChange((v) => {
              this.gridConfig.thickness = v;
            })
        );
    }

    // Botones de acción
    const footer = contentEl.createDiv({ cls: 'dte-modal-footer' });
    const cancelBtn = footer.createEl('button', { cls: 'dte-btn', text: t('common.cancel') });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = footer.createEl('button', { cls: 'mod-cta dte-btn', text: t('common.save') });
    saveBtn.addEventListener('click', () => {
      this.onSave(this.gridConfig);
      this.close();
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
