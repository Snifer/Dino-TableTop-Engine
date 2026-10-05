import { App, Modal, Setting } from 'obsidian';
import {
  MapData,
  MapGridConfig,
  GridType,
  GridSizeMode,
  GridHexOrientation,
  DiagonalRule,
  MeasureUnit,
} from '../types';
import { getDefaultGridConfig } from '../grid';
import { t } from '../i18n';

export class GridConfigModal extends Modal {
  map: MapData;
  gridConfig: MapGridConfig;
  onSave: (config: MapGridConfig) => void;
  onCalibrate?: () => void;

  constructor(
    app: App,
    map: MapData,
    onSave: (config: MapGridConfig) => void,
    onCalibrate?: () => void
  ) {
    super(app);
    this.map = map;
    this.gridConfig = {
      ...getDefaultGridConfig(),
      ...(map.grid || {}),
    };
    this.onSave = onSave;
    this.onCalibrate = onCalibrate;
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

    // Botón de calibración interactiva
    if (this.onCalibrate) {
      new Setting(contentEl)
        .setName(t('grid.calibrateBtn'))
        .setDesc(t('grid.calibrateBtnDesc'))
        .addButton((b) =>
          b
            .setButtonText(t('grid.calibrateStart'))
            .setCta()
            .setIcon('crosshair')
            .onClick(() => {
              this.close();
              this.onCalibrate!();
            })
        );
    }

    // 1. Activar / Desactivar Cuadrícula
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
      // 2. Tamaño real y Unidad de celda
      new Setting(contentEl)
        .setName(t('grid.realSize'))
        .setDesc(t('grid.realSizeDesc'))
        .addText((text) =>
          text
            .setValue(String(this.gridConfig.cellRealSize ?? 1.5))
            .onChange((v) => {
              const num = parseFloat(v);
              if (!isNaN(num) && num > 0) {
                this.gridConfig.cellRealSize = num;
              }
            })
        )
        .addDropdown((dd) =>
          dd
            .addOption('m', t('grid.unitMeters'))
            .addOption('cm', t('grid.unitCm'))
            .addOption('in', t('grid.unitInches'))
            .setValue(this.gridConfig.unit || 'm')
            .onChange((v) => {
              this.gridConfig.unit = v as MeasureUnit;
            })
        );

      // 3. Regla de conteo diagonal
      new Setting(contentEl)
        .setName(t('grid.diagonalRule'))
        .setDesc(t('grid.diagonalRuleDesc'))
        .addDropdown((dd) =>
          dd
            .addOption('alternating', t('grid.ruleAlternating'))
            .addOption('euclidean', t('grid.ruleEuclidean'))
            .addOption('chebyshev', t('grid.ruleChebyshev'))
            .addOption('manhattan', t('grid.ruleManhattan'))
            .addOption('diagonal1_5', t('grid.ruleDiagonal1_5'))
            .setValue(this.gridConfig.diagonalRule || 'alternating')
            .onChange((v) => {
              this.gridConfig.diagonalRule = v as DiagonalRule;
            })
        );

      // 4. Tamaño de celda en píxeles
      new Setting(contentEl)
        .setName(t('grid.cellSizePx'))
        .setDesc(t('grid.cellSizePxDesc'))
        .addSlider((slider) =>
          slider
            .setLimits(15, 300, 1)
            .setValue(this.gridConfig.cellSizePx || this.gridConfig.cellSize || 50)
            .setDynamicTooltip()
            .onChange((v) => {
              this.gridConfig.cellSizePx = v;
              this.gridConfig.cellSize = v;
            })
        );

      // 5. Desfases X e Y
      new Setting(contentEl)
        .setName(t('grid.offsets'))
        .setDesc(t('grid.offsetsDesc'))
        .addText((tx) =>
          tx
            .setPlaceholder('Offset X (px)')
            .setValue(String(this.gridConfig.offsetX || 0))
            .onChange((v) => {
              this.gridConfig.offsetX = parseInt(v) || 0;
            })
        )
        .addText((ty) =>
          ty
            .setPlaceholder('Offset Y (px)')
            .setValue(String(this.gridConfig.offsetY || 0))
            .onChange((v) => {
              this.gridConfig.offsetY = parseInt(v) || 0;
            })
        );

      // 6. Mostrar superposición visual (Overlay)
      new Setting(contentEl)
        .setName(t('grid.showOverlay'))
        .setDesc(t('grid.showOverlayDesc'))
        .addToggle((toggle) =>
          toggle.setValue(this.gridConfig.showOverlay ?? true).onChange((v) => {
            this.gridConfig.showOverlay = v;
            this.onOpen();
          })
        );

      if (this.gridConfig.showOverlay) {
        // Tipo de Grilla
        new Setting(contentEl)
          .setName(t('grid.type'))
          .setDesc(t('grid.typeDesc'))
          .addDropdown((dd) =>
            dd
              .addOption('square', t('grid.typeSquare'))
              .addOption('hex', t('grid.typeHex'))
              .setValue(this.gridConfig.type || 'square')
              .onChange((v) => {
                this.gridConfig.type = v as GridType;
                this.onOpen();
              })
          );

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

        // Color de línea
        new Setting(contentEl)
          .setName(t('grid.color'))
          .setDesc(t('grid.colorDesc'))
          .addColorPicker((color) =>
            color.setValue(this.gridConfig.color || '#ffffff').onChange((v) => {
              this.gridConfig.color = v;
            })
          );

        // Opacidad
        new Setting(contentEl)
          .setName(t('grid.opacity'))
          .setDesc(t('grid.opacityDesc'))
          .addSlider((slider) =>
            slider
              .setLimits(5, 100, 5)
              .setValue(Math.round((this.gridConfig.opacity ?? 0.35) * 100))
              .setDynamicTooltip()
              .onChange((v) => {
                this.gridConfig.opacity = v / 100;
              })
          );

        // Grosor de línea
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

      // Snap tokens toggle
      new Setting(contentEl)
        .setName(t('grid.snapTokens'))
        .setDesc(t('grid.snapTokensDesc'))
        .addToggle((toggle) =>
          toggle.setValue(this.gridConfig.snapTokens ?? false).onChange((v) => {
            this.gridConfig.snapTokens = v;
          })
        );
    }

    // Footer
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
